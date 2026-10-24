import type { AssignFor, GuardFor } from "@spin/runtime/fsm";
import { isCustomValue, stringifyValues } from "./combobox.state.ts";
import type { ComboboxContext } from "./combobox.state.ts";
import type { ComboboxEvents } from "./combobox.events.ts";

type Ctx = ComboboxContext;
type Ev = ComboboxEvents;

type ComboboxAssign<K extends keyof Ev = keyof Ev> = AssignFor<Ctx, Ev, K>;

const at = (list: readonly string[], index: number): string | null =>
  list.at(index) ?? null;

const completion = (
  ctx: Ctx,
  value: string,
  keypress: boolean,
): string | null => {
  if (!keypress || ctx.inputBehavior !== "autocomplete") return null;
  return ctx.labels[value] ?? ctx.inputValue;
};

const inlineSingle = (ctx: Ctx): boolean =>
  ctx.inputBehavior === "autocomplete" && !ctx.multiple;

const applySelection = (ctx: Ctx, next: readonly string[]): Partial<Ctx> => ({
  value: [...next],
  inputValue: ctx.selectionBehavior === "preserve"
    ? ctx.inputValue
    : ctx.selectionBehavior === "clear"
    ? ""
    : stringifyValues(ctx, next),
  autofill: null,
});

export const setHighlightedValue: ComboboxAssign<
  "HIGHLIGHTED_VALUE.SET" | "ITEM.POINTER_MOVE"
> = (ctx, e) => {
  if (e.type === "ITEM.POINTER_MOVE") {
    return {
      highlightedValue: e.value,
      autofill: completion(ctx, e.value, false),
    };
  }
  if (e.type !== "HIGHLIGHTED_VALUE.SET" || e.value === null) return {};
  return {
    highlightedValue: e.value,
    autofill: completion(ctx, e.value, e.keypress === true),
  };
};

export const clearHighlightedValue = (): Partial<Ctx> => ({
  highlightedValue: null,
  autofill: null,
});

export const moveHighlight: ComboboxAssign<
  "INPUT.ARROW_DOWN" | "INPUT.ARROW_UP" | "INPUT.HOME" | "INPUT.END"
> = (ctx, e) => {
  if (e.value === undefined) return {};
  return {
    highlightedValue: e.value,
    autofill: completion(ctx, e.value, e.keypress === true),
  };
};

export const highlightFirstItem = (ctx: Ctx): Partial<Ctx> =>
  ctx.order.length === 0
    ? {}
    : { highlightedValue: at(ctx.order, 0), autofill: null };

export const highlightFirstOrSelectedItem = (ctx: Ctx): Partial<Ctx> => {
  const selected = ctx.order.filter((value) => ctx.value.includes(value));
  const value = selected.length > 0 ? at(selected, 0) : at(ctx.order, 0);
  if (value === null) return {};
  return { highlightedValue: value, autofill: null };
};

export const selectItem: ComboboxAssign<"ITEM.SELECT" | "ITEM.CLICK"> = (
  ctx,
  e,
) => {
  if (e.type !== "ITEM.SELECT" && e.type !== "ITEM.CLICK") return {};
  const value = e.value;
  const next = ctx.multiple
    ? (ctx.value.includes(value)
      ? ctx.value.filter((v) => v !== value)
      : [...ctx.value, value])
    : [value];
  return applySelection(ctx, next);
};

export const selectHighlightedItem: ComboboxAssign<"INPUT.ENTER"> = (ctx) => {
  if (
    ctx.highlightedValue === null || !ctx.order.includes(ctx.highlightedValue)
  ) return {};
  const value = ctx.highlightedValue;
  const next = ctx.multiple
    ? (ctx.value.includes(value)
      ? ctx.value.filter((v) => v !== value)
      : [...ctx.value, value])
    : [value];
  return applySelection(ctx, next);
};

export const clearValue = (ctx: Ctx): Partial<Ctx> => applySelection(ctx, []);

export const clearInputValue = (): Partial<Ctx> => ({
  inputValue: "",
  autofill: null,
});

export const setInputValue: ComboboxAssign<"INPUT.CHANGE" | "INPUT_VALUE.SET"> =
  (_ctx, e) => {
    if (e.type !== "INPUT.CHANGE" && e.type !== "INPUT_VALUE.SET") return {};
    return { inputValue: e.value, autofill: null };
  };

export const revertInputValue = (ctx: Ctx): Partial<Ctx> => {
  if (ctx.selectionBehavior === "preserve") return {};
  if (ctx.selectionBehavior === "clear") {
    return { inputValue: "", autofill: null };
  }
  return {
    inputValue: ctx.value.length > 0 ? stringifyValues(ctx, ctx.value) : "",
    autofill: null,
  };
};

export const inlineAutocomplete = (ctx: Ctx): boolean =>
  ctx.inputBehavior === "autocomplete" && !ctx.multiple;
export const closeOnSelect = (ctx: Ctx): boolean => ctx.closeOnSelect;
export const revertsToValue = (ctx: Ctx): boolean =>
  isCustomValue(ctx) && !ctx.allowCustomValue && ctx.highlightedValue === null;

// guards
export const isCustomValueGuard: GuardFor<Ctx, Ev> = (ctx) =>
  isCustomValue(ctx) && !ctx.allowCustomValue;
export const inlineSingleGuard: GuardFor<Ctx, Ev> = (ctx) =>
  inlineAutocomplete(ctx) && ctx.highlightedValue === at(ctx.order, -1)
    ? true
    : false;

export { applySelection, at, completion, inlineSingle };
