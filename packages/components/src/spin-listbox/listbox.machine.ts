import { createMachine, type Machine } from "@spin/runtime/fsm";
import { initial, rowsOf as rowsOfState, type ListboxArgs, type ListboxContext, type ListboxState } from "./listbox.state.ts";
import type { ListboxEvents } from "./listbox.events.ts";
import {
  clearHighlightedValue,
  clearItem,
  clearValue,
  itemClickInner,
  navigateInner,
  pointerMove,
  selectItem,
  setFocused,
  setHighlightedItem,
  setHighlightedValue,
  syncSelectedItems,
  setValue,
  typeaheadInner,
} from "./listbox.transitions.ts";

export function listbox(
  args: ListboxArgs = {},
  authored: (name: string) => boolean,
): Machine<ListboxContext, ListboxEvents, ListboxState> {
  return createMachine<ListboxContext, ListboxEvents, ListboxState>({
    id: "listbox",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      value: { event: "VALUE.SET" },
      highlightedValue: { event: "HIGHLIGHTED_VALUE.SET" },
      items: {},
      disabled: {},
      readOnly: {},
      multiple: {},
      selectOnHighlight: {},
      loopFocus: {},
      selectionBehavior: {},
      orientation: {},
      dir: {},
    },
    on: {
      "SELECTED_ITEMS.SYNC": { assign: syncSelectedItems },
      "HIGHLIGHTED_VALUE.SET": { assign: setHighlightedValue },
      "HIGHLIGHTED_VALUE.CLEAR": { assign: clearHighlightedValue },
      "ITEM.SELECT": { assign: selectItem },
      "ITEM.CLEAR": { assign: clearItem },
      "VALUE.SET": { assign: setValue },
      "VALUE.CLEAR": { assign: clearValue },
    },
    states: {
      idle: {
        on: {
          "CONTENT.FOCUS": [
            {
              cond: (ctx) => ctx.value.length > 0 || ctx.highlightedValue !== null,
              assign: setFocused,
            },
            {
              assign: [setFocused, (ctx) => ({ highlightedValue: rowsOfState(ctx.items)[0]?.value ?? null })],
            },
          ],
          "CONTENT.BLUR": { assign: () => ({ focused: false }) },
          "ITEM.CLICK": { assign: [setHighlightedItem, itemClickInner] },
          "CONTENT.TYPEAHEAD": { assign: [setFocused, typeaheadInner] },
          "ITEM.POINTER_MOVE": { assign: pointerMove },
          "ITEM.POINTER_LEAVE": { assign: clearHighlightedValue },
          NAVIGATE: { assign: [setFocused, setHighlightedItem, navigateInner] },
        },
      },
    },
  });
}

export { hasValue, stringifyValues } from "./listbox.state.ts";