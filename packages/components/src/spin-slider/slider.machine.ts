/** Slider machine: idle/focus/dragging over three states. */

import {
  clampValue,
  getNextStepValue,
  getPreviousStepValue,
} from "../../../../node_modules/@zag-js/utils/dist/number.mjs";
import { createMachine, type Machine, type EventUnion } from "@spin/runtime/fsm";
import type { SliderArgs, SliderContext } from "./slider.state.ts";
import {
  closestIndex,
  constrain,
  handlePush,
  initial,
  isInteractive,
  movableIndex,
  normalizeAll,
  rangeAt,
  resolveNone,
  thumbRange,
} from "./slider.state.ts";
import type { SliderEvents } from "./slider.events.ts";
const incrementThumb = (ctx: SliderContext, event: EventUnion<SliderEvents>) : Partial<SliderContext> => {
        if (event.type !== "INCREMENT" && event.type !== "ARROW_INC") return {};
        const index = event.type === "INCREMENT" && event.index !== undefined ? event.index : ctx.focusedIndex;
        if (index < 0 || index >= ctx.value.length) return {};
        const range = rangeAt(ctx, index);
        const next = getNextStepValue(index, {
          ...range,
          step: event.step ?? ctx.step,
          values: [...ctx.value],
        }) as number[];
        next[index] = clampValue(next[index] ?? ctx.min, range.min, range.max) as number;
        return { value: next };
      };

const decrementThumb = (ctx: SliderContext, event: EventUnion<SliderEvents>) : Partial<SliderContext> => {
        if (event.type !== "DECREMENT" && event.type !== "ARROW_DEC") return {};
        const index = event.type === "DECREMENT" && event.index !== undefined ? event.index : ctx.focusedIndex;
        if (index < 0 || index >= ctx.value.length) return {};
        const range = rangeAt(ctx, index);
        const next = getPreviousStepValue(index, {
          ...range,
          step: event.step ?? ctx.step,
          values: [...ctx.value],
        }) as number[];
        next[index] = clampValue(next[index] ?? ctx.min, range.min, range.max) as number;
        return { value: next };
      };

const setClosestThumb = (ctx: SliderContext, event: EventUnion<SliderEvents>) : Partial<SliderContext> => {
        if (event.type !== "POINTER_DOWN") return {};
        return {
          focusedIndex: movableIndex(ctx.value, closestIndex(ctx.value, event.pointValue), ctx.max),
        };
      };

const setFocusedIndex = (ctx: SliderContext, event: EventUnion<SliderEvents>) : Partial<SliderContext> => {
        if (event.type !== "FOCUS" && event.type !== "THUMB_POINTER_DOWN") return {};
        const asked = event.type === "FOCUS" && event.index !== undefined ? event.index : 0;
        const index = event.type === "THUMB_POINTER_DOWN" ? event.index : asked;
        void ctx;
        return { focusedIndex: index };
      };

const clearFocusedIndex = () : Partial<SliderContext> => { return ({ focusedIndex: -1 }); };

const setDragOffset = (ctx: SliderContext, event: EventUnion<SliderEvents>) : Partial<SliderContext> => {
        if (event.type !== "THUMB_POINTER_DOWN") return {};
        void ctx;
        return { dragOffset: event.offset ?? null };
      };

const snapshotDragStart = (ctx: SliderContext) : Partial<SliderContext> => { return ({
        dragStartValue: [...ctx.value],
      }); };

const clearDragRefs = () : Partial<SliderContext> => { return ({ dragOffset: null, dragStartValue: null }); };

const setPointerValue = (ctx: SliderContext, event: EventUnion<SliderEvents>) : Partial<SliderContext> => {
        if (event.type !== "POINTER_DOWN" && event.type !== "POINTER_MOVE") return {};
        if (ctx.thumbCollisionBehavior === "push") {
          const gap = ctx.step * ctx.minStepsBetweenThumbs;
          const pushed = handlePush(ctx.focusedIndex, event.pointValue, ctx.value, ctx.min, ctx.max, gap);
          return { value: pushed.values, focusedIndex: pushed.index };
        }
        const resolved = resolveNone(
          ctx.focusedIndex,
          event.pointValue,
          ctx.value,
          ctx.min,
          ctx.max,
        );
        return { value: resolved.values };
      };



