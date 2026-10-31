import {
  type ApiOf,
  ariaDisabled,
  ariaOrientation,
  type ComponentDef,
  defineComponent,
  isComposing,
  isInteractive,
  type ViewFor,
  sliderThumb,
  type SlotViewFor,
} from "@spinjs/runtime";
import type { DragDelta, DragPress } from "@spinjs/runtime/actions";
import { slider as sliderMachine } from "./slider.machine.ts";
import {
  percentOf,
  type SliderArgs,
  type SliderContext,
  type SliderState,
  type ThumbCollisionBehavior,
  thumbRange,
  valueOfPercent,
} from "./slider.state.ts";
import type { SliderEvents } from "./slider.events.ts";

export type { SliderArgs, SliderState, ThumbCollisionBehavior };

/** Slider definition: the DOM contract as data. */

type Ctx = SliderContext;
type ScopeLike = ViewFor<SliderContext, SliderEvents, SliderState>;
type SlotLike<R> = SlotViewFor<R, SliderContext, SliderEvents, SliderState>;

/** A client point as a stepped track value, measured off the track node. */
const trackValue = (
  measure: (part: string) => DOMRect | null,
  orientation: string,
  dir: string,
  context: Ctx,
  clientX: number,
  clientY: number,
): number | null => {
  const rect = measure("track");
  if (rect === null) return null;
  if (orientation === "vertical") {
    const percent = rect.height <= 0
      ? 0
      : (rect.bottom - clientY) / rect.height;
    return valueOfPercent(context, Math.min(1, Math.max(0, percent)));
  }
  const raw = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
  const percent = dir === "rtl" ? 1 - raw : raw;
  return valueOfPercent(context, Math.min(1, Math.max(0, percent)));
};

const thumbIndexCache = new Map<number, readonly number[]>();
/** The thumb slots, as plain indices: primitives memoize by value, so a
 * fresh inline literal hits the same cache entry.
 */
const thumbIndexes = (length: number): readonly number[] => {
  const hit = thumbIndexCache.get(length);
  if (hit !== undefined) return hit;
  const made = Array.from({ length }, (_, index) => index);
  thumbIndexCache.set(length, made);
  return made;
};

