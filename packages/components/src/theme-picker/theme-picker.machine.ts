/** Theme-picker machine: closed/open over two states. */

import { createMachine, type Machine } from "@spinjs/runtime/fsm";
import type {
  ThemePickerArgs,
  ThemePickerContext,
  ThemePickerState,
} from "./theme-picker.state.ts";
import { initial } from "./theme-picker.state.ts";
import type { ThemePickerEvents } from "./theme-picker.events.ts";
import {
  hasEnabled,
  moveFirst,
  moveLast,
  moveNext,
  movePrev,
  selectEnabled,
  selectItem,
  setHighlight,
  setThemes,
  setValue,
} from "./theme-picker.transitions.ts";

export function themePicker(
  args: ThemePickerArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<ThemePickerContext, ThemePickerEvents, ThemePickerState> {
  const openMoves = {
    "HIGHLIGHT.NEXT": { cond: hasEnabled, assign: moveNext },
    "HIGHLIGHT.PREV": { cond: hasEnabled, assign: movePrev },
    "HIGHLIGHT.FIRST": { cond: hasEnabled, assign: moveFirst },
    "HIGHLIGHT.LAST": { cond: hasEnabled, assign: moveLast },
    "HIGHLIGHT.SET": { assign: setHighlight },
    "VALUE.SET": { assign: setValue },
    "THEMES.SET": { assign: setThemes },
  } as const;
  return createMachine<ThemePickerContext, ThemePickerEvents, ThemePickerState>(
    {
      id: "theme-picker",
      initial: "closed",
      context: initial(args, authored),
      fields: {
        value: { event: "VALUE.SET" },
      },
      on: {
        ...openMoves,
      },
      states: {
        closed: {
          on: {
            ...openMoves,
            "TRIGGER.CLICK": { target: "open", cond: hasEnabled },
            OPEN: { target: "open", cond: hasEnabled },
            "ITEM.SELECT": { cond: selectEnabled, assign: selectItem },
          },
        },
        open: {
          on: {
            ...openMoves,
            "TRIGGER.CLICK": { target: "closed" },
            CLOSE: { target: "closed" },
            "ITEM.SELECT": {
              target: "closed",
              cond: selectEnabled,
              assign: selectItem,
            },
          },
        },
      },
    },
  );
}
