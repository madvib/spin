import type { SelectContext } from "./select.state.ts";
import type { SelectEvents } from "./select.events.ts";
import type { AssignFor, GuardFor } from "@spinjs/components/fsm";

type SelectAssign<K extends keyof SelectEvents = keyof SelectEvents> =
  AssignFor<
    SelectContext,
    SelectEvents,
    K
  >;

const setHighlighted: SelectAssign<
  "HIGHLIGHTED_VALUE.SET" | "ITEM.POINTER_MOVE"
> = (ctx, event) => {
  if (event.type === "HIGHLIGHTED_VALUE.SET") {
    return { highlightedValue: event.highlightedValue };
  }
  if (event.type === "ITEM.POINTER_MOVE") {
    return { highlightedValue: event.value };
  }
  return { highlightedValue: ctx.highlightedValue };
};

const clearHighlighted = (): Partial<SelectContext> => ({
  highlightedValue: null,
});

const clearValue = (): Partial<SelectContext> => ({ value: [] });

const selectClicked: SelectAssign<"ITEM.CLICK"> = (ctx, event) => {
  if (ctx.multiple) {
    return {
      value: ctx.value.includes(event.value)
        ? ctx.value.filter((value) => value !== event.value)
        : [...ctx.value, event.value],
    };
  }
  return { value: [event.value] };
};

const highlightFirstOrSelected = (
  ctx: SelectContext,
): Partial<SelectContext> => {
  const selected = ctx.value.find((value) => ctx.order.includes(value));
  if (selected !== undefined) return { highlightedValue: selected };
  return { highlightedValue: ctx.order[0] ?? null };
};

const highlightFirst = (ctx: SelectContext): Partial<SelectContext> => ({
  highlightedValue: ctx.order[0] ?? null,
});

const highlightLast = (ctx: SelectContext): Partial<SelectContext> => ({
  highlightedValue: ctx.order[ctx.order.length - 1] ?? null,
});

const single: GuardFor<SelectContext, SelectEvents> = (ctx) => !ctx.multiple;

const restoreFocus: GuardFor<SelectContext, SelectEvents> = (_ctx, event) => {
  if (
    event.type === "CONTROLLED.CLOSE" ||
    event.type === "LAYER.INTERACT_OUTSIDE"
  ) {
    return event.restoreFocus !== false;
  }
  return true;
};

export {
  clearHighlighted,
  clearValue,
  highlightFirst,
  highlightFirstOrSelected,
  highlightLast,
  restoreFocus,
  selectClicked,
  setHighlighted,
  single,
};

export type { SelectAssign };
