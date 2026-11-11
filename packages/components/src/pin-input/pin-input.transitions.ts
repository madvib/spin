import type { PinInputContext } from "./pin-input.state.ts";
import { pinView } from "./pin-input.state.ts";
import type { PinInputEvents } from "./pin-input.events.ts";
const viewOf = (ctx: PinInputContext) => pinView(ctx.value, ctx.count);

export const clearFocusedValue = (
  ctx: PinInputContext,
): Partial<PinInputContext> => {
  if (ctx.focusedIndex === -1) return {};
  const value = [...viewOf(ctx).chars];
  value.splice(ctx.focusedIndex, 1);
  value.push("");
  return { value };
};

export const setFocusedIndex = (
  ctx: PinInputContext,
  event: { index: number },
): Partial<PinInputContext> => {
  const view = viewOf(ctx);
  const maxIndex = Math.min(view.filled, view.length - 1);
  return { focusedIndex: Math.min(event.index, maxIndex) };
};

export const setFocusIndexToFirst = (): Partial<PinInputContext> => ({
  focusedIndex: 0,
});

export const advanceFocusedIndex = (
  ctx: PinInputContext,
): Partial<PinInputContext> => ({
  focusedIndex: Math.min(ctx.focusedIndex + 1, viewOf(ctx).length - 1),
});

export const setPrevFocusedIndex = (
  ctx: PinInputContext,
): Partial<PinInputContext> => ({
  focusedIndex: Math.max(ctx.focusedIndex - 1, 0),
});

export const hasValue = (ctx: PinInputContext): boolean =>
  (viewOf(ctx).chars[ctx.focusedIndex] ?? "") !== "";
