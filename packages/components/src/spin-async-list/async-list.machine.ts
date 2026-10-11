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

export interface SortDescriptor {
  readonly column: string;
  readonly direction: "ascending" | "descending";
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
}

export type AsyncListEvent =
  | { type: "RELOAD" }
  | { type: "LOAD_MORE" }
  | { type: "SORT"; sortDescriptor: SortDescriptor }
  | { type: "FILTER"; filterText: string }
  | { type: "SUCCESS"; items: readonly unknown[]; cursor: unknown; append: boolean }
  | { type: "ERROR"; error: unknown }
  | { type: "ABORT" };

export const config = {
  id: "async-list",
  initial: "idle",
  context: {
    items: [] as readonly unknown[],
    cursor: null as unknown,
    filterText: "",
    sortDescriptor: null as SortDescriptor | null,
    error: undefined as unknown,
    hasSortFn: false,
  },
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

export const implementations = {
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
