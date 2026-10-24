import type { AssignFor } from "@spinjs/runtime/fsm";
import type { RatingGroupEvents } from "./rating-group.events.ts";
import type { RatingGroupContext } from "./rating-group.state.ts";
import { ratingValue, step } from "./rating-group.state.ts";

type RatingAssign<K extends keyof RatingGroupEvents = keyof RatingGroupEvents> =
  AssignFor<
    RatingGroupContext,
    RatingGroupEvents,
    K
  >;

export const clearHoveredValue = (): Partial<RatingGroupContext> => ({
  hoveredValue: -1,
});

export const setValue: RatingAssign<"CLICK" | "SPACE"> = (ctx, event) => ({
  value: ctx.hoveredValue === -1 ? event.value : ctx.hoveredValue,
});

export const setHoveredValue: RatingAssign<"POINTER_OVER"> = (ctx, event) => ({
  hoveredValue: event.index - (ctx.allowHalf && event.isMidway ? 0.5 : 0),
});

export const applyValue: RatingAssign<"SET_VALUE"> = (_ctx, event) => ({
  value: ratingValue(event.value),
});

export const clearValue: RatingAssign<"CLEAR_VALUE"> = () => ({ value: -1 });

export const applyCount: RatingAssign<"SET_COUNT"> = (_ctx, event) => ({
  count: Math.max(1, Math.floor(event.count)),
});

export const arrowLeft = (
  ctx: RatingGroupContext,
): Partial<RatingGroupContext> => ({
  value: Math.max(0, ctx.value - step(ctx)),
});

export const arrowRight = (
  ctx: RatingGroupContext,
): Partial<RatingGroupContext> => ({
  value: Math.min(ctx.count, (ctx.value === -1 ? 0 : ctx.value) + step(ctx)),
});

export const homeValue = (): Partial<RatingGroupContext> => ({ value: 1 });

export const endValue = (
  ctx: RatingGroupContext,
): Partial<RatingGroupContext> => ({
  value: ctx.count,
});
