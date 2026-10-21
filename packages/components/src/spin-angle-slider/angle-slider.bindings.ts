import { ariaLabelledBy, dataAttr, defineComponent, factAttrs, focuser, isComposing, sliderThumb, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import type { DragDelta, DragPress } from "@spin/runtime/actions";
import {
  angleSlider as angleSliderMachine,
  displayAngle,
  isInteractive,
  valueAsDegree,
  type AngleSliderArgs,
  type AngleSliderContext,
  type AngleSliderEvents,
  type AngleSliderValueChange,
} from "./angle-slider.machine.ts";

/**
 * Angle-slider definition: the DOM contract as data.
 *
 * Everything that needs a node lives here — the pointer-to-angle
 * measurement, the thumb-over test for relative drags, and the thumb focus
 * after a press. The gesture itself (the arming, the pointer capture, the
 * release) is the runtime's `drag` action.
 */

export interface AngleSliderMarkerSlotProps {
  readonly value: number;
  /**
   * Rim radius in dial-percent (50 = the control edge). The def cannot know
   * the dial's drawn geometry, so the usage says.
   */
  readonly radius?: number;
  /**
   * Diameter mode: the marker is a full-diameter line the markup centers and
   * rotates itself, so the bag keeps rotation and skips position.
   */
  readonly diameter?: boolean;
}

export interface AngleSliderThumbSlotProps {
  readonly radius?: number;
  /**
   * Needle mode: the thumb is a full-diameter indicator line rotated to the
   * value, not a dot on the rim, so the bag emits rotation without a rim
   * point.
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

interface ScopeLike extends PartScope<unknown, AngleSliderContext> {}

interface SlotLike<R> extends SlotScope<R, AngleSliderContext> {}

const MARKERS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Rim placement: dial degrees (zero top, clockwise) to a center-based
 * left/top pair on a 100-unit dial. */
const rimPlacement = (angle: number, radius: number): { left: string; top: string } => {
  const radians = ((angle - 90) * Math.PI) / 180;
  const left = 50 + radius * Math.cos(radians);
  const top = 50 + radius * Math.sin(radians);
  return { left: `${left}%`, top: `${top}%` };
};

const textProp = (raw: unknown): string => typeof raw === "string" ? raw : "";

/** A marker's slot may be the bare index, whose number is the value. */
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

/** The thumb's optional slot arg carries the recipe's per-usage geometry. */
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

const rawAngle = (scope: ScopeLike, clientX: number, clientY: number): number | null => {
  const rect = scope.measure("control");
  if (rect === null) return null;
  return pointAngle(rect.left + rect.width / 2, rect.top + rect.height / 2, clientX, clientY);
};

/** Whether the press landed on the thumb — the press target carries its own
 * id, so no node lookup. */
const overThumb = (scope: ScopeLike, target: EventTarget | null): boolean => {
  if (target === null || !(target instanceof Element)) return false;
  const thumbId = scope.id("thumb");
  return target.id === thumbId || target.closest(`[id="${thumbId}"]`) !== null;
};

/** Focus lives in the view: a press or a keyboard move hands focus to the
 * thumb. */

/** The component's public state: the names the markup may key on. */
export const facts = {
  disabled: (scope: ScopeLike) => scope.props["disabled"] === true,
  invalid: (scope: ScopeLike) => scope.props["invalid"] === true,
  readonly: (scope: ScopeLike) => scope.props["readOnly"] === true,
};

const def: ComponentDef<AngleSliderContext, AngleSliderEvents> = {
  name: "angle-slider",
  machine: (props, authored) => angleSliderMachine(props as AngleSliderArgs, authored),
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
      attrs: (scope) => {
        return {
          id: scope.id(""),
          dir: scope.props["dir"],
          "data-scope": "angle-slider",
          "data-part": "root",
          ...factAttrs(scope, facts, "disabled", "invalid", "readonly"),
        };
      },
    },
    label: {
      attrs: (scope) => ({
        id: scope.id("label"),
        dir: scope.props["dir"],
        "data-scope": "angle-slider",
        "data-part": "label",
        ...factAttrs(scope, facts, "disabled", "invalid", "readonly"),
        for: scope.id("hiddenInput"),
        onClick: (event: MouseEvent): void => {
          if (!isInteractive(scope.context)) return;
          event.preventDefault();
          focuser(scope.id)("thumb");
        },
      }),
    },
    hiddenInput: {
      id: "hidden-input",
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
      attrs: (scope) => ({
        id: scope.id("control"),
        role: "presentation",
        dir: scope.props["dir"],
        "data-scope": "angle-slider",
        "data-part": "control",
        ...factAttrs(scope, facts, "disabled", "invalid", "readonly"),
        style: { position: "relative", touchAction: "none", userSelect: "none" },
        // The dial's gesture is the runtime's: the press arms it, the moves
        // report where the pointer is on the dial, the release commits.
        "use:drag": {
          // A disabled or read-only dial never arms.
          enabled: isInteractive(scope.context),
          // The press keeps its default: the dial is a plain surface.
          preventDefault: false,
          // The press does not reach the dial's ancestors.
          stopPropagation: true,
          // No escape path here: Escape does nothing.
          cancelOnEscape: false,
          onStart: (press: DragPress): void => {
            const ctx = scope.context;
            const angle = rawAngle(scope, press.x, press.y);
            if (angle === null) return;
            // A press on the thumb drags relative (grab offset); elsewhere
            // the dial jumps to the pointer.
            const angularOffset = overThumb(scope, press.target) ? angle - ctx.value : null;
            scope.send({ type: "CONTROL.POINTER_DOWN", rawAngle: angle, angularOffset });
            focuser(scope.id)("thumb");
          },
          onMove: (delta: DragDelta): void => {
            if (scope.state !== "dragging") return;
            const angle = rawAngle(scope, delta.x, delta.y);
            if (angle === null) return;
            scope.send({ type: "DOC.POINTER_MOVE", rawAngle: angle });
          },
          onEnd: (): void => {
            if (scope.state !== "dragging") return;
            scope.send({ type: "DOC.POINTER_UP" });
          },
        },
      }),
    },
    thumb: {
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
          ...ariaLabelledBy(scope, ariaLabel.length > 0 ? undefined : { part: "label" }),
          ...sliderThumb({
            max: "360",
            min: "0",
            now: String(ctx.value),
          }),
          tabindex: scope.props["readOnly"] === true || isInteractive(ctx) ? "0" : undefined,
          "data-scope": "angle-slider",
          "data-part": "thumb",
          ...factAttrs(scope, facts, "disabled", "invalid", "readonly"),
          // Dot mode positions a rim point for markup to center on; needle
          // mode rotates the markup's own centered line instead.
          style: slot.needle === true ? {
            rotate: `${shown}deg`,
          } : {
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
              focuser(scope.id)("thumb");
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
            // Diameter markup centers itself; the bag keeps rotation only.
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
    // focus then is a harmless no-op.
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

export const angleSlider = defineComponent<AngleSliderContext, AngleSliderEvents, AngleSliderApi>(def);
