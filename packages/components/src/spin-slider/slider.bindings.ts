import { defineComponent, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import { isComposing } from "@spin/runtime";
import {
  config,
  implementations,
  initial,
  valuesProp,
  isInteractive,
  percentOf,
  thumbRange,
  valueOfPercent,
  type SliderContext,
  type SliderEvent,
  type SliderFocusChange,
  type SliderValueChange,
  type SliderValueChangeEnd,
  type ThumbCollisionBehavior,
  type SliderInitial,
} from "./slider.machine.ts";

export type { SliderInitial };

/**
 * Slider definition: the DOM contract as data. The machine owns the three
 * phases, the values, the focused index, and the step/collision math; this
 * file maps props to bags, commands to sends,
 * and value/focus transitions to their events. Geometry that needs a node
 * (pointer-to-value measurement, pointer capture, thumb-grab offset, the
 * checked-thumb focus after a keyboard move) lives in the part bags —
 * reported in as stepped values, because the machine never touches the DOM.
 */

export interface SliderApi {
  setValue(value: readonly number[]): void;
  setThumbValue(index: number, value: number): void;
  increment(index?: number): void;
  decrement(index?: number): void;
  focus(): void;
  readonly value: readonly number[];
  readonly markers: readonly number[];
  readonly valueText: string;
  readonly dragging: boolean;
  readonly focused: boolean;
  getThumbValue(index: number): number;
  getThumbPercent(index: number): number;
  getThumbMin(index: number): number;
  getThumbMax(index: number): number;
  getThumbIndexes(): readonly { readonly index: number }[];
  getMarkers(): readonly number[];
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getValueTextProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getMarkerGroupProps(): Record<string, unknown>;
  getMarkerProps(slot: { readonly value: number }): Record<string, unknown>;
  getTrackProps(): Record<string, unknown>;
  getRangeProps(): Record<string, unknown>;
  getThumbProps(slot: { readonly index: number }): Record<string, unknown>;
  getHiddenInputProps(slot: { readonly index: number }): Record<string, unknown>;
}

const isSliderInitial = (raw: unknown): raw is SliderInitial =>
  raw !== null && typeof raw === "object";

type Ctx = SliderContext;

const orientationOf = (props: Record<string, unknown>): string =>
  typeof props["orientation"] === "string" ? props["orientation"] : "horizontal";
const dirOf = (props: Record<string, unknown>): string =>
  typeof props["dir"] === "string" ? props["dir"] : "ltr";

interface ScopeLike extends PartScope<unknown, SliderContext> {}
interface SlotLike<R> extends SlotScope<R, SliderContext> {}
const slotIndex = (slot: unknown): number => typeof slot === "object" && slot !== null && "index" in slot && typeof slot.index === "number" ? slot.index : -1;

/** Marker slots wrap raw values so bags read `{value}` like recipes pass.
 * Memoized on the markers identity: fresh wrappers would re-stamp rows. */
const markerRowsCache = new WeakMap<readonly number[], readonly { readonly value: number }[]>();
const markerRowsOf = (markers: readonly number[]): readonly { readonly value: number }[] => {
  const hit = markerRowsCache.get(markers);
  if (hit !== undefined) return hit;
  const made = markers.map((value) => ({ value }));
  markerRowsCache.set(markers, made);
  return made;
};

/** A client point as a stepped track value, measured off the track node via
 * the runtime focuser/measure (geometry-effect gap recorded). */
const trackValue = (
  scope: ScopeLike,
  orientation: string,
  dir: string,
  context: Ctx,
  clientX: number,
  clientY: number,
): number | null => {
  const rect = scope.measure("track");
  if (rect === null) return null;
  if (orientation === "vertical") {
    const percent = rect.height <= 0 ? 0 : (rect.bottom - clientY) / rect.height;
    return valueOfPercent(context, Math.min(1, Math.max(0, percent)));
  }
  const raw = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
  const percent = dir === "rtl" ? 1 - raw : raw;
  return valueOfPercent(context, Math.min(1, Math.max(0, percent)));
};

/** Thumb slots are a pure function of the thumb count. */
const thumbIndexCache = new Map<number, readonly { readonly index: number }[]>();
const thumbIndexes = (length: number): readonly { readonly index: number }[] => {
  const hit = thumbIndexCache.get(length);
  if (hit !== undefined) return hit;
  const made = Array.from({ length }, (_, index) => ({ index }));
  thumbIndexCache.set(length, made);
  return made;
};

const sameValues = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

type Capturable = Element & { setPointerCapture?: (id: number) => void };
const isCapturable = (value: unknown): value is Capturable => {
  if (!(value instanceof Element) || !("setPointerCapture" in value)) return false;
  const fn: unknown = value.setPointerCapture;
  return typeof fn === "function";
};
const capturePointer = (target: EventTarget | null, pointerId: number): void => {
  if (isCapturable(target)) target.setPointerCapture?.(pointerId);
};

const def: ComponentDef<SliderContext, SliderEvent> = {
  name: "slider",
  config,
  implementations,
  start: "idle",
  seed: (raw, authored) => ({ ...initial(isSliderInitial(raw) ? raw : {}, authored) }),
  scalars: [
    "min",
    "max",
    "step",
    "largeStep",
    "minStepsBetweenThumbs",
    "origin",
    "orientation",
    "thumbCollisionBehavior",
    "disabled",
    "readOnly",
    "invalid",
  ],
  reconcile: ({ context, parsed, authored, send }) => {
    const ctx = context;
    if (authored("value")) {
      const outer = valuesProp(parsed["value"]);
      if (outer !== null && !sameValues(ctx.value, outer)) {
        send({ type: "SET_VALUE", value: [...outer] });
        return true;
      }
    }
    return false;
  },
  commitEvents: ["POINTER_UP", "ARROW_INC", "ARROW_DEC", "HOME", "END", "INCREMENT", "DECREMENT", "SET_VALUE"],
  parts: {
    root: {
      sig: (scope: ScopeLike) => [scope.props["dir"], scope.props["orientation"], scope.props["disabled"], scope.props["invalid"], scope.state].join("|"),
      attrs: (scope: ScopeLike) => ({
        id: scope.id(""),
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "root",
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-orientation": scope.props["orientation"],
        "data-dragging": scope.attr(scope.state === "dragging"),
        "data-invalid": scope.attr(scope.props["invalid"] === true),
        "data-focus": scope.attr(scope.state === "focus"),
      }),
    },
    label: {
      sig: (scope: ScopeLike) => [scope.props["label"], scope.props["disabled"], scope.props["orientation"]].join("|"),
      attrs: (scope: ScopeLike) => ({
        id: scope.id("label"),
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "label",
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-orientation": scope.props["orientation"],
        "data-invalid": scope.attr(scope.props["invalid"] === true),
        "data-dragging": scope.attr(scope.state === "dragging"),
        "data-focus": scope.attr(scope.state === "focus"),
        for: scope.id("input", 0),
        style: { userSelect: "none" },
        onClick: (event: MouseEvent) => {
          if (!isInteractive(scope.context)) return;
          event.preventDefault();
          scope.send({ type: "FOCUS", index: Math.max(0, scope.context.focusedIndex) });
        },
      }),
    },
    valueText: {
      id: "value-text",
      sig: (scope: ScopeLike) => [scope.context.value.join(","), scope.props["disabled"], scope.props["orientation"], scope.props["invalid"], scope.state].join("|"),
      attrs: (scope: ScopeLike) => ({
        id: scope.id("valueText"),
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "value-text",
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-orientation": scope.props["orientation"],
        "data-invalid": scope.attr(scope.props["invalid"] === true),
        "data-focus": scope.attr(scope.state === "focus"),
      }),
    },
    control: {
      sig: (scope: ScopeLike) => [scope.props["disabled"], scope.props["orientation"], scope.props["invalid"], scope.state].join("|"),
      attrs: (scope: ScopeLike) => {
        const trackId = scope.id("track");
        return {
          id: scope.id("control"),
          dir: scope.props["dir"],
          "data-scope": "slider",
          "data-part": "control",
          "data-dragging": scope.attr(scope.state === "dragging"),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-orientation": scope.props["orientation"],
          "data-invalid": scope.attr(scope.props["invalid"] === true),
          "data-focus": scope.attr(scope.state === "focus"),
          style: { position: "relative", touchAction: "none" },
          onPointerdown: (event: PointerEvent) => {
            const context = scope.context;
            if (!isInteractive(context)) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const value = trackValue(scope, orientationOf(scope.props), dirOf(scope.props), context, event.clientX, event.clientY);
            if (value === null) return;
            event.preventDefault();
            event.stopPropagation();
            // Capture the pointer: a release off the track must still end
            // the drag, or the phase strands in dragging and later keys
            // silently no-op (the cropper's stranded-dragging lesson).
            capturePointer(event.currentTarget, event.pointerId);
            scope.send({ type: "POINTER_DOWN", pointValue: value });
          },
          onPointermove: (event: PointerEvent) => {
            if (scope.state !== "dragging") return;
            const value = trackValue(scope, orientationOf(scope.props), dirOf(scope.props), scope.context, event.clientX, event.clientY);
            if (value === null) return;
            scope.send({ type: "POINTER_MOVE", pointValue: value });
          },
          onPointerup: () => {
            if (scope.state !== "dragging") return;
            scope.send({ type: "POINTER_UP" });
          },
        };
      },
    },
    track: {
      sig: (scope: ScopeLike) => [scope.props["disabled"], scope.props["invalid"], scope.props["orientation"], scope.state].join("|"),
      attrs: (scope: ScopeLike) => ({
        id: scope.id("track"),
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "track",
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-invalid": scope.attr(scope.props["invalid"] === true),
        "data-dragging": scope.attr(scope.state === "dragging"),
        "data-orientation": scope.props["orientation"],
        "data-focus": scope.attr(scope.state === "focus"),
        style: { position: "relative" },
      }),
    },
    range: {
      sig: (scope: ScopeLike) => [scope.context.value.join(","), scope.props["orientation"], scope.props["disabled"], scope.props["invalid"], scope.state].join("|"),
      attrs: (scope: ScopeLike) => {
        const context = scope.context;
        const percents = context.value.map((value) => percentOf(context, value));
        const origin = scope.props["origin"];
        // Single-thumb ranges start at the origin edge, not the thumb: a
        // lone 50% value fills 0-50 (tark basic), not a zero-width band.
        const single = percents.length < 2;
        const low = single && origin === "start" ? 0 : Math.min(...percents);
        const high = single && origin === "end" ? 100 : Math.max(...percents);
        const vertical = scope.props["orientation"] === "vertical";
        return {
          id: scope.id("range"),
          dir: scope.props["dir"],
          "data-scope": "slider",
          "data-part": "range",
          "data-dragging": scope.attr(scope.state === "dragging"),
          "data-focus": scope.attr(scope.state === "focus"),
          "data-invalid": scope.attr(scope.props["invalid"] === true),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-orientation": scope.props["orientation"],
          style: vertical
            ? { bottom: `${low}%`, height: `calc(${high}% - ${low}%)` }
            : { left: `${low}%`, width: `calc(${high}% - ${low}%)` },
        };
      },
    },
    markerGroup: {
      id: "marker-group",
      sig: (scope: ScopeLike) => [`${scope.props["dir"]}`].join(" "),
      attrs: (scope: ScopeLike) => ({
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "marker-group",
      }),
    },
  },
  slots: {
    thumb: {
      indexes: (context: SliderContext) => thumbIndexes(context.value.length),
      sig: (scope: SlotLike<{ readonly index: number }>) => {
        const context = scope.context;
        const value = context.value[slotIndex(scope.slot)] ?? context.min;
        return [value, context.focusedIndex, scope.state, scope.props["disabled"], scope.props["orientation"], scope.props["dir"]].join("|");
      },
      attrs: (scope: SlotLike<{ readonly index: number }>) => {
        const context = scope.context;
        const value = context.value[slotIndex(scope.slot)] ?? context.min;
        const range = thumbRange(context, slotIndex(scope.slot));
        const percent = percentOf(context, value);
        const focused = scope.state === "focus" && context.focusedIndex === slotIndex(scope.slot);
        const dragging = scope.state === "dragging" && context.focusedIndex === slotIndex(scope.slot);
        const vertical = scope.props["orientation"] === "vertical";
        return {
          id: scope.id("thumb", slotIndex(scope.slot)),
          dir: scope.props["dir"],
          "data-scope": "slider",
          "data-part": "thumb",
          "data-index": String(slotIndex(scope.slot)),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-orientation": scope.props["orientation"],
          "data-focus": scope.attr(focused),
          "data-dragging": scope.attr(dragging),
          draggable: "false",
          "aria-disabled": scope.props["disabled"] === true ? "true" : undefined,
          "aria-orientation": scope.props["orientation"],
          "aria-valuemax": String(range.max),
          "aria-valuemin": String(range.min),
          "aria-valuenow": String(value),
          role: "slider",
          tabindex: scope.props["disabled"] === true ? undefined : "0",
          style: vertical
            ? { bottom: `${percent}%` }
            : { [(scope.props["dir"] === "rtl") ? "right" : "left"]: `${percent}%` },
          onPointerdown: (event: PointerEvent) => {
            if (!isInteractive(scope.context)) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            const target = event.currentTarget instanceof Element ? event.currentTarget : null;
            const rect = target?.getBoundingClientRect?.();
            const midpoint = rect !== undefined
              ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
              : null;
            event.stopPropagation();
            capturePointer(event.currentTarget, event.pointerId);
            scope.send({
              type: "THUMB_POINTER_DOWN",
              index: slotIndex(scope.slot),
              offset: midpoint === null
                ? undefined
                : (vertical ? event.clientY - midpoint.y : event.clientX - midpoint.x),
            });
          },
          onPointermove: (event: PointerEvent) => {
            if (scope.state !== "dragging") return;
            const value = trackValue(scope, orientationOf(scope.props), dirOf(scope.props), scope.context, event.clientX, event.clientY);
            if (value === null) return;
            scope.send({ type: "POINTER_MOVE", pointValue: value });
          },
          onPointerup: () => {
            if (scope.state !== "dragging") return;
            scope.send({ type: "POINTER_UP" });
          },
          onBlur: () => {
            if (!isInteractive(scope.context)) return;
            scope.send({ type: "BLUR" });
          },
          onFocus: () => {
            if (!isInteractive(scope.context)) return;
            scope.send({ type: "FOCUS", index: slotIndex(scope.slot) });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (!isInteractive(scope.context)) return;
            if (isComposing(event)) return;
            // Parsed, not raw: largeStep defaults to 10x step in the
            // channel parse, which raw props never see.
            const large = event.shiftKey ? scope.context.largeStep : undefined;
            const keyed = (type: string): boolean => {
              event.preventDefault();
              event.stopPropagation();
              scope.send({ type, step: large });
          // focus handled by settled hook (geometry-effect gap recorded)
              return true;
            };
            const horizontal = scope.context.orientation === "horizontal";
            switch (event.key) {
              case "ArrowUp":
                if (!horizontal) keyed("ARROW_INC");
                break;
              case "ArrowDown":
                if (!horizontal) keyed("ARROW_DEC");
                break;
              case "ArrowLeft":
                if (horizontal) keyed((scope.props["dir"] === "rtl") ? "ARROW_INC" : "ARROW_DEC");
                break;
              case "ArrowRight":
                if (horizontal) keyed((scope.props["dir"] === "rtl") ? "ARROW_DEC" : "ARROW_INC");
                break;
              case "PageUp":
                keyed("ARROW_INC");
                break;
              case "PageDown":
                keyed("ARROW_DEC");
                break;
              case "Home":
                keyed("HOME");
                break;
              case "End":
                keyed("END");
                break;
              default:
                break;
            }
          },
        };
      },
    },
    marker: {
      indexes: (context: SliderContext) => markerRowsOf(context.markers),
      sig: (scope: SlotLike<{ readonly value: number }>) => {
        const slot = scope.slot;
        return [slot.value, scope.context.value.join(",")].join(" ");
      },
      attrs: (scope: SlotLike<{ readonly value: number }>) => {
        const slot = scope.slot;
        const context = scope.context;
        const percent = percentOf(context, slot.value);
        const first = context.value[0] ?? context.min;
        const state = slot.value < first ? "under-value" : slot.value > first ? "over-value" : "at-value";
        const vertical = scope.props["orientation"] === "vertical";
        return {
          id: scope.id("marker", slot.value),
          dir: scope.props["dir"],
          "data-scope": "slider",
          "data-part": "marker",
          "data-value": String(slot.value),
          "data-state": state,
          "data-orientation": scope.props["orientation"],
          style: vertical
            ? { bottom: `${percent}%` }
            : { left: `${percent}%` },
        };
      },
    },
    hiddenInput: {
      id: "input",
      indexes: (context: SliderContext) => context.value.map((_, index) => ({ index })),
      sig: (scope: ScopeLike) => [scope.props["name"], scope.context.value[slotIndex(scope.slot)], slotIndex(scope.slot)].join("|"),
      attrs: (scope: ScopeLike) => {
        const context = scope.context;
        const value = context.value[slotIndex(scope.slot)] ?? context.min;
        const name = typeof scope.props["name"] === "string" ? scope.props["name"] : "";
        return {
          id: scope.id("input", slotIndex(scope.slot)),
          name: name.length > 0 ? (context.value.length > 1 ? `${name}[]` : name) : undefined,
          form: undefined,
          type: "text",
          hidden: true,
          value: String(value),
        };
      },
    },
  },
  commands: {
    setValue: { event: (args: readonly unknown[]) => { const v = args[0]; return { type: "SET_VALUE", value: Array.isArray(v) ? v.map((x) => typeof x === "number" ? x : 0) : [] }; }, },
    setThumbValue: {
      event: (args: readonly unknown[], context) => {
        const next = [...context.value];
        const i = args[0];
        const v = args[1];
        if (typeof i !== "number" || typeof v !== "number") return { type: "SET_VALUE", value: next };
        next[Math.trunc(i)] = v;
        return { type: "SET_VALUE", value: next, index: Math.trunc(i) };
      },
    },
    increment: { event: (args: readonly unknown[]) => { const i = args[0]; return { type: "INCREMENT", index: typeof i === "number" ? Math.trunc(i) : undefined }; } },
    decrement: { event: (args: readonly unknown[]) => { const i = args[0]; return { type: "DECREMENT", index: typeof i === "number" ? Math.trunc(i) : undefined }; } },
    focus: { event: () => ({ type: "FOCUS", index: 0 }) },
  },
  readers: {
    value: { read: (context) => context.value },
    markers: { read: (context) => context.markers },
    valueText: { read: (context) => context.value.join(", ") },
    dragging: { read: (_context, state) => state === "dragging" },
    focused: { read: (_context, state) => state === "focus" },
  },
  methods: {
    getThumbValue: {
      call: (context, _state, args) => {
        const i = args[0];
        return typeof i === "number" ? context.value[Math.trunc(i)] ?? context.min : context.min;
      },
    },
    getThumbPercent: {
      call: (context: SliderContext, _state, args) => {
        const i = args[0];
        return percentOf(context, typeof i === "number" ? context.value[Math.trunc(i)] ?? context.min : context.min);
      },
    },
    getThumbMin: {
      call: (context: SliderContext, _state, args) => {
        const i = args[0];
        return thumbRange(context, typeof i === "number" ? Math.trunc(i) : 0).min;
      },
    },
    getThumbMax: {
      call: (context: SliderContext, _state, args) => {
        const i = args[0];
        return thumbRange(context, typeof i === "number" ? Math.trunc(i) : 0).max;
      },
    },
    getMarkers: {
      call: (context) => context.markers,
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [...context.value],
      detail: (watched: readonly number[]) => ({ value: [...watched] }),
    },
    "value-change-end": {
      prop: "onValueChangeEnd",
      on: "commit",
      watch: (context) => [...context.value],
      detail: (watched: readonly number[]) => ({ value: [...watched] }),
    },
    "focus-change": {
      prop: "onFocusChange",
      watch: (context) => [context.focusedIndex, ...context.value],
      detail: (watched: readonly [number, ...number[]]) => ({
        focusedIndex: watched[0],
        value: [...watched.slice(1)],
      }),
    },
  },
  settled: ({ event, after, focus }) => {
    if (
      event.type !== "ARROW_INC" &&
      event.type !== "ARROW_DEC" &&
      event.type !== "HOME" &&
      event.type !== "END" &&
      event.type !== "INCREMENT" &&
      event.type !== "DECREMENT"
    )
      return;
    const idx = after.context.focusedIndex;
    if (idx >= 0) focus("thumb", idx);
  },
};
export const slider = defineComponent<SliderContext, SliderEvent, SliderApi>(def);
