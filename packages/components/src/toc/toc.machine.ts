/** Table of contents machine: active heading tracking and navigation. */

import { createMachine, type Machine } from "@spinjs/runtime/fsm";
import {
  clampActiveIds,
  initial,
  parseItems,
  type TocArgs,
  type TocContext,
  type TocState,
} from "./toc.state.ts";
import type { TocEvents } from "./toc.events.ts";
import { selectItem, setActiveIds, setItems } from "./toc.transitions.ts";

export function toc(
  args: TocArgs = {},
  authored: (name: string) => boolean,
): Machine<TocContext, TocEvents, TocState> {
  return createMachine<TocContext, TocEvents, TocState>({
    id: "toc",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      items: { parse: parseItems, event: "ITEMS.SET" },
      activeIds: {
        parse: (raw: unknown) => clampActiveIds(Array.isArray(raw) ? raw : [], true),
        event: "ACTIVE.SET",
      },
      multiple: {},
      autoScroll: {},
      rootMargin: {},
      scrollBehavior: {},
    },
    states: {
      idle: {
        on: {
          "ITEMS.SET": { target: "idle", assign: setItems },
          "ACTIVE.SET": { target: "idle", assign: setActiveIds },
          "ITEM.SELECT": { target: "idle", assign: selectItem },
        },
      },
      focused: {
        on: {
          "ITEMS.SET": { target: "focused", assign: setItems },
          "ACTIVE.SET": { target: "focused", assign: setActiveIds },
          "ITEM.SELECT": { target: "focused", assign: selectItem },
        },
      },
    },
  });
}
