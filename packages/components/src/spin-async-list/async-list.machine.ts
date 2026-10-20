/**
 * Async-list machine: the load lifecycle and the cursor the pages walk.
 *
 * Zag ships three states, and all three survive. `idle` holds what the last
 * load produced; `loading` is a fetch in flight; `sorting` is a client-side
 * sort in flight. No transitional states: the fetch itself is a bridge-owned
 * reflex (a promise plus an abort controller plus a sequence number, Zag's
 * `refs`) that reports back through SUCCESS/ERROR/ABORT, exactly the way the
 * clock in spin-timer is an action the view drives. The machine is pure.
 *
 * Two facts from the props reach the config as context, because the fork's
 * conds read context and a host's `sort` function is not state: `hasSortFn`
 * says whether SORT takes the client-side branch, and the initial seed
 * (`initialItems`, `initialFilterText`, `initialSortDescriptor`) lands here
 * at service creation rather than through a transition.
 *
 * The cursor is `null` when there is no next page, which is Zag's
 * `cursor != null` guard on LOAD_MORE: an exhausted list ignores load-more.
 * Zag's `undefined` cursor normalizes to `null` on the way in, because the
 * fork's context has no optional fields.
 */

import { createMachine, type Machine } from "@spin/runtime/fsm";

export interface SortDescriptor {
  readonly column: string;
  readonly direction: "ascending" | "descending";
}

/**
 * The async-list's arguments: the values the host may set.
 *
 * The names are the element's prop names — the machine is instantiated
 * with the element's prop bag and picks what it wants. The seeds
 * (`initialItems`, `initialFilterText`, `initialSortDescriptor`) are the
 * list's starting state; the sort function is the host's own, and the
 * machine only asks whether it is there.
 */
export interface AsyncListArgs {
  /** The items the list starts with. */
  initialItems?: readonly unknown[];
  /** The filter the list starts with. */
  initialFilterText?: string;
  /** The sort the list starts with. */
  initialSortDescriptor?: SortDescriptor;
  /** The host's sort function, when it wrote one. */
  sortFn?: unknown;
}

export const isSortDescriptor = (value: unknown): value is SortDescriptor => {
  if (typeof value !== "object" || value === null) return false;
  const column: unknown = Reflect.get(value, "column");
  const direction: unknown = Reflect.get(value, "direction");
  return typeof column === "string" &&
    (direction === "ascending" || direction === "descending");
};

/** An array off the prop channel: property writes land verbatim, and the
 * grammar's `string[]` coerces a `= []` default to `["[]"]` — the lone
 * artifact entry drops, once, for every reader. */
export function itemsOf(raw: unknown): readonly unknown[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 1 && raw[0] === "[]") return [];
  return [...raw];
}

/** The machine's context: the static seed lands at service creation, not
 * through a transition — a static list renders, sorts, and filters
 * client-side. */
export function initial(args: AsyncListArgs): AsyncListContext {
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
    hasSortFn: typeof args.sortFn === "function",
    dependenciesHash: undefined,
  };
}

export interface AsyncListContext {
  /** The loaded items. Host data: the machine never looks inside. */
  items: readonly unknown[];
  /** Where the next page starts; `null` means the list is exhausted. */
  cursor: unknown;
  filterText: string;
  sortDescriptor: SortDescriptor | null;
  /** The last failure, or undefined while the load is clean. */
  error: unknown;
  /** The host authored a `sort` function — the guard's only input. */
  hasSortFn: boolean;
  /** The dependency hash the watcher captured; undefined until mounted. */
  dependenciesHash: string | undefined;
}

export type AsyncListEvent =
  | { type: "RELOAD" }
  | { type: "LOAD_MORE" }
  | { type: "SORT"; sortDescriptor: SortDescriptor }
  | { type: "FILTER"; filterText: string }
  | { type: "SUCCESS"; items: readonly unknown[]; cursor: unknown; append: boolean }
  | { type: "ERROR"; error: unknown }
  | { type: "ABORT" };