export const def = {
  name: "slider",
  machine: (args: SliderArgs, authored) => sliderMachine(args, authored),
  start: "idle",
  commitEvents: [
    "POINTER_UP",
    "ARROW_INC",
    "ARROW_DEC",
    "HOME",
    "END",
    "INCREMENT",
    "DECREMENT",
    "SET_VALUE",
  ],
  parts: {
    root: {},
    label: {
      attrs: (scope: ScopeLike) => ({
        for: scope.id("input", 0),
        style: { userSelect: "none" },
        onClick: (event: MouseEvent) => {
          if (!isInteractive(scope.context)) return;
          event.preventDefault();
          scope.send({
            type: "FOCUS",
            index: Math.max(0, scope.context.focusedIndex),
          });
        },
      }),
    },
    valueText: { id: "value-text" },
    control: {
      attrs: (scope: ScopeLike) => ({
        style: { position: "relative", touchAction: "none" },
        "use:drag": {
          enabled: isInteractive(scope.context),
          preventDefault: true,
          stopPropagation: true,
          cancelOnEscape: false,
          onStart: (press: DragPress): void => {
            const context = scope.context;
            if (press.metaKey || press.ctrlKey || press.altKey) return;
            const value = trackValue(
              scope.measure,
              context.orientation,
              press.direction,
              context,
              press.x,
              press.y,
            );
            if (value === null) return;
            scope.send({ type: "POINTER_DOWN", pointValue: value });
          },
          onMove: (delta: DragDelta): void => {
            if (scope.state !== "dragging") return;
            const value = trackValue(
              scope.measure,
              scope.context.orientation,
              delta.direction,
              scope.context,
              delta.x,
              delta.y,
            );
            if (value === null) return;
            scope.send({ type: "POINTER_MOVE", pointValue: value });
          },
          onEnd: (): void => {
            if (scope.state !== "dragging") return;
            scope.send({ type: "POINTER_UP" });
          },
        },
      }),
    },
    track: {
      attrs: () => ({
        style: { position: "relative" },
      }),
    },
    range: {
      attrs: (scope: ScopeLike) => {
        const context = scope.context;
        const percents = context.value.map((value) =>
          percentOf(context, value)
        );
        const origin = context.origin;
        // Single-thumb ranges start at the origin edge, not the thumb: a
        // lone 50% value fills 0-50, not a zero-width band.
        const single = percents.length < 2;
        const low = single && origin === "start" ? 0 : Math.min(...percents);
        const high = single && origin === "end" ? 100 : Math.max(...percents);
        const vertical = context.orientation === "vertical";
        return {
          style: vertical
            ? { bottom: `${low}%`, height: `calc(${high}% - ${low}%)` }
            : {
              insetInlineStart: `${low}%`,
              width: `calc(${high}% - ${low}%)`,
            },
        };
      },
    },
    markerGroup: { id: "marker-group" },
  },
  slots: {
    thumb: {
      indexes: (context: SliderContext) => thumbIndexes(context.value.length),
      attrs: (scope: SlotLike<number>) => {
        const context = scope.context;
        const value = context.value[scope.slot] ?? context.min;
        const range = thumbRange(context, scope.slot);
        const percent = percentOf(context, value);
        const vertical = context.orientation === "vertical";
        const orientation = context.orientation;
        return {
          id: scope.id("thumb", scope.slot),
          "data-index": String(scope.slot),
          draggable: "false",
          ...ariaDisabled(context.disabled ? "true" : undefined),
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
          tabindex: context.disabled ? undefined : "0",
          style: vertical
            ? { bottom: `${percent}%` }
            : { insetInlineStart: `${percent}%` },
          "use:drag": {
            enabled: isInteractive(scope.context),
            preventDefault: false,
            stopPropagation: true,
            cancelOnEscape: false,
            onStart: (): void => {
              scope.send({
                type: "THUMB_POINTER_DOWN",
                index: scope.slot,
              });
            },
            onMove: (delta: DragDelta): void => {
              if (scope.state !== "dragging") return;
              const value = trackValue(
                scope.measure,
                scope.context.orientation,
                delta.direction,
                scope.context,
                delta.x,
                delta.y,
              );
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
            scope.send({ type: "FOCUS", index: scope.slot });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (!isInteractive(scope.context)) return;
            if (isComposing(event)) return;
            // Parsed, not raw: largeStep defaults to 10x step in the
            // channel parse, which raw props never see.
            const large = event.shiftKey ? scope.context.largeStep : undefined;
            const keyed = (
              type: "ARROW_INC" | "ARROW_DEC" | "HOME" | "END",
            ): boolean => {
              event.preventDefault();
              event.stopPropagation();
              scope.send(
                large !== undefined &&
                  (type === "ARROW_INC" || type === "ARROW_DEC")
                  ? { type, step: large }
                  : { type },
              );
              return true;
            };
            const horizontal = scope.context.orientation === "horizontal";
            // Direction is platform truth, read at event time from the
            // element that received the key — never stored, never a prop.
            const rtl = (event.target instanceof Element) &&
              event.target.ownerDocument?.defaultView?.getComputedStyle(
                  event.target,
                ).direction === "rtl";
            switch (event.key) {
              case "ArrowUp":
                if (!horizontal) keyed("ARROW_INC");
                break;
              case "ArrowDown":
                if (!horizontal) keyed("ARROW_DEC");
                break;
              case "ArrowLeft":
                if (horizontal) keyed(rtl ? "ARROW_INC" : "ARROW_DEC");
                break;
              case "ArrowRight":
                if (horizontal) keyed(rtl ? "ARROW_DEC" : "ARROW_INC");
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
      indexes: (context: SliderContext) => context.markers,
      attrs: (scope: SlotLike<number>) => {
        const slot = scope.slot;
        const context = scope.context;
        const percent = percentOf(context, slot);
        const vertical = context.orientation === "vertical";
        return {
          id: scope.id("marker", slot),
          "data-value": String(slot),
          style: vertical
            ? { bottom: `${percent}%` }
            : { insetInlineStart: `${percent}%` },
        };
      },
    },
    hiddenInput: {
      id: "input",
      stamp: false,
      indexes: (context: SliderContext) => thumbIndexes(context.value.length),
      attrs: (scope: SlotLike<number>, arg?: unknown) => {
        const context = scope.context;
        const index = scope.slot;
        const value = context.value[index] ?? context.min;
        const name = typeof arg === "string" ? arg : "";
        return {
          id: scope.id("input", index),
          name: name.length > 0
            ? (context.value.length > 1 ? `${name}[]` : name)
            : undefined,
          form: undefined,
          type: "text",
          hidden: true,
          value: String(value),
        };
      },
    },
  },
  commands: {
    setValue: {
      event: ([value]: [value: readonly number[]]) => ({
        type: "SET_VALUE",
        value,
      }),
    },
    setThumbValue: {
      event: ([index, value]: [index: number, value: number], context) => {
        const next = [...context.value];
        const i = Math.trunc(index);
        next[i] = value;
        return { type: "SET_VALUE", value: next, index: i };
      },
    },
    increment: {
      event: ([index]: [index?: number]) =>
        index !== undefined
          ? { type: "INCREMENT", index: Math.trunc(index) }
          : { type: "INCREMENT" },
    },
    decrement: {
      event: ([index]: [index?: number]) =>
        index !== undefined
          ? { type: "DECREMENT", index: Math.trunc(index) }
          : { type: "DECREMENT" },
    },
    focus: { event: () => ({ type: "FOCUS", index: 0 }) },
  },
  readers: {
    value: { read: (context) => context.value },
    markers: { read: (context) => context.markers },
    valueText: { read: (context) => context.value.join(", ") },
    dragging: { read: (_context, state) => state === "dragging" },
    focused: { read: (_context, state) => state === "focus" },
    focusedIndex: { read: (context) => context.focusedIndex },
    disabled: { read: (context) => context.disabled },
  },
  methods: {
    getThumbValue: {
      call: (context, _state, [index]: [index: number]) =>
        context.value[Math.trunc(index)] ?? context.min,
    },
    getThumbPercent: {
      call: (context, _state, [index]: [index: number]) =>
        percentOf(context, context.value[Math.trunc(index)] ?? context.min),
    },
    getThumbMin: {
      call: (context, _state, [index]: [index: number]) =>
        thumbRange(context, Math.trunc(index)).min,
    },
    getThumbMax: {
      call: (context, _state, [index]: [index: number]) =>
        thumbRange(context, Math.trunc(index)).max,
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
        value: watched.slice(1),
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
    ) {
      return;
    }
    const idx = after.context.focusedIndex;
    if (idx >= 0) focus("thumb", idx);
  },
} satisfies ComponentDef<
  SliderContext,
  SliderEvents,
  Record<string, unknown>,
  SliderArgs,
  SliderState
>;

export type SliderApi = ApiOf<typeof def>;
export const slider = defineComponent<
  SliderContext,
  SliderEvents,
  SliderApi,
  SliderArgs,
  SliderState
>(def);
