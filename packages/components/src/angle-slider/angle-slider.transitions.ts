import type { AssignFor } from "@spinjs/runtime/fsm";
import type { AngleSliderEvents } from "./angle-slider.events.ts";
import type { AngleSliderContext } from "./angle-slider.state.ts";
import {
  clampAngle,
  constrainAngle,
  resolveValue,
  snapAngle,
} from "./angle-slider.state.ts";

type AngleAssign<K extends keyof AngleSliderEvents = keyof AngleSliderEvents> =
  AssignFor<
    AngleSliderContext,
    AngleSliderEvents,
    K
  >;

export const setDragOffset: AngleAssign<"CONTROL.POINTER_DOWN"> = (
  _ctx,
  event,
) => ({
  dragOffset: event.angularOffset,
});

export const setPointerValue: AngleAssign<
  "CONTROL.POINTER_DOWN" | "DOC.POINTER_MOVE"
> = (ctx, event) => {
  const offset = event.type === "CONTROL.POINTER_DOWN"
    ? event.angularOffset
    : ctx.dragOffset;
  const dial = resolveValue(event.rawAngle, offset, ctx.value, ctx.dir);
  return { value: constrainAngle(dial, ctx.step) };
};

export const setValue: AngleAssign<"VALUE.SET"> = (_ctx, event) => {
  const value = typeof event.value === "number" && Number.isFinite(event.value)
    ? event.value
    : null;
  if (value === null) return {};
  return { value: clampAngle(value) };
};

export const arrowDec: AngleAssign<"THUMB.ARROW_DEC"> = (ctx, event) => ({
  value: snapAngle(
    ctx.value - (event.step ?? ctx.step),
    event.step ?? ctx.step,
  ),
});

export const arrowInc: AngleAssign<"THUMB.ARROW_INC"> = (ctx, event) => ({
  value: snapAngle(
    ctx.value + (event.step ?? ctx.step),
    event.step ?? ctx.step,
  ),
});
