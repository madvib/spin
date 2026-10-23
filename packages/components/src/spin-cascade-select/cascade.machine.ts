import { createMachine, type Machine } from "@spin/runtime/fsm";
import {
  initial,
  parseCollection,
  type CascadeArgs,
  type CascadeContext,
  type CascadeState,
  startOpen,
  parsePath,
  parsePaths,
} from "./cascade.state.ts";
import type { EventUnion } from "@spin/runtime/fsm";
import type { CascadeEvents } from "./cascade.events.ts";
import {
  setValue,
  clearValue,
  setHighlightedValue,
  clearHighlightedValue,
  selectItem,
  openWithHighlight,
  highlightSelected,
  itemClickCloseGuard,
  itemClickSelectableGuard,
  hoverHighlightGuard,
  hoverHighlightAssign,
  itemClearAssign,
  clearTriggerAssign,
  restoresFocus,
} from "./cascade.transitions.ts";

export type { CascadeArgs, CascadeContext, CascadeEvents };
export { parsePath, parsePaths, initial, startOpen };
export type CascadeEvent = EventUnion<CascadeEvents>;

export function cascade(
  args: CascadeArgs = {},
  authored: (name: string) => boolean,
): Machine<CascadeContext, CascadeEvents, CascadeState> {
  return createMachine<CascadeContext, CascadeEvents, CascadeState>({
    id: "cascade",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      value: { event: "VALUE_SET", parse: (raw) => raw },
      highlightedValue: { event: "HIGHLIGHTED_VALUE_SET", parse: (raw) => raw },
      closeOnSelect: {},
      allowParentSelection: {},
      multiple: {},
      loopFocus: {},
      highlightTrigger: {},
      collection: { parse: parseCollection },
      disabled: {},
      readOnly: {},
      dir: {},
      formatValue: {},
      placement: {},
      form: {},
      name: {},
      required: {},
      invalid: {},
      onFocusOutside: {},
      onInteractOutside: {},
      onPointerDownOutside: {},
      scrollToIndexFn: {},
    },
    states: {
      idle: {
        on: {
          OPEN: { target: "open" },
          CONTROLLED_OPEN: { target: "open" },
          TRIGGER_CLICK: { target: "open", assign: highlightSelected },
          TRIGGER_OPEN: { target: "open", assign: openWithHighlight },
          TRIGGER_FOCUS: { target: "focused" },
        },
      },
      focused: {
        on: {
          OPEN: { target: "open" },
          CONTROLLED_OPEN: { target: "open" },
          TRIGGER_CLICK: { target: "open", assign: highlightSelected },
          TRIGGER_OPEN: { target: "open", assign: openWithHighlight },
          TRIGGER_BLUR: { target: "idle" },
        },
      },
      open: {
        on: {
          CONTROLLED_CLOSE: [
            { cond: restoresFocus, target: "focused", assign: clearHighlightedValue },
            { target: "idle", assign: clearHighlightedValue },
          ],
          CLOSE: [
            { cond: restoresFocus, target: "focused", assign: clearHighlightedValue },
            { target: "idle", assign: clearHighlightedValue },
          ],
          TRIGGER_CLICK: { target: "focused", assign: clearHighlightedValue },
          ITEM_CLICK: [
            { cond: itemClickCloseGuard, target: "focused", assign: [selectItem, clearHighlightedValue] },
            { cond: itemClickSelectableGuard, assign: selectItem },
            { assign: (_ctx, e) => (e.type === "ITEM_CLICK" ? { highlightedValue: [...e.value] } : {}) },
          ],
          ITEM_POINTER_ENTER: [
            { cond: hoverHighlightGuard, assign: hoverHighlightAssign },
          ],
        },
      },
    },
    on: {
      VALUE_SET: { assign: setValue },
      VALUE_CLEAR: { assign: clearValue },
      HIGHLIGHTED_VALUE_SET: { assign: setHighlightedValue },
      HIGHLIGHTED_VALUE_CLEAR: { assign: clearHighlightedValue },
      ITEM_SELECT: { assign: selectItem },
      ITEM_CLEAR: { assign: itemClearAssign },
      CLEAR_TRIGGER_CLICK: { assign: clearTriggerAssign },
    },
  });
}
