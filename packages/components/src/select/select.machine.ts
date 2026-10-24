import { createMachine, type Machine } from "@spin/runtime/fsm";
import type { SelectArgs, SelectContext, SelectState } from "./select.state.ts";
import { initial, rowsOf } from "./select.state.ts";
import type { SelectEvents } from "./select.events.ts";
import {
  clearHighlighted,
  clearValue,
  highlightFirst,
  highlightFirstOrSelected,
  highlightLast,
  restoreFocus,
  selectClicked,
  setHighlighted,
  single,
} from "./select.transitions.ts";

export {
  type SelectArgs,
  type SelectContext,
  type SelectRow,
  type SelectState,
} from "./select.state.ts";
export { type SelectEvents } from "./select.events.ts";

export function select(
  args: SelectArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<SelectContext, SelectEvents, SelectState> {
  return createMachine<SelectContext, SelectEvents, SelectState>({
    id: "select",
    initial: "idle",
    fields: {
      items: { parse: rowsOf },
      highlightedValue: { event: "HIGHLIGHTED_VALUE.SET" },
      closeOnSelect: {},
      disabled: {},
      readOnly: {},
      required: {},
      invalid: {},
      dir: {},
      placement: {},
      name: {},
      form: {},
      clearTriggerLabel: {},
      multiple: {},
      loopFocus: {},
    },
    context: initial(args, authored),
    on: {
      "SELECTED_ITEMS.SYNC": {
        assign: (ctx) => {
          const value = ctx.value.filter((candidate) =>
            ctx.order.includes(candidate)
          );
          const highlighted = ((): string | null => {
            if (
              ctx.highlightedValue !== null &&
              ctx.order.includes(ctx.highlightedValue)
            ) {
              return ctx.highlightedValue;
            }
            return value[0] ?? null;
          })();
          const sameSelection = value.length === ctx.value.length;
          const sameHighlight = highlighted === ctx.highlightedValue;
          if (sameSelection && sameHighlight) return {};
          return { value, highlightedValue: highlighted };
        },
      },
      "HIGHLIGHTED_VALUE.SET": { assign: setHighlighted },
      "HIGHLIGHTED_VALUE.CLEAR": { assign: clearHighlighted },
      "ITEM.SELECT": {
        assign: (ctx, event) => {
          if (ctx.multiple) {
            return {
              value: ctx.value.includes(event.value)
                ? ctx.value.filter((value) => value !== event.value)
                : [...ctx.value, event.value],
            };
          }
          return { value: [event.value] };
        },
      },
      "ITEM.CLEAR": { assign: clearValue },
      "VALUE.SET": { assign: (_ctx, event) => ({ value: [...event.value] }) },
      "VALUE.CLEAR": { assign: clearValue },
      "CLEAR.CLICK": {
        assign: () => ({
          value: [],
          highlightedValue: null,
        }),
      },
    },
    states: {
      idle: {
        on: {
          "TRIGGER.FOCUS": { target: "focused" },
          TOGGLE: { target: "open", assign: highlightFirstOrSelected },
          "TRIGGER.CLICK": { target: "open", assign: highlightFirstOrSelected },
          OPEN: { target: "open", assign: highlightFirstOrSelected },
          "CONTROLLED.OPEN": {
            target: "open",
            assign: highlightFirstOrSelected,
          },
        },
      },
      focused: {
        on: {
          "TRIGGER.BLUR": { target: "idle" },
          "TRIGGER.CLICK": { target: "open", assign: highlightFirstOrSelected },
          TOGGLE: { target: "open", assign: highlightFirstOrSelected },
          OPEN: { target: "open", assign: highlightFirstOrSelected },
          "CONTROLLED.OPEN": {
            target: "open",
            assign: highlightFirstOrSelected,
          },
          "TRIGGER.ARROW_DOWN": [{ target: "open", assign: highlightFirst }],
          "TRIGGER.ARROW_UP": [{ target: "open", assign: highlightLast }],
          "TRIGGER.ENTER": [{ target: "open", assign: highlightFirst }],
          "TRIGGER.ARROW_RIGHT": [
            {
              cond: single,
              assign: (ctx) => {
                const at = ctx.value.length === 0
                  ? -1
                  : ctx.order.indexOf(ctx.value[0]!);
                const next = ctx.order[at + 1];
                return next === undefined ? {} : { value: [next] };
              },
            },
          ],
          "TRIGGER.ARROW_LEFT": [
            {
              cond: single,
              assign: (ctx) => {
                const at = ctx.value.length === 0
                  ? ctx.order.length
                  : ctx.order.indexOf(ctx.value[0]!);
                const previous = ctx.order[at - 1];
                return previous === undefined ? {} : { value: [previous] };
              },
            },
          ],
          "TRIGGER.HOME": [
            {
              cond: single,
              assign: (ctx) => ({
                value: ctx.order.length === 0 ? ctx.value : [ctx.order[0]!],
              }),
            },
          ],
          "TRIGGER.END": [
            {
              cond: single,
              assign: (ctx) => ({
                value: ctx.order.length === 0
                  ? ctx.value
                  : [ctx.order[ctx.order.length - 1]!],
              }),
            },
          ],
          "TRIGGER.TYPEAHEAD": [
            {
              cond: single,
              assign: (ctx, event) => {
                const value = ctx.order.find((candidate) =>
                  (ctx.labels[candidate] ?? candidate).toLowerCase().startsWith(
                    event.value.toLowerCase(),
                  )
                );
                return value === undefined ? {} : { value: [value] };
              },
            },
          ],
        },
      },
      open: {
        on: {
          "TRIGGER.CLICK": { target: "focused", assign: clearHighlighted },
          "ITEM.CLICK": [
            {
              cond: (ctx) => ctx.closeOnSelect,
              target: "focused",
              assign: [selectClicked, clearHighlighted],
            },
            { assign: selectClicked },
          ],
          CLOSE: [{ target: "idle", assign: clearHighlighted }],
          TOGGLE: [{ target: "idle", assign: clearHighlighted }],
          "CONTROLLED.CLOSE": [
            {
              cond: restoreFocus,
              target: "focused",
              assign: clearHighlighted,
            },
            { target: "idle", assign: clearHighlighted },
          ],
          "LAYER.ESCAPE": [{ target: "focused", assign: clearHighlighted }],
          "LAYER.INTERACT_OUTSIDE": [
            {
              cond: restoreFocus,
              target: "focused",
              assign: clearHighlighted,
            },
            { target: "idle", assign: clearHighlighted },
          ],
          "CONTENT.HOME": { assign: highlightFirst },
          "CONTENT.END": { assign: highlightLast },
          "CONTENT.ARROW_DOWN": {
            assign: (ctx) => {
              const at = (ctx.highlightedValue !== null &&
                  ctx.order.includes(ctx.highlightedValue))
                ? ctx.order.indexOf(ctx.highlightedValue)
                : -1;
              if (at === -1) return { highlightedValue: ctx.order[0] ?? null };
              const next = ctx.order[at + 1];
              if (next === undefined) {
                return ctx.loopFocus
                  ? { highlightedValue: ctx.order[0] ?? null }
                  : {};
              }
              return { highlightedValue: next };
            },
          },
          "CONTENT.ARROW_UP": {
            assign: (ctx) => {
              const at = (ctx.highlightedValue !== null &&
                  ctx.order.includes(ctx.highlightedValue))
                ? ctx.order.indexOf(ctx.highlightedValue)
                : -1;
              if (at === -1) {
                return {
                  highlightedValue: ctx.order[ctx.order.length - 1] ?? null,
                };
              }
              const previous = ctx.order[at - 1];
              if (previous === undefined) {
                return ctx.loopFocus
                  ? {
                    highlightedValue: ctx.order[ctx.order.length - 1] ?? null,
                  }
                  : {};
              }
              return { highlightedValue: previous };
            },
          },
          "CONTENT.TYPEAHEAD": {
            assign: (ctx, event) => {
              const value = ctx.order.find((candidate) =>
                (ctx.labels[candidate] ?? candidate).toLowerCase().startsWith(
                  event.value.toLowerCase(),
                )
              );
              return value === undefined ? {} : { highlightedValue: value };
            },
          },
          "ITEM.POINTER_MOVE": { assign: setHighlighted },
          "ITEM.POINTER_LEAVE": { assign: clearHighlighted },
        },
      },
    },
  });
}
