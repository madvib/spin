/** Tabs machine: selection is component state, not platform state. */

import { createMachine, type Machine } from "@spin/runtime/fsm";
import {
  initial,
  parseItems,
  type TabsArgs,
  type TabsContext,
  type TabsState,
} from "./tabs.state.ts";
import type { TabsEvents } from "./tabs.events.ts";
import { selectTab, setValue } from "./tabs.transitions.ts";

export function tabs(
  args: TabsArgs = {},
  authored: (name: string) => boolean,
): Machine<TabsContext, TabsEvents, TabsState> {
  return createMachine<TabsContext, TabsEvents, TabsState>({
    id: "tabs",
    initial: "idle",
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host may
     * write, and the event each write carries. A field with an event is
     * REPORTED — the machine decides, and the change reaches the host; a
     * field without one is SILENT.
     *
     * The rows are the machine's own configuration: they never change
     * while the tabs live, so the host may not write them.
     */
    fields: {
      value: { event: "VALUE.SET" },
      items: { parse: parseItems },
      activationMode: {},
      loopFocus: {},
      deselectable: {},
      composite: {},
    },
    states: {
      idle: {
        on: {
          "VALUE.SET": { target: "idle", assign: setValue },
          "TAB.SELECT": { target: "idle", assign: selectTab },
        },
      },
      focused: {
        on: {
          "VALUE.SET": { target: "focused", assign: setValue },
          "TAB.SELECT": { target: "focused", assign: selectTab },
        },
      },
    },
  });
}
