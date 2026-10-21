import { ariaDisabled, ariaOrientation, defineComponent, factAttrs, sliderThumb, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import { isComposing } from "@spin/runtime";
import type { DragDelta, DragPress } from "@spin/runtime/actions";
import {
  isInteractive,
  percentOf,
  slider as sliderMachine,
  thumbRange,
  valueOfPercent,
  type SliderArgs,
  type SliderContext,
  type SliderEvents,
  type SliderFocusChange,
  type SliderValueChange,
  type SliderValueChangeEnd,
  type ThumbCollisionBehavior,
} from "./slider.machine.ts";

export type { SliderArgs };

/** Slider definition: the DOM contract as data. */

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
  getThumbIndexes(): readonly number[];
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

type Ctx = SliderContext;

const orientationOf = (props: Record<string, unknown>): string =>
  typeof props["orientation"] === "string" ? props["orientation"] : "horizontal";
const dirOf = (props: Record<string, unknown>): string =>
  typeof props["dir"] === "string" ? props["dir"] : "ltr";

interface ScopeLike extends PartScope<unknown, SliderContext> {}
interface SlotLike<R> extends SlotScope<R, SliderContext> {}
/** The slot's index: the recipe passes the index itself, but a wrapped
 * `{ index }` is the other spelling a recipe may use. */
const slotIndex = (slot: unknown): number => {
  if (typeof slot === "number" && Number.isInteger(slot)) return slot;
  if (typeof slot === "object" && slot !== null && "index" in slot) {
    const index: unknown = slot.index;
    if (typeof index === "number" && Number.isInteger(index)) return index;
  }
  return -1;
};

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

/** A client point as a stepped track value, measured off the track node. */
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

const thumbIndexCache = new Map<number, readonly number[]>();
/** The thumb slots, as plain indices: the recipe wraps each one
 * (`{ index: row }`) and the wrapper is the slot's identity — a WeakMap
 * key, so it must be an object.
 */
const thumbIndexes = (length: number): readonly number[] => {
  const hit = thumbIndexCache.get(length);
  if (hit !== undefined) return hit;
  const made = Array.from({ length }, (_, index) => index);
  thumbIndexCache.set(length, made);
  return made;
};

/** The component's public state: the names the markup may key on. */
export const facts = {
  disabled: (scope: ScopeLike) => scope.props["disabled"] === true,
  orientation: (scope: ScopeLike) => scope.props["orientation"],
  dragging: (scope: ScopeLike) => scope.state === "dragging",
  invalid: (scope: ScopeLike) => scope.props["invalid"] === true,
  focus: (scope: ScopeLike) => scope.state === "focus",
};

const def: ComponentDef<SliderContext, SliderEvents> = {
  name: "slider",
  machine: (props, authored) => sliderMachine(props as SliderArgs, authored),
  start: "idle",
  commitEvents: ["POINTER_UP", "ARROW_INC", "ARROW_DEC", "HOME", "END", "INCREMENT", "DECREMENT", "SET_VALUE"],
  parts: {
    root: {
      attrs: (scope: ScopeLike) => ({
        id: scope.id(""),
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "root",
        ...factAttrs(scope, facts, "disabled", "orientation", "dragging", "invalid", "focus"),
      }),
    },
    label: {
      attrs: (scope: ScopeLike) => ({
        id: scope.id("label"),
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "label",
        ...factAttrs(scope, facts, "disabled", "orientation", "dragging", "invalid", "focus"),
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
      attrs: (scope: ScopeLike) => ({
        id: scope.id("valueText"),
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "value-text",
        ...factAttrs(scope, facts, "disabled", "orientation", "invalid", "focus"),
      }),
    },
    control: {
      attrs: (scope: ScopeLike) => {
        const trackId = scope.id("track");
        return {
          id: scope.id("control"),
          dir: scope.props["dir"],
          "data-scope": "slider",
          "data-part": "control",
          ...factAttrs(scope, facts, "disabled", "orientation", "dragging", "invalid", "focus"),
          style: { position: "relative", touchAction: "none" },
          // The track's gesture: the runtime's drag action owns the press,
          // the capture and the moves. A release off the track still ends
          // the drag, or the phase would strand in dragging.
          "use:drag": {
            // A disabled or read-only slider never arms.
            enabled: isInteractive(scope.context),
            // The press cancels its default.
            preventDefault: true,
            // The press does not reach the control's ancestors.
            stopPropagation: true,
            // Escape has no path here: it does nothing.
            cancelOnEscape: false,
            onStart: (press: DragPress): void => {
              const context = scope.context;
              if (press.metaKey || press.ctrlKey || press.altKey) return;
              const value = trackValue(scope, orientationOf(scope.props), dirOf(scope.props), context, press.x, press.y);
              if (value === null) return;
              scope.send({ type: "POINTER_DOWN", pointValue: value });
            },
            onMove: (delta: DragDelta): void => {
              if (scope.state !== "dragging") return;
              const value = trackValue(scope, orientationOf(scope.props), dirOf(scope.props), scope.context, delta.x, delta.y);
              if (value === null) return;
              scope.send({ type: "POINTER_MOVE", pointValue: value });
            },
            onEnd: (): void => {
              if (scope.state !== "dragging") return;
              scope.send({ type: "POINTER_UP" });
            },
          },
        };
      },
    },
    track: {
      attrs: (scope: ScopeLike) => ({
        id: scope.id("track"),
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "track",
        ...factAttrs(scope, facts, "disabled", "orientation", "dragging", "invalid", "focus"),
        style: { position: "relative" },
      }),
    },
    range: {
      attrs: (scope: ScopeLike) => {
        const context = scope.context;
        const percents = context.value.map((value) => percentOf(context, value));
        const origin = scope.props["origin"];
        // Single-thumb ranges start at the origin edge, not the thumb: a
        // lone 50% value fills 0-50, not a zero-width band.
        const single = percents.length < 2;
        const low = single && origin === "start" ? 0 : Math.min(...percents);
        const high = single && origin === "end" ? 100 : Math.max(...percents);
        const vertical = scope.props["orientation"] === "vertical";
        return {
          id: scope.id("range"),
          dir: scope.props["dir"],
          "data-scope": "slider",
          "data-part": "range",
          ...factAttrs(scope, facts, "disabled", "orientation", "dragging", "invalid", "focus"),
          style: vertical
            ? { bottom: `${low}%`, height: `calc(${high}% - ${low}%)` }
            : { left: `${low}%`, width: `calc(${high}% - ${low}%)` },
        };
      },
    },
    markerGroup: {
      id: "marker-group",
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
      attrs: (scope: SlotLike<{ readonly index: number }>) => {
        const context = scope.context;
        const value = context.value[slotIndex(scope.slot)] ?? context.min;
        const range = thumbRange(context, slotIndex(scope.slot));
        const percent = percentOf(context, value);
        const focused = scope.state === "focus" && context.focusedIndex === slotIndex(scope.slot);
        const dragging = scope.state === "dragging" && context.focusedIndex === slotIndex(scope.slot);
        const vertical = scope.props["orientation"] === "vertical";
        const orientation = scope.props["orientation"];
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
          ...ariaDisabled(scope.props["disabled"] === true ? "true" : undefined),
          ...ariaOrientation(
            orientation === "horizontal" || orientation === "vertical"
              ? orientation
              : undefined,
          ),
          ...sliderThumb({
            max: String(range.max),
            min: String(range.min),
            now: String(value),
          }),
          role: "slider",
          tabindex: scope.props["disabled"] === true ? undefined : "0",
          style: vertical
            ? { bottom: `${percent}%` }
            : { [(scope.props["dir"] === "rtl") ? "right" : "left"]: `${percent}%` },
          // The thumb's own gesture: its press stops there, so the
          // control's gesture never arms behind it.
          "use:drag": {
            // A disabled or read-only slider never arms.
            enabled: isInteractive(scope.context),
            // The press keeps its default: the browser still focuses the
            // thumb.
            preventDefault: false,
            // The press does not reach the control, so the control's
            // gesture never sees it.
            stopPropagation: true,
            // Escape has no path here: it does nothing.
            cancelOnEscape: false,
            onStart: (press: DragPress): void => {
              // The grab offset is measured against the thumb's midpoint,
              // so the thumb does not jump under the pointer.
              const rect = press.rect;
              const midpoint = rect === null
                ? null
                : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
              scope.send({
                type: "THUMB_POINTER_DOWN",
                index: slotIndex(scope.slot),
                offset: midpoint === null
                  ? undefined
                  : (vertical ? press.y - midpoint.y : press.x - midpoint.x),
              });
            },
            onMove: (delta: DragDelta): void => {
              if (scope.state !== "dragging") return;
              const value = trackValue(scope, orientationOf(scope.props), dirOf(scope.props), scope.context, delta.x, delta.y);
              if (value === null) return;
              scope.send({ type: "POINTER_MOVE", pointValue: value });
            },
            onEnd: (): void => {
              if (scope.state !== "dragging") return;
              scope.send({ type: "POINTER_UP" });
            },
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
    increment: { event: (args: readonly unknown[]) => { const i = args[0]; return typeof i === "number" ? { type: "INCREMENT", index: Math.trunc(i) } : { type: "INCREMENT" }; } },
    decrement: { event: (args: readonly unknown[]) => { const i = args[0]; return typeof i === "number" ? { type: "DECREMENT", index: Math.trunc(i) } : { type: "DECREMENT" }; } },
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
export const slider = defineComponent<SliderContext, SliderEvents, SliderApi>(def);