export function slider(
  args: SliderArgs = {},
  authored: (name: string) => boolean,
): Machine<SliderContext, SliderEvents> {
  return createMachine<SliderContext, SliderEvents>({
    id: "slider",
    initial: "idle",
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host may
     * write, and the event each write carries. A field with an event is
     * REPORTED — the machine decides, and the change reaches the host; a
     * field without one is SILENT.
     */
    fields: {
      value: { event: "SET_VALUE" },
      min: {},
      max: {},
      step: {},
      largeStep: {},
      minStepsBetweenThumbs: {},
      origin: {},
      orientation: {},
      thumbCollisionBehavior: {},
      disabled: {},
      readOnly: {},
      invalid: {},
    },
    on: {
      SET_VALUE: [
        { cond: (_ctx, event) => { return event.type === "SET_VALUE" && event.index !== undefined && event.index !== null; }, assign: (ctx, event) => {
        if (event.type !== "SET_VALUE" || event.index === undefined || event.index === null) return {};
        const values = [...event.value];
        if (values[event.index] === undefined) return {};
        const constrained = constrain(ctx, values[event.index] ?? ctx.min, event.index);
        const next = [...ctx.value];
        next[event.index] = constrained;
        return { value: next };
      } },
        { assign: (ctx, event) => {
        // The values arrive the way the host wrote them; the machine
        // shapes them.
        return { value: normalizeAll(ctx, [...event.value]) };
      } },
      ],
      INCREMENT: { assign: incrementThumb },
      DECREMENT: { assign: decrementThumb },
      SET_MIN: { assign: (ctx, event) => {
        return { min: event.min };
      } },
      SET_MAX: { assign: (ctx, event) => {
        return { max: event.max };
      } },
      SET_STEP: { assign: (ctx, event) => {
        return { step: event.step };
      } },
      SET_DISABLED: { assign: (ctx, event) => {
        void ctx;
        return { disabled: event.disabled === true };
      } },
      SET_READ_ONLY: { assign: (ctx, event) => {
        void ctx;
        return { readOnly: event.readOnly === true };
      } },
    },
    states: {
      idle: {
        on: {
          POINTER_DOWN: {
            target: "dragging",
            assign: [setClosestThumb, snapshotDragStart, setPointerValue],
          },
          FOCUS: {
            target: "focus",
            cond: (ctx) => { return isInteractive(ctx); },
            assign: setFocusedIndex,
          },
          THUMB_POINTER_DOWN: {
            target: "dragging",
            assign: [setFocusedIndex, setDragOffset, snapshotDragStart],
          },
        },
      },
      focus: {
        on: {
          POINTER_DOWN: {
            target: "dragging",
            assign: [setClosestThumb, snapshotDragStart, setPointerValue],
          },
          THUMB_POINTER_DOWN: {
            target: "dragging",
            assign: [setFocusedIndex, setDragOffset, snapshotDragStart],
          },
          ARROW_DEC: { assign: decrementThumb },
          ARROW_INC: { assign: incrementThumb },
          HOME: { assign: (ctx) => {
        if (ctx.focusedIndex < 0) return {};
        const next = [...ctx.value];
        next[ctx.focusedIndex] = rangeAt(ctx, ctx.focusedIndex).min;
        return { value: next };
      } },
          END: { assign: (ctx) => {
        if (ctx.focusedIndex < 0) return {};
        const next = [...ctx.value];
        next[ctx.focusedIndex] = rangeAt(ctx, ctx.focusedIndex).max;
        return { value: next };
      } },
          BLUR: { target: "idle", assign: clearFocusedIndex },
        },
      },
      dragging: {
        on: {
          POINTER_UP: {
            target: "focus",
            assign: clearDragRefs,
          },
          POINTER_MOVE: { assign: setPointerValue },
          POINTER_CANCEL: {
            target: "idle",
            assign: [clearFocusedIndex, clearDragRefs],
          },
        },
      },
    },});
}
