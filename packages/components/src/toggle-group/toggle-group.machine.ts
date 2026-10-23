/** Toggle-group machine: idle/focused over two states. */

import { createMachine, type Machine } from "@spin/runtime/fsm";
import type { ToggleGroupArgs, ToggleGroupContext, ToggleGroupState } from "./toggle-group.state.ts";
import { initial } from "./toggle-group.state.ts";
import type { ToggleGroupEvents } from "./toggle-group.events.ts";
import {
  clearClickFocus,
  setFocusedId,
  setTabbingBackward,
  setValue,
} from "./toggle-group.transitions.ts";

export function toggleGroup(
  args: ToggleGroupArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<ToggleGroupContext, ToggleGroupEvents, ToggleGroupState> {
  return createMachine<ToggleGroupContext, ToggleGroupEvents, ToggleGroupState>({
    id: "toggle-group",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      value: { event: "VALUE.SET" },
      multiple: {},
      deselectable: {},
      rovingFocus: {},
      loopFocus: {},
      orientation: {},
      disabled: {},
    },
    on: {
      "VALUE.SET": { assign: setValue },
      "TOGGLE.CLICK": { assign: (ctx, event) => {
        if (ctx.multiple) {
          return {
            value: ctx.value.includes(event.value)
              ? ctx.value.filter((current) => current !== event.value)
              : [...ctx.value, event.value],
          };
        }
        const selected = ctx.value.length === 1 && ctx.value[0] === event.value;
        return { value: selected && ctx.deselectable ? [] : [event.value] };
      } },
      "ROOT.MOUSE_DOWN": { assign: () => ({ clickFocus: true }) },
    },
    states: {
      idle: {
        on: {
          "ROOT.FOCUS": [
            {
              cond: (ctx) => !ctx.clickFocus && !ctx.tabbingBackward,
              target: "focused",
              assign: clearClickFocus,
            },
          ],
          "TOGGLE.FOCUS": { target: "focused", assign: setFocusedId },
        },
      },
      focused: {
        on: {
          "ROOT.BLUR": {
            target: "idle",
            assign: [() => ({ tabbingBackward: false }), () => ({ focusedId: null }), clearClickFocus],
          },
          "TOGGLE.FOCUS": { assign: setFocusedId },
          "TOGGLE.FOCUS_NEXT": { assign: (_ctx, event) => ({ focusedId: event.id }) },
          "TOGGLE.FOCUS_PREV": { assign: (_ctx, event) => ({ focusedId: event.id }) },
          "TOGGLE.FOCUS_FIRST": { assign: (_ctx, event) => ({ focusedId: event.id }) },
          "TOGGLE.FOCUS_LAST": { assign: (_ctx, event) => ({ focusedId: event.id }) },
          "TOGGLE.SHIFT_TAB": [
            {
              cond: (ctx, event) => ctx.focusedId !== event.firstId,
              target: "idle",
              assign: setTabbingBackward,
            },
            { assign: setTabbingBackward },
          ],
        },
      },
    },
  });
}