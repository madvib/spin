/**
 * Async-list machine: the load lifecycle and the cursor the pages walk.
 *
 * Zag ships three states and all three survive: `idle` holds what the last
 * load produced, `loading` is a fetch in flight, `sorting` is a client-side
 * sort in flight. The fetch is a bridge-owned reflex — a promise, an abort
 * controller, a sequence number — that reports back through
 * SUCCESS/ERROR/ABORT; there are no transitional states.
 *
 * The seed lands at service creation, not through a transition, and the
 * cursor is `null` when there is no next page: Zag's `cursor != null` guard
 * on LOAD_MORE, so an exhausted list ignores load-more.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const clearItems = () : Partial<AsyncListContext> => { return ({ items: [] }); };

const setItems = (ctx: AsyncListContext, e: AsyncListEvent) : Partial<AsyncListContext> => {
      if (e.type !== "SUCCESS") return {};
      // A load-more appends; every other result replaces. The bridge
      // normalizes a host's resolution, so the items it forwards are already
      // an array.
      const loaded = [...e.items];
      return { items: e.append ? [...ctx.items, ...loaded] : loaded };
    };

const setCursor = (_ctx: AsyncListContext, e: AsyncListEvent) : Partial<AsyncListContext> => { return e.type === "SUCCESS" ? { cursor: e.cursor ?? null } : {}; };

const setError = (_ctx: AsyncListContext, e: AsyncListEvent) : Partial<AsyncListContext> => { return e.type === "ERROR" ? { error: e.error } : {}; };

const clearError = () : Partial<AsyncListContext> => { return ({ error: undefined }); };

const setFilterText = (_ctx: AsyncListContext, e: AsyncListEvent) : Partial<AsyncListContext> => { return e.type === "FILTER" ? { filterText: e.filterText } : {}; };

const setSortDescriptor = (_ctx: AsyncListContext, e: AsyncListEvent) : Partial<AsyncListContext> => { return e.type === "SORT" ? { sortDescriptor: e.sortDescriptor } : {}; };

const clearCursor = () : Partial<AsyncListContext> => { return ({ cursor: null }); };

const hasSortFn = (ctx: AsyncListContext) : boolean => { return ctx.hasSortFn; };



export interface SortDescriptor {
  readonly column: string;
  readonly direction: "ascending" | "descending";
}

/**
 * The async-list's arguments: the values the host may set.
 *
 * The seeds are the list's starting state, and the sort function is the
 * host's own — the machine only asks whether it is there.
 */
export interface AsyncListArgs {
  initialItems?: readonly unknown[];
  initialFilterText?: string;
  initialSortDescriptor?: SortDescriptor;
  sortFn?: unknown;
}

export const isSortDescriptor = (value: unknown): value is SortDescriptor => {
  if (typeof value !== "object" || value === null) return false;
  const column: unknown = Reflect.get(value, "column");
  const direction: unknown = Reflect.get(value, "direction");
  return typeof column === "string" &&
    (direction === "ascending" || direction === "descending");
};

/** An array off the prop channel: the grammar's `string[]` coerces a
 * `= []` default to `["[]"]`, so the lone artifact entry drops. */
export function itemsOf(raw: unknown): readonly unknown[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 1 && raw[0] === "[]") return [];
  return [...raw];
}

/** The static seed lands at service creation, not through a transition. */
export function initial(args: AsyncListArgs, authored: (name: string) => boolean): AsyncListContext {
  // A host that wrote `defaultSortFn` wrote the channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const sortFn = written("sortFn") ? args.sortFn : undefined;
  return {
    items: itemsOf(args.initialItems),
    cursor: null,
    filterText: typeof args.initialFilterText === "string"
      ? args.initialFilterText
      : "",
    sortDescriptor: isSortDescriptor(args.initialSortDescriptor)
      ? args.initialSortDescriptor
      : null,
    error: undefined,
    hasSortFn: typeof sortFn === "function",
    dependenciesHash: undefined,
  };
}

export interface AsyncListContext {
  items: readonly unknown[];
  cursor: unknown;
  filterText: string;
  sortDescriptor: SortDescriptor | null;
  error: unknown;
  hasSortFn: boolean;
  dependenciesHash: string | undefined;
}

export interface AsyncListEvents {
  "RELOAD": {};
  "LOAD_MORE": {};
  "SORT": { sortDescriptor: SortDescriptor };
  "FILTER": { filterText: string };
  "SUCCESS": { items: readonly unknown[]; cursor: unknown; append: boolean };
  "ERROR": { error: unknown };
  "ABORT": {};
}

export type AsyncListEvent = EventUnion<AsyncListEvents>;


const config: Omit<MachineSpec<AsyncListContext, AsyncListEvents>, "context"> = {
  id: "async-list",
  initial: "idle",
  // A reload is valid from anywhere; `sorting` shadows the root's to cancel
  // the in-flight sort on the way out.
  on: {
    RELOAD: { target: "loading", assign: clearItems },
  },
  states: {
    idle: {
      on: {
        LOAD_MORE: [{ cond: (ctx) => { return ctx.cursor != null; }, target: "loading" }],
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
      // A fetch in flight holds no stale error.
      entry: [{ assign: clearError }],
      on: {
        SUCCESS: {
          target: "idle",
          assign: [setItems, setCursor, clearError],
        },
        ERROR: { target: "idle", assign: setError },
        ABORT: { target: "idle" },
        // A filter change mid-flight re-enters `loading`: the fork runs exit
        // and entry for an explicit target (Zag's `reenter: true`), so the
        // bridge aborts the superseded fetch before the new one starts.
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
};

const implementations = {};

export function asyncList(
  args: AsyncListArgs = {},
  authored: (name: string) => boolean,
): Machine<AsyncListContext, AsyncListEvents> {
  return createMachine<AsyncListContext, AsyncListEvents>({
    ...config,
    context: initial(args, authored),
    fields: {
      hasSortFn: {},
    },
  });
}
