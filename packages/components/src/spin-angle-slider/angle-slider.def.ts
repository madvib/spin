import {
  dataAttr,
  defineComponent,
  isComposing,
  textProp,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import {
  config,
  displayAngle,
  implementations,
  isInteractive,
  pointAngle,
  valueAsDegree,
  type AngleSliderContext,
  type AngleSliderEvent,
  type AngleSliderValueChange,
} from "./angle-slider.machine.ts";

/**
 * Angle-slider definition: the DOM contract as data. The machine owns the
 * three phases, the degree value, the step grid and the grab offset; this
 * file maps props to channels, parts to attribute bags, commands to sends,
 * and value/change-end transitions to their events.
 *
 * Everything that needs a node lives here — the pointer-to-angle
 * measurement (reported in as a raw dial angle, because the machine never
 * touches the DOM), pointer capture (an off-dial release still ends the
 * drag), the thumb-over test for relative drags, and the thumb focus after
 * a press. Positioning tracks the value, so the thumb and marker bags own
 * it — the slider thumb precedent.
 */

export interface AngleSliderMarkerSlotProps {
  readonly value: number;
}

export interface AngleSliderValueChangeEnd {
  readonly value: number;
  readonly valueAsDegree: string;
}

export interface AngleSliderApi {
  readonly value: number;
  readonly valueAsDegree: string;
  readonly dragging: boolean;
  setValue(value: number): void;
  focus(): void;
  /** The marker values, for the recipe's iteration. */
  getMarkers(): readonly number[];
  getMarkerState(value: number): "under-value" | "over-value" | "at-value";
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getThumbProps(): Record<string, unknown>;
  getValueTextProps(value: string): Record<string, unknown>;
  getMarkerGroupProps(): Record<string, unknown>;
  getMarkerProps(slot: AngleSliderMarkerSlotProps): Record<string, unknown>;
}

// Scope props arrive as strings; hooks write numbers. Accept both — a
// string-authored `defaultValue="45"` seeds 45, not 0.
const numProp = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

type Ctx = AngleSliderContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const MARKERS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Rim placement: dial degrees (zero top, clockwise) to a center-based
 * left/top pair on a 100-unit dial. */
const rimPlacement = (angle: number, radius: number): { left: string; top: string } => {
  const radians = ((angle - 90) * Math.PI) / 180;
  const left = 50 + radius * Math.cos(radians);
  const top = 50 + radius * Math.sin(radians);
  return { left: `${left}%`, top: `${top}%` };
};

type Capturable = Element & { setPointerCapture?: (id: number) => void };

/** The raw pointer angle around the control center, in degrees. */
const rawAngle = (scope: ScopeLike, clientX: number, clientY: number): number | null => {
  if (typeof document === "undefined") return null;
  const control = document.getElementById(scope.id("control"));
  if (control === null || typeof control.getBoundingClientRect !== "function") return null;
  const rect = control.getBoundingClientRect();
  return pointAngle(rect.left + rect.width / 2, rect.top + rect.height / 2, clientX, clientY);
};

/** Whether the press landed on the thumb: relative drags grab, elsewhere
 * jumps. */
const overThumb = (scope: ScopeLike, target: EventTarget | null): boolean => {
  if (target === null || typeof document === "undefined") return false;
  const thumb = document.getElementById(scope.id("thumb"));
  if (thumb === null || !(target instanceof Element)) return false;
  return thumb === target || thumb.contains(target);
};

/** The view reflex: after a press or keyboard move the thumb takes focus. */
const focusThumb = (scope: ScopeLike): void => {
  if (typeof document === "undefined") return;
  document.getElementById(scope.id("thumb"))?.focus({ preventScroll: true });
};

const def: ComponentDef<AngleSliderContext, AngleSliderEvent> = {
  name: "angle-slider",
  config,
  implementations,
  seed: (props, authored) => ({
    step: numProp(props["step"]) ?? 1,
    largeStep: numProp(props["largeStep"]) ?? 10 * (numProp(props["step"]) ?? 1),
    dir: props["dir"] === "rtl" ? "rtl" : "ltr",
    disabled: props["disabled"] === true,
    readOnly: props["readOnly"] === true,
    invalid: props["invalid"] === true,
    value: numProp(authored("value") ? props["value"] : props["defaultValue"]) ?? 0,
  }),
  channels: {
    value: {
      controlled: true,
      parse: (raw) => {
        const value = numProp(raw);
        return value === null ? 0 : value;
      },
      event: (value: number) => ({ type: "VALUE.SET", value }),
    },
    defaultValue: { parse: (raw) => numProp(raw) ?? 0 },
    step: { parse: (raw) => numProp(raw) ?? 1 },
    largeStep: { parse: (raw) => numProp(raw) ?? 0 },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    disabled: { parse: (raw) => raw === true },
    readOnly: { parse: (raw) => raw === true },
    invalid: { parse: (raw) => raw === true },
    required: { parse: (raw) => raw === true },
    name: { parse: textProp },
    label: { parse: textProp },
    ariaLabel: { parse: textProp },
  },
  scalars: ["step", "dir", "disabled", "readOnly", "invalid"],
  scalarsOf: (parsed) => {
    const step = numProp(parsed["step"]) ?? 1;
    return {
      step,
      largeStep: numProp(parsed["largeStep"]) ?? 10 * step,
      dir: parsed["dir"],
      disabled: parsed["disabled"],
      readOnly: parsed["readOnly"],
      invalid: parsed["invalid"],
    };
  },
  commitEvents: [
    "DOC.POINTER_UP",
    "THUMB.ARROW_INC",
    "THUMB.ARROW_DEC",
    "THUMB.HOME",
    "THUMB.END",
    "VALUE.SET",
  ],
  parts: {
    root: {
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [ctx.value, scope.props["disabled"], scope.props["invalid"], scope.props["readOnly"]].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const shown = displayAngle(ctx.value, ctx.dir);
        return {
          id: scope.id(""),
          dir: scope.props["dir"],
          "data-scope": "angle-slider",
          "data-part": "root",
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-invalid": dataAttr(scope.props["invalid"] === true),
          "data-readonly": dataAttr(scope.props["readOnly"] === true),
          style: { "--angle-value": String(ctx.value), "--angle": `${shown}deg` },
        };
      },
    },
    label: {
      sig: (scope) => [`${scope.props["label"]}`, `${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("label"),
        dir: scope.props["dir"],
        "data-scope": "angle-slider",
        "data-part": "label",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
        "data-invalid": dataAttr(scope.props["invalid"] === true),
        "data-readonly": dataAttr(scope.props["readOnly"] === true),
        for: scope.id("hiddenInput"),
        onClick: (event: MouseEvent): void => {
          if (!isInteractive(asCtx(scope.context))) return;
          event.preventDefault();
          focusThumb(scope);
        },
      }),
    },
    hiddenInput: {
      id: "hidden-input",
      sig: (scope) => [`${scope.props["name"]}`, `${asCtx(scope.context).value}`].join(" "),
      attrs: (scope) => {
        const name = scope.props["name"] as string;
        return {
          id: scope.id("hiddenInput"),
          type: "hidden",
          name: name.length > 0 ? name : undefined,
          value: String(asCtx(scope.context).value),
        };
      },
    },
    control: {
      sig: (scope) => [
        scope.props["disabled"],
        scope.props["invalid"],
        scope.props["readOnly"],
        scope.state,
      ].join(" "),
      attrs: (scope) => ({
        id: scope.id("control"),
        role: "presentation",
        dir: scope.props["dir"],
        "data-scope": "angle-slider",
        "data-part": "control",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
        "data-invalid": dataAttr(scope.props["invalid"] === true),
        "data-readonly": dataAttr(scope.props["readOnly"] === true),
        style: { position: "relative", touchAction: "none", userSelect: "none" },
        onPointerdown: (event: PointerEvent): void => {
          const ctx = asCtx(scope.context);
          if (!isInteractive(ctx)) return;
          if (event.pointerType === "mouse" && event.button !== 0) return;
          const angle = rawAngle(scope, event.clientX, event.clientY);
          if (angle === null) return;
          // A press on the thumb drags relative (grab offset); elsewhere
          // the dial jumps to the pointer.
          const angularOffset = overThumb(scope, event.target) ? angle - ctx.value : null;
          event.stopPropagation();
          (event.currentTarget as Capturable | null)?.setPointerCapture?.(event.pointerId);
          scope.send({ type: "CONTROL.POINTER_DOWN", rawAngle: angle, angularOffset });
          focusThumb(scope);
        },
        onPointermove: (event: PointerEvent): void => {
          if (scope.state !== "dragging") return;
          const angle = rawAngle(scope, event.clientX, event.clientY);
          if (angle === null) return;
          scope.send({ type: "DOC.POINTER_MOVE", rawAngle: angle });
        },
        onPointerup: (): void => {
          if (scope.state !== "dragging") return;
          scope.send({ type: "DOC.POINTER_UP" });
        },
      }),
    },
    thumb: {
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [ctx.value, scope.props["disabled"], scope.props["readOnly"], scope.props["invalid"], scope.state].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const shown = displayAngle(ctx.value, ctx.dir);
        const ariaLabel = scope.props["ariaLabel"] as string;
        return {
          id: scope.id("thumb"),
          role: "slider",
          dir: scope.props["dir"],
          "aria-label": ariaLabel.length > 0 ? ariaLabel : undefined,
          "aria-labelledby": ariaLabel.length > 0 ? undefined : scope.id("label"),
          "aria-valuemax": "360",
          "aria-valuemin": "0",
          "aria-valuenow": String(ctx.value),
          tabindex: scope.props["readOnly"] === true || isInteractive(ctx) ? "0" : undefined,
          "data-scope": "angle-slider",
          "data-part": "thumb",
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-invalid": dataAttr(scope.props["invalid"] === true),
          "data-readonly": dataAttr(scope.props["readOnly"] === true),
          style: {
            "--thumb-angle": `${shown}deg`,
            ...rimPlacement(shown, 42),
            marginLeft: "-10px",
            marginTop: "-10px",
          },
          onFocus: (): void => {
            scope.send({ type: "THUMB.FOCUS" });
          },
          onBlur: (): void => {
            scope.send({ type: "THUMB.BLUR" });
          },
          onKeydown: (event: KeyboardEvent): void => {
            if (event.defaultPrevented) return;
            const live = asCtx(scope.context);
            if (!isInteractive(live)) return;
            if (isComposing(event)) return;
            const large = event.shiftKey ? live.largeStep : undefined;
            const keyed = (type: string): boolean => {
              event.preventDefault();
              scope.send({ type, ...(large !== undefined ? { step: large } : {}) });
              focusThumb(scope);
              return true;
            };
            switch (event.key) {
              case "ArrowLeft":
              case "ArrowUp":
                keyed("THUMB.ARROW_DEC");
                break;
              case "ArrowRight":
              case "ArrowDown":
                keyed("THUMB.ARROW_INC");
                break;
              case "Home":
                keyed("THUMB.HOME");
                break;
              case "End":
                keyed("THUMB.END");
                break;
              default:
                break;
            }
          },
        };
      },
    },
    valueText: {
      id: "value-text",
      sig: () => "text",
      attrs: (scope, arg) => {
        void arg;
        return {
          id: scope.id("valueText"),
          dir: scope.props["dir"],
          "data-scope": "angle-slider",
          "data-part": "value-text",
        };
      },
    },
    markerGroup: {
      id: "marker-group",
      sig: (scope) => [`${scope.props["dir"]}`].join(" "),
      attrs: (scope) => ({
        dir: scope.props["dir"],
        "data-scope": "angle-slider",
        "data-part": "marker-group",
      }),
    },
  },
  slots: {
    marker: {
      indexes: () => MARKERS,
      sig: (scope) => {
        const slot = scope.slot as unknown as AngleSliderMarkerSlotProps;
        return [slot.value, asCtx(scope.context).value].join(" ");
      },
      attrs: (scope) => {
        const slot = scope.slot as unknown as AngleSliderMarkerSlotProps;
        const context = asCtx(scope.context);
        const shown = displayAngle(slot.value, context.dir);
        const state = slot.value < context.value
          ? "under-value"
          : slot.value > context.value
          ? "over-value"
          : "at-value";
        return {
          id: scope.id("marker", slot.value),
          dir: scope.props["dir"],
          "data-scope": "angle-slider",
          "data-part": "marker",
          "data-value": String(slot.value),
          "data-state": state,
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          style: {
            "--marker-angle": `${shown}deg`,
            ...rimPlacement(shown, 46),
          },
        };
      },
    },
  },
  commands: {
    setValue: { event: (args) => ({ type: "VALUE.SET", value: args[0] as number }) },
    // The thumb carries no tabindex while disabled or read-only, so a DOM
    // focus then is a harmless no-op — the guard the bridge held.
    focus: {
      view: ({ focus }) => focus("thumb"),
    },
  },
  readers: {
    value: { read: (context) => asCtx(context).value },
    valueAsDegree: { read: (context) => valueAsDegree(asCtx(context).value) },
    dragging: { read: (_context, state) => state === "dragging" },
  },
  methods: {
    getMarkers: {
      call: () => MARKERS,
    },
    getMarkerState: {
      call: (context, _state, args) => {
        const value = args[0] as number;
        const current = (context as unknown as Ctx).value;
        if (value < current) return "under-value";
        if (value > current) return "over-value";
        return "at-value";
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [asCtx(context).value],
      detail: (watched) => ({
        value: watched[0] as number,
        valueAsDegree: `${watched[0] as number}deg`,
      }),
    },
    "value-change-end": {
      prop: "onValueChangeEnd",
      on: "commit",
      watch: (context) => [asCtx(context).value],
      detail: (watched) => ({
        value: watched[0] as number,
        valueAsDegree: `${watched[0] as number}deg`,
      }),
    },
  },
};

export const angleSlider = defineComponent<AngleSliderContext, AngleSliderEvent, AngleSliderApi>(def);
