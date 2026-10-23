import { createMachine, type Machine } from "@spin/runtime/fsm";
import { initial, type AsyncListArgs, type AsyncListContext, type AsyncListState } from "./async-list.state.ts";
import type { AsyncListEvents } from "./async-list.events.ts";
import {
  clearCursor,
  clearError,
  clearItems,
  hasCursor,
  hasSortFn,
  setError,
  setFilterText,
  setItems,
  setCursor,
  setSortDescriptor,
} from "./async-list.transitions.ts";

export function asyncList(
  args: AsyncListArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<AsyncListContext, AsyncListEvents, AsyncListState> {
  return createMachine<AsyncListContext, AsyncListEvents, AsyncListState>({
    id: "async-list",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      hasSortFn: {},
      load: {},
      sortFn: {},
    },
    on: {
      RELOAD: { target: "loading", assign: clearItems },
    },
    states: {
      idle: {
        on: {
          LOAD_MORE: [{ cond: hasCursor, target: "loading" }],
          SORT: [
            {
              cond: hasSortFn,
              target: "sorting",
              assign: [setSortDescriptor, clearCursor],
            },
            { target: "loading", assign: [setSortDescriptor, clearCursor] },
          ],
          FILTER: {
            target: "loading",
            assign: [setFilterText, clearCursor],
          },
        },
      },
      loading: {
        entry: [{ assign: clearError }],
        on: {
          SUCCESS: {
            target: "idle",
            assign: [setItems, setCursor, clearError],
          },
          ERROR: { target: "idle", assign: setError },
          ABORT: { target: "idle" },
          FILTER: {
            target: "loading",
            assign: [setFilterText, clearCursor],
          },
        },
      },
      sorting: {
        on: {
          SUCCESS: {
            target: "idle",
            assign: [setItems, setCursor, clearError],
          },
          ERROR: { target: "idle", assign: setError },
          ABORT: { target: "idle" },
          FILTER: {
            target: "loading",
            assign: [setFilterText, clearCursor],
          },
          RELOAD: { target: "loading", assign: clearItems },
          SORT: [
            {
              cond: hasSortFn,
              target: "sorting",
              assign: [setSortDescriptor, clearCursor],
            },
            { target: "loading", assign: [setSortDescriptor, clearCursor] },
          ],
        },
      },
    },
  });
}
