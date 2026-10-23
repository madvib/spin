import { createMachine, type Machine } from "@spin/runtime/fsm";
import { initial, type ComboboxArgs, type ComboboxContext, type ComboboxState } from "./combobox.state.ts";
import type { ComboboxEvents } from "./combobox.events.ts";
import { parseKeys as coerceKeys } from "./combobox.state.ts";
import {
  setHighlightedValue,
  clearHighlightedValue,
  moveHighlight,
  highlightFirstItem,
  highlightFirstOrSelectedItem,
  selectItem,
  selectHighlightedItem,
  clearValue,
  clearInputValue,
  setInputValue,
  revertInputValue,
  inlineAutocomplete,
  closeOnSelect,
  revertsToValue,
  isCustomValueGuard,
} from "./combobox.transitions.ts";

const at = (list: readonly string[], index: number): string | null => list.at(index) ?? null;

export const isOpenPhase = (phase: string): boolean =>
  phase === "interacting" || phase === "suggesting";

export { stringifyValues, pickOutcome } from "./combobox.state.ts";


export function combobox(
  args: ComboboxArgs = {},
  authored: (name: string) => boolean,
): Machine<ComboboxContext, ComboboxEvents, ComboboxState> {
  return createMachine<ComboboxContext, ComboboxEvents, ComboboxState>({
    id: "combobox",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      value: { event: "VALUE.SET" },
      items: {},
      multiple: {},
      closeOnSelect: {},
      allowCustomValue: {},
      inputBehavior: {},
      selectionBehavior: {},
      openOnChange: {},
      openOnKeyPress: {},
      alwaysSubmitOnEnter: {},
      disabled: {},
      readOnly: {},
      invalid: {},
      required: {},
      composite: {},
      placement: {},
      name: {},
      form: {},
      placeholder: {},
      triggerLabel: {},
      clearTriggerLabel: {},
      openOnClick: {},
      loopFocus: {},
    },
    on: {
      "SELECTED_ITEMS.SYNC": { assign: (ctx) => ({ inputValue: ctx.selectionBehavior === "preserve" ? ctx.inputValue : ctx.selectionBehavior === "clear" ? "" : (ctx.value.map((v) => ctx.labels[v]).filter((l): l is string => l !== undefined).join(", ")), autofill: null }) },
      "HIGHLIGHTED_VALUE.SET": { assign: setHighlightedValue },
      "HIGHLIGHTED_VALUE.CLEAR": { assign: clearHighlightedValue },
      "ITEM.SELECT": { assign: selectItem },
      "ITEM.CLEAR": { assign: (ctx, e) => {
        if (e.type !== "ITEM.CLEAR") return {};
        return { value: ctx.value.filter((value) => value !== e.value), inputValue: ctx.selectionBehavior === "preserve" ? ctx.inputValue : ctx.selectionBehavior === "clear" ? "" : ctx.value.filter((value) => value !== e.value).map((v) => ctx.labels[v]).filter((l): l is string => l !== undefined).join(", "), autofill: null };
      } },
      "VALUE.SET": { assign: (ctx, e) => e.type === "VALUE.SET" ? { value: [...coerceKeys(e.value)], inputValue: ctx.selectionBehavior === "preserve" ? ctx.inputValue : ctx.selectionBehavior === "clear" ? "" : coerceKeys(e.value).map((v) => ctx.labels[v]).filter((l): l is string => l !== undefined).join(", "), autofill: null } : {} },
      "INPUT_VALUE.SET": { assign: setInputValue },
      OPEN: { target: "interacting" },
      CLOSE: { target: "focused" },
      "VALUE.CLEAR": { target: "focused", assign: [clearInputValue, clearValue] },
      "INPUT.ESCAPE": [{ cond: revertsToValue, assign: revertInputValue }],
      "INPUT.ENTER": [
        { cond: revertsToValue, target: "focused", assign: revertInputValue },
        { cond: closeOnSelect, target: "focused", assign: selectHighlightedItem },
        { assign: selectHighlightedItem },
      ],
      "ITEM.CLICK": [
        { cond: closeOnSelect, target: "focused", assign: selectItem },
        { assign: selectItem },
      ],
      "TRIGGER.CLICK": { target: "focused" },
      "LAYER.INTERACT_OUTSIDE": [
        { cond: (ctx, event) => isCustomValueGuard(ctx, event), target: "idle", assign: revertInputValue },
        { target: "idle" },
      ],
    },
    states: {
      idle: {
        entry: [{ assign: clearHighlightedValue }],
        on: {
          "INPUT.FOCUS": { target: "focused" },
          "TRIGGER.CLICK": { target: "interacting", assign: highlightFirstOrSelectedItem },
          "INPUT.CLICK": { target: "interacting", assign: highlightFirstOrSelectedItem },
          "INPUT.ENTER": {},
          "ITEM.CLICK": {},
        },
      },
      focused: {
        entry: [{ assign: clearHighlightedValue }],
        on: {
          "INPUT.BLUR": { target: "idle" },
          "INPUT.CHANGE": [
            { cond: (ctx) => ctx.openOnChange, target: "suggesting", assign: [setInputValue, (ctx) => ctx.inputBehavior !== "autohighlight" || ctx.order.length === 0 ? {} : { highlightedValue: at(ctx.order, 0), autofill: null }] },
            { assign: setInputValue },
          ],
          "INPUT.ESCAPE": [{ cond: revertsToValue, assign: revertInputValue }],
          "INPUT.CLICK": { target: "interacting", assign: highlightFirstOrSelectedItem },
          "TRIGGER.CLICK": { target: "interacting", assign: highlightFirstOrSelectedItem },
          "INPUT.ARROW_DOWN": [
            { cond: inlineAutocomplete, target: "interacting" },
            { target: "interacting", assign: highlightFirstOrSelectedItem },
          ],
          "INPUT.ARROW_UP": [
            { cond: inlineAutocomplete, target: "interacting" },
            { target: "interacting", assign: (ctx) => {
              const selected = ctx.order.filter((value) => ctx.value.includes(value));
              const value = selected.length > 0 ? at(selected, 0) : at(ctx.order, -1);
              if (value === null) return {};
              return { highlightedValue: value, autofill: null };
            } },
          ],
          "LAYER.INTERACT_OUTSIDE": { target: "idle" },
          "LAYER.ESCAPE": { target: "idle" },
          "VALUE.CLEAR": { assign: [clearInputValue, clearValue] },
          "INPUT.ENTER": {},
          "ITEM.CLICK": {},
        },
      },
      interacting: {
        on: {
          "CHILDREN_CHANGE": { assign: (ctx) => ctx.highlightedValue !== null && !ctx.order.includes(ctx.highlightedValue) ? { highlightedValue: null, autofill: null } : {} },
          "INPUT.HOME": { assign: moveHighlight },
          "INPUT.END": { assign: moveHighlight },
          "INPUT.ARROW_DOWN": [
            { cond: (ctx) => inlineAutocomplete(ctx) && ctx.highlightedValue === at(ctx.order, -1), assign: clearHighlightedValue },
            { assign: moveHighlight },
          ],
          "INPUT.ARROW_UP": [
            { cond: (ctx) => inlineAutocomplete(ctx) && ctx.highlightedValue === at(ctx.order, 0), assign: clearHighlightedValue },
            { assign: moveHighlight },
          ],
          "INPUT.CHANGE": [
            { cond: inlineAutocomplete, target: "suggesting", assign: setInputValue },
            { target: "suggesting", assign: [setInputValue, clearHighlightedValue] },
          ],
          "ITEM.POINTER_MOVE": { assign: setHighlightedValue },
          "ITEM.POINTER_LEAVE": { assign: clearHighlightedValue },
          "LAYER.ESCAPE": [
            { cond: inlineAutocomplete, assign: clearHighlightedValue },
            { target: "focused" },
          ],
        },
      },
      suggesting: {
        on: {
          "CHILDREN_CHANGE": [
            { cond: (ctx) => ctx.inputBehavior === "autohighlight" && ctx.highlightedValue !== null && !ctx.order.includes(ctx.highlightedValue) && ctx.order.length > 0, assign: [clearHighlightedValue, highlightFirstItem] },
            { cond: (ctx) => ctx.highlightedValue !== null && !ctx.order.includes(ctx.highlightedValue), assign: clearHighlightedValue },
            { cond: (ctx) => ctx.inputBehavior === "autohighlight", assign: highlightFirstItem },
          ],
          "INPUT.ARROW_DOWN": { target: "interacting", assign: moveHighlight },
          "INPUT.ARROW_UP": { target: "interacting", assign: moveHighlight },
          "INPUT.HOME": { target: "interacting", assign: moveHighlight },
          "INPUT.END": { target: "interacting", assign: moveHighlight },
          "INPUT.CHANGE": { assign: setInputValue },
          "ITEM.POINTER_MOVE": { target: "interacting", assign: setHighlightedValue },
          "ITEM.POINTER_LEAVE": { assign: clearHighlightedValue },
          "LAYER.ESCAPE": { target: "focused" },
        },
      },
    },
  });
}

// re-export helpers
export { isCustomValue } from "./combobox.state.ts";