const config = {
  id: "async-list",
  initial: "idle",
  // Zag's root tier. A reload is valid from anywhere: `sorting` shadows it to
  // cancel the in-flight sort on the way, which is what its extra work is.
  on: {
    RELOAD: { target: "loading", actions: [{ assign: "clearItems" }] },
  },
  states: {
    idle: {
      on: {
        // Guarded double transition: an exhausted list ignores load-more,
        // which is Zag's `hasCursor` guard.
        LOAD_MORE: [{ cond: "hasCursor", target: "loading" }],
        SORT: [
          {
            cond: "hasSortFn",
            target: "sorting",
            actions: [{ assign: "setSortDescriptor" }, { assign: "clearCursor" }],
          },
          { target: "loading", actions: [{ assign: "setSortDescriptor" }, { assign: "clearCursor" }] },
        ],
        FILTER: {
          target: "loading",
          actions: [{ assign: "setFilterText" }, { assign: "clearCursor" }],
        },
      },
    },
    loading: {
      // Zag's performFetch entry: a fetch in flight holds no stale error.
      entry: [{ assign: "clearError" }],
      on: {
        SUCCESS: {
          target: "idle",
          actions: [{ assign: "setItems" }, { assign: "setCursor" }, { assign: "clearError" }],
        },
        ERROR: { target: "idle", actions: [{ assign: "setError" }] },
        ABORT: { target: "idle" },
        // A filter change mid-flight re-enters `loading`: the fork always
        // runs exit and entry for an explicit target, which is Zag's
        // `reenter: true` here, so the superseded fetch is cancelled by the
        // bridge's abort before the new one starts.
        FILTER: {
          target: "loading",
          actions: [{ assign: "setFilterText" }, { assign: "clearCursor" }],
        },
      },
    },
    sorting: {
      on: {
        SUCCESS: {
          target: "idle",
          actions: [{ assign: "setItems" }, { assign: "setCursor" }, { assign: "clearError" }],
        },
        ERROR: { target: "idle", actions: [{ assign: "setError" }] },
        ABORT: { target: "idle" },
        FILTER: {
          target: "loading",
          actions: [{ assign: "setFilterText" }, { assign: "clearCursor" }],
        },
        RELOAD: { target: "loading", actions: [{ assign: "clearItems" }] },
        SORT: [
          {
            cond: "hasSortFn",
            target: "sorting",
            actions: [{ assign: "setSortDescriptor" }, { assign: "clearCursor" }],
          },
          { target: "loading", actions: [{ assign: "setSortDescriptor" }, { assign: "clearCursor" }] },
        ],
      },
    },
  },
};

const implementations = {
  conds: {
    hasCursor: (ctx: AsyncListContext): boolean => ctx.cursor != null,
    hasSortFn: (ctx: AsyncListContext): boolean => ctx.hasSortFn,
  },
  assigns: {
    clearItems: (): Partial<AsyncListContext> => ({ items: [] }),
    setItems: (ctx: AsyncListContext, e: AsyncListEvent): Partial<AsyncListContext> => {
      if (e.type !== "SUCCESS") return {};
      // A load-more appends; every other result replaces. The bridge is
      // where a host's resolution is normalized, so the items it forwards
      // are already an array.
      const loaded = [...e.items];
      return { items: e.append ? [...ctx.items, ...loaded] : loaded };
    },
    setCursor: (_ctx: AsyncListContext, e: AsyncListEvent): Partial<AsyncListContext> =>
      e.type === "SUCCESS" ? { cursor: e.cursor ?? null } : {},
    setError: (_ctx: AsyncListContext, e: AsyncListEvent): Partial<AsyncListContext> =>
      e.type === "ERROR" ? { error: e.error } : {},
    clearError: (): Partial<AsyncListContext> => ({ error: undefined }),
    setFilterText: (_ctx: AsyncListContext, e: AsyncListEvent): Partial<AsyncListContext> =>
      e.type === "FILTER" ? { filterText: e.filterText } : {},
    setSortDescriptor: (_ctx: AsyncListContext, e: AsyncListEvent): Partial<AsyncListContext> =>
      e.type === "SORT" ? { sortDescriptor: e.sortDescriptor } : {},
    clearCursor: (): Partial<AsyncListContext> => ({ cursor: null }),
  },
};

/**
 * The async-list machine: state and nothing else. It is headless — it
 * knows its own arguments, and nothing about props, markup, or the DOM.
 */
export function asyncList(
  args: AsyncListArgs = {},
): Machine<AsyncListContext, AsyncListEvent> {
  return createMachine<AsyncListContext, AsyncListEvent>({
    ...config,
    context: initial(args),
    ...implementations,
    /**
     * The machine's contract with its hosts: the context fields a host
     * may write, and the event each write carries.
     *
     * A field with an event is REPORTED: the host's write is an event,
     * the machine decides, and the change reaches the host. A field
     * without one is SILENT: the host's write lands in the field, and
     * nothing reports.
     */
    fields: {
      hasSortFn: {},
    },
  });
}
