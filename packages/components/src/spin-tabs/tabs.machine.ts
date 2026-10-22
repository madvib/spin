/** Tabs machine: selection is component state, not platform state. */

import { createMachine, type Machine } from "@spin/runtime/fsm";
import { initial, type TabsArgs, type TabsContext } from "./tabs.state.ts";
import type { TabsEvents } from "./tabs.events.ts";

export function tabs(
  args: TabsArgs = {},
  authored: (name: string) => boolean,
): Machine<TabsContext, TabsEvents> {
  return createMachine<TabsContext, TabsEvents>({
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
    },
    states: {
      idle: {
        on: {
          "VALUE.SET": {
            // The KEY narrows the event: `event.value` is a string.
            assign: (_ctx, event) => ({
              value: typeof event.value === "string" ? event.value : "",
            }),
          },
          "TAB.SELECT": {
            assign: (ctx, event) =>
              event.value.length === 0 || event.value === ctx.value ? {} : { value: event.value },
          },
        },
      },
    },
  });
}
