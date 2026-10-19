import {
  dataAttr,
  defineComponent,
  isComposing,
  type ComponentDef,
  type PartScope,
  type SlotScope,
} from "@spin/runtime";
import {
  config,
  displayAngle,
  implementations,
  initial,
  isInteractive,
  valueAsDegree,
  type AngleSliderContext,
  type AngleSliderEvent,
  type AngleSliderInitial,
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
  /**
   * Rim radius in dial-percent (50 = the control edge). The def cannot know
   * the dial's drawn geometry — a bordered circle, a track ring, a needle
   * dial each ride a different radius — so the usage says, defaulting to
   * the track centerline the examples draw.
   */
  readonly radius?: number;
  /**
   * Diameter mode: the marker is a full-diameter line markup centers and
   * rotates itself (tark parity). Position is skipped, rotation kept.
   */
  readonly diameter?: boolean;
}

export interface AngleSliderThumbSlotProps {
  readonly radius?: number;
  /**
   * Needle mode: the thumb is a full-diameter indicator line rotated to
   * the value (tark parity), not a dot on the rim. The bag emits rotation
   * without a rim point; markup centers the line itself.
   */
  readonly needle?: boolean;
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
  getThumbProps(slot?: AngleSliderThumbSlotProps): Record<string, unknown>;
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

interface ScopeLike extends PartScope<unknown, AngleSliderContext> {}

interface SlotLike<R> extends SlotScope<R, AngleSliderContext> {}

/** Transport guarantees the raw prop bag is an AngleSliderInitial-shaped object. */
const isAngleSliderInitial = (raw: unknown): raw is AngleSliderInitial =>
  raw !== null && typeof raw === "object";

const MARKERS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Rim placement: dial degrees (zero top, clockwise) to a center-based
 * left/top pair on a 100-unit dial. */
const rimPlacement = (angle: number, radius: number): { left: string; top: string } => {
  const radians = ((angle - 90) * Math.PI) / 180;
  const left = 50 + radius * Math.cos(radians);
  const top = 50 + radius * Math.sin(radians);
  return { left: `${left}%`, top: `${top}%` };
};

const isCapturable = (value: unknown): value is Element & { setPointerCapture(id: number): void } => {
  if (!(value instanceof Element) || !("setPointerCapture" in value)) return false;
  const fn: unknown = value.setPointerCapture;
  return typeof fn === "function";
};

const capturePointer = (target: EventTarget | null, pointerId: number): void => {
  if (isCapturable(target)) target.setPointerCapture(pointerId);
};

/** A text prop: strings pass, everything else is empty. */
const textProp = (raw: unknown): string => typeof raw === "string" ? raw : "";

/** A marker row: the indexes carry bare numbers, so the row is the value.
 * `getMarkerProps({ value, radius, diameter })` shapes the same way. */
const markerSlot = (slot: unknown): AngleSliderMarkerSlotProps & { readonly value: number } => {
  if (typeof slot === "number" && Number.isFinite(slot)) return { value: slot };
  if (typeof slot !== "object" || slot === null || Array.isArray(slot)) return { value: NaN };
  const bag: Record<string, unknown> = { ...slot };
  const value: unknown = bag["value"];
  const radius: unknown = bag["radius"];
  const diameter: unknown = bag["diameter"];
  return {
    value: typeof value === "number" && Number.isFinite(value) ? value : NaN,
    ...(typeof radius === "number" && Number.isFinite(radius) ? { radius } : {}),
    ...(diameter === true ? { diameter: true as const } : {}),
  };
};

/** The thumb's optional slot arg: the recipe's per-usage geometry rides
 * here (`getThumbProps({ radius })`). Anything else is no geometry. */
const thumbSlot = (arg: unknown): AngleSliderThumbSlotProps => {
  if (typeof arg !== "object" || arg === null || Array.isArray(arg)) return {};
  const bag: Record<string, unknown> = { ...arg };
  const radius: unknown = bag["radius"];
  const needle: unknown = bag["needle"];
  return {
    ...(typeof radius === "number" && Number.isFinite(radius) ? { radius } : {}),
    ...(needle === true ? { needle: true as const } : {}),
  };
};

/** atan2 around the center, in dial degrees (zero top, clockwise). */
const pointAngle = (centerX: number, centerY: number, clientX: number, clientY: number): number => {
  const x = clientX - centerX;
  const y = clientY - centerY;
  const deg = Math.atan2(x, y) * (180 / Math.PI) + 180;
  return 360 - deg;
};

/** The raw pointer angle around the control center, in degrees. */
const rawAngle = (scope: ScopeLike, clientX: number, clientY: number): number | null => {
  const rect = scope.measure("control");
  if (rect === null) return null;
  return pointAngle(rect.left + rect.width / 2, rect.top + rect.height / 2, clientX, clientY);
};

/** Whether the press landed on the thumb: relative drags grab, elsewhere
 * jumps. The press target carries its own id — no node lookup. */
const overThumb = (scope: ScopeLike, target: EventTarget | null): boolean => {
  if (target === null || !(target instanceof Element)) return false;
  const thumbId = scope.id("thumb");
  return target.id === thumbId || target.closest(`[id="${thumbId}"]`) !== null;
};

/** The view reflex: after a press or keyboard move the thumb takes focus. */
const focusThumb = (id: (part: string, slot?: unknown) => string): void => {
  if (typeof document === "undefined") return;
  document.getElementById(id("thumb"))?.focus({ preventScroll: true });
};

const def: ComponentDef<AngleSliderContext, AngleSliderEvent> = {
  name: "angle-slider",
  config,
  implementations,
  seed: (raw, authored) => {
    const props: AngleSliderInitial = isAngleSliderInitial(raw) ? raw : {};
    const shaped = initial(props);
    // An authored channel starts at its value, not its default.
    const value = authored("value") ? numProp(props.value) ?? shaped.value : shaped.value;
    return { ...shaped, value, dragOffset: null };
  },
  reconcile: ({ context, parsed, authored, send }) => {
    if (!authored("value")) return false;
    const value = numProp(parsed["value"]);
    if (value === null || context.value === value) return false;
    send({ type: "VALUE.SET", value });
    return true;
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
        const ctx = scope.context;
        return [ctx.value, scope.props["disabled"], scope.props["invalid"], scope.props["readOnly"]].join(" ");
      },
      attrs: (scope) => {
        const ctx = scope.context;
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
          if (!isInteractive(scope.context)) return;
          event.preventDefault();
          focusThumb(scope.id);
        },
      }),
    },
    hiddenInput: {
      id: "hidden-input",
      sig: (scope) => [`${scope.props["name"]}`, `${scope.context.value}`].join(" "),
      attrs: (scope) => {
        const name = textProp(scope.props["name"]);
        return {
          id: scope.id("hiddenInput"),
          type: "hidden",
          name: name.length > 0 ? name : undefined,
          value: String(scope.context.value),
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
          const ctx = scope.context;
          if (!isInteractive(ctx)) return;
          if (event.pointerType === "mouse" && event.button !== 0) return;
          const angle = rawAngle(scope, event.clientX, event.clientY);
          if (angle === null) return;
          // A press on the thumb drags relative (grab offset); elsewhere
          // the dial jumps to the pointer.
          const angularOffset = overThumb(scope, event.target) ? angle - ctx.value : null;
          event.stopPropagation();
          capturePointer(event.currentTarget, event.pointerId);
          scope.send({ type: "CONTROL.POINTER_DOWN", rawAngle: angle, angularOffset });
          focusThumb(scope.id);
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
      sig: (scope: ScopeLike, arg?: unknown) => {
        const ctx = scope.context;
        const slot = thumbSlot(arg);
        return [ctx.value, scope.props["disabled"], scope.props["readOnly"], scope.props["invalid"], scope.state, slot.radius ?? 40, slot.needle === true].join(" ");
      },
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const ctx = scope.context;
        const shown = displayAngle(ctx.value, ctx.dir);
        const slot = thumbSlot(arg);
        const ariaLabel = textProp(scope.props["ariaLabel"]);
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
          // Dot mode positions a rim point for markup to center on;
          // needle mode rotates the markup's own centered line instead.
          // Rotation rides with position: same grandfathered geometry.
          style: slot.needle === true ? {
            "--thumb-angle": `${shown}deg`,
            rotate: `${shown}deg`,
          } : {
            "--thumb-angle": `${shown}deg`,
            ...rimPlacement(shown, slot.radius ?? 40),
          },
          onFocus: (): void => {
            scope.send({ type: "THUMB.FOCUS" });
          },
          onBlur: (): void => {
            scope.send({ type: "THUMB.BLUR" });
          },
          onKeydown: (event: KeyboardEvent): void => {
            if (event.defaultPrevented) return;
            const live = scope.context;
            if (!isInteractive(live)) return;
            if (isComposing(event)) return;
            const large = event.shiftKey ? live.largeStep : undefined;
            const keyed = (type: string): boolean => {
              event.preventDefault();
              scope.send({ type, ...(large !== undefined ? { step: large } : {}) });
              focusThumb(scope.id);
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
      sig: (scope: SlotLike<{ readonly value: number }>) => {
        const slot = markerSlot(scope.slot);
        return [slot.value, slot.radius ?? 46, slot.diameter === true, scope.context.value].join(" ");
      },
      attrs: (scope: SlotLike<{ readonly value: number }>) => {
        const slot = markerSlot(scope.slot);
        const context = scope.context;
        const shown = displayAngle(slot.value, context.dir);
        const radius = slot.radius ?? 46;
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
            // Diameter markup centers itself; the bag keeps rotation only.
            // Rim ticks keep point + orientation together (see above).
            ...(slot.diameter === true ? {
              rotate: `${shown}deg`,
            } : {
              ...rimPlacement(shown, radius),
              rotate: `${shown}deg`,
            }),
          },
        };
      },
    },
  },
  commands: {
    setValue: { event: (args) => ({ type: "VALUE.SET", value: typeof args[0] === "number" ? args[0] : 0 }) },
    // The thumb carries no tabindex while disabled or read-only, so a DOM
    // focus then is a harmless no-op — the guard the bridge held.
    focus: {
      view: ({ focus }) => focus("thumb"),
    },
  },
  readers: {
    value: { read: (context) => context.value },
    valueAsDegree: { read: (context) => valueAsDegree(context.value) },
    dragging: { read: (_context, state) => state === "dragging" },
  },
  methods: {
    getMarkers: {
      call: () => MARKERS,
    },
    getMarkerState: {
      call: (context: AngleSliderContext, _state, args) => {
        const value = args[0];
        if (typeof value !== "number" || !Number.isFinite(value)) return "at-value";
        if (value < context.value) return "under-value";
        if (value > context.value) return "over-value";
        return "at-value";
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context: AngleSliderContext) => [context.value],
      detail: (watched: readonly unknown[]) => {
        const value = watched[0];
        const degrees = typeof value === "number" && Number.isFinite(value) ? value : 0;
        return { value: degrees, valueAsDegree: `${degrees}deg` };
      },
    },
    "value-change-end": {
      prop: "onValueChangeEnd",
      on: "commit",
      watch: (context: AngleSliderContext) => [context.value],
      detail: (watched: readonly unknown[]) => {
        const value = watched[0];
        const degrees = typeof value === "number" && Number.isFinite(value) ? value : 0;
        return { value: degrees, valueAsDegree: `${degrees}deg` };
      },
    },
  },
};

export const angleSlider = defineComponent<AngleSliderContext, AngleSliderEvent, AngleSliderApi>(def);
