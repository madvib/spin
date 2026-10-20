import { dataAttr, defineComponent, isRecord, machineTick, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import {
  config,
  implementations,
  initial,
  isSortDescriptor,
  itemsOf,
  type AsyncListContext,
  type AsyncListEvent,
  type AsyncListInitial,
  type SortDescriptor,
} from "./async-list.machine.ts";

/**
 * Async-list definition: the DOM contract as data. The machine holds the
 * lifecycle (idle/loading/sorting); this file maps props to channels,
 * parts to attribute bags, commands to sends, and load-success/load-error
 * transitions to their events.
 *
 * Zag's connect returns no DOM props at all — this machine has no parts.
 * The parts here are the recipe's: a root that states the lifecycle, a
 * progress bar, the item list, the empty and error regions, the filter
 * field, the reload / load-more / sort triggers, and the sentinel that
 * drives the infinite scroll.
 *
 * The fetch lives here and nowhere else. Both the abort controller and
 * the sequence number are reflexes over host data, so per-bridge view
 * state owns them and the machine stays pure. The sequence is what makes
 * a stale resolution a no-op instead of a write over newer data, and the
 * controller is what tells a superseded fetch to stop. The `settled`
 * reflex drives the work: which event needs which fetch, and the
 * SUCCESS/ERROR report back outward.
 */

export interface AsyncListRow {
  readonly value: string;
  readonly label: string;
  readonly index: number;
}

/** A sort trigger: the column and the direction it asks for. */
export interface SortTrigger {
  readonly column: string;
  readonly direction: SortDescriptor["direction"];
}

export interface AsyncListSuccess {
  readonly items: readonly unknown[];
}

export interface AsyncListFailure {
  readonly error: unknown;
}

/** The signal the fetch aborts on, the cursor the page starts from, and
 * the filter and sort the fetch honors. */
export interface LoadDetails {
  readonly signal: AbortSignal | undefined;
  readonly filterText: string;
  readonly cursor: unknown;
  readonly sortDescriptor: SortDescriptor | undefined;
}

export interface LoadResult {
  readonly items: readonly unknown[];
  readonly cursor?: unknown;
}

export type LoadFn = (details: LoadDetails) => Promise<LoadResult>;

/** The sort details, and the two shapes its function may answer in. */
export interface SortDetails {
  readonly items: readonly unknown[];
  readonly descriptor: SortDescriptor | undefined;
  readonly filterText: string;
}

export type SortResult = { readonly items: readonly unknown[] } | undefined;

export type SortFn = (details: SortDetails) => SortResult | Promise<SortResult>;

export interface AsyncListApi {
  readonly items: readonly unknown[];
  readonly loading: boolean;
  readonly sorting: boolean;
  readonly empty: boolean;
  readonly hasMore: boolean;
  readonly error: unknown;
  readonly filterText: string;
  readonly cursor: unknown;
  readonly sortDescriptor: SortDescriptor | undefined;
  abort(): void;
  reload(): void;
  loadMore(): void;
  sort(sortDescriptor: SortDescriptor): void;
  setFilterText(filterText: string): void;
  clearFilter(): void;
  getRows(): readonly AsyncListRow[];
  getRootProps(): Record<string, unknown>;
  getProgressProps(): Record<string, unknown>;
  getListProps(): Record<string, unknown>;
  getItemProps(row: AsyncListRow): Record<string, unknown>;
  getEmptyProps(): Record<string, unknown>;
  getErrorProps(): Record<string, unknown>;
  getFilterInputProps(): Record<string, unknown>;
  getClearFilterProps(): Record<string, unknown>;
  getReloadProps(): Record<string, unknown>;
  getLoadMoreProps(): Record<string, unknown>;
  getSortTriggerProps(trigger: SortTrigger): Record<string, unknown>;
  getSentinelProps(): Record<string, unknown>;
}

/** A host function is not something the scope grammar can type, so it
 * rides the prop channel as a property write: declared, read live,
 * checked before it is called. */
const isLoadFn = (value: unknown): value is LoadFn => typeof value === "function";

const isSortFn = (value: unknown): value is SortFn => typeof value === "function";

const filterTextOf = (event: { readonly type: string } & Record<string, unknown>): string => {
  const text: unknown = event["filterText"];
  return typeof text === "string" ? text : "";
};

const descriptorOf = (event: { readonly type: string } & Record<string, unknown>): SortDescriptor | undefined => {
  const descriptor: unknown = event["sortDescriptor"];
  return isSortDescriptor(descriptor) ? descriptor : undefined;
};

/** A fetch the host was told to stop is not a failure. */
const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

/** A load the host resolved with. A result missing its items is an empty
 * page rather than a crash inside the assign. */

const fieldOf = (raw: unknown, field: string): unknown =>
  isRecord(raw) ? raw[field] : undefined;

const asLoadResult = (raw: unknown): LoadResult => {
  if (typeof raw !== "object" || raw === null) return { items: [] };
  const cursor: unknown = fieldOf(raw, "cursor");
  return {
    items: itemsOf(fieldOf(raw, "items")),
    ...(cursor === undefined ? {} : { cursor }),
  };
};

/** No result keeps the items that were sorted. */
const asSortResult = (raw: unknown): SortResult => {
  if (typeof raw !== "object" || raw === null) return undefined;
  return { items: itemsOf(fieldOf(raw, "items")) };
};

/** The `value` a row is addressed by: a non-empty string `value` field,
 * else the row's index. */
const textField = (item: unknown, field: string): string | undefined => {
  const raw: unknown = fieldOf(item, field);
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
};

const toRow = (item: unknown, index: number): AsyncListRow => {
  const value = textField(item, "value") ?? String(index);
  const label = textField(item, "label") ?? value;
  return { value, label, index };
};

type Ctx = AsyncListContext;

interface ScopeLike extends PartScope<unknown, AsyncListContext> {}

interface SlotLike<R> extends SlotScope<R, AsyncListContext> {}

/** Transport guarantees the raw prop bag is an AsyncListInitial-shaped object. */
const isAsyncListInitial = (raw: unknown): raw is AsyncListInitial =>
  raw !== null && typeof raw === "object";

/** Per-bridge async state: the abort controller, the sequence, and the
 * dependency hash. Keyed by the root element the bridge owns. */
interface AsyncView {
  aborting: AbortController | undefined;
  seq: number;
  lastDependencies: string | undefined;
  rowsSource: readonly unknown[] | undefined;
  rowsCache: readonly AsyncListRow[] | undefined;
}
const viewByRoot = new WeakMap<Element, AsyncView>();
const viewOf = (root: Element): AsyncView => {
  let view = viewByRoot.get(root);
  if (view === undefined) {
    view = { aborting: undefined, seq: 0, lastDependencies: undefined, rowsSource: undefined, rowsCache: undefined };
    viewByRoot.set(root, view);
  }
  return view;
};

/** Advance past the work in flight. A resolution from an earlier sequence
 * is dropped where it lands, and the previous fetch is told to stop. */
const advanceSequence = (view: AsyncView): number => {
  view.seq += 1;
  view.aborting?.abort();
  view.aborting = undefined;
  return view.seq;
};

type SettledSend = (event: { readonly type: string } & Record<string, unknown>) => void;

const startFetch = (
  view: AsyncView,
  send: SettledSend,
  load: LoadFn,
  event: { readonly type: string } & Record<string, unknown>,
  context: Ctx,
): void => {
  const mine = advanceSequence(view);
  const controller = new AbortController();
  view.aborting = controller;
  const loadMore = event.type === "LOAD_MORE";
  const details: LoadDetails = {
    signal: controller.signal,
    filterText: event.type === "FILTER" ? filterTextOf(event) : context.filterText,
    cursor: loadMore ? context.cursor : null,
    sortDescriptor: event.type === "SORT"
      ? descriptorOf(event)
      : context.sortDescriptor ?? undefined,
  };
  void load(details).then(
    (result: unknown) => {
      if (mine !== view.seq) return;
      const resolved = asLoadResult(result);
      send({
        type: "SUCCESS",
        items: resolved.items,
        cursor: resolved.cursor,
        append: loadMore,
      });
    },
    (error: unknown) => {
      if (mine !== view.seq) return;
      if (isAbortError(error)) return;
      send({ type: "ERROR", error });
    },
  );
};

const startSort = (
  view: AsyncView,
  send: SettledSend,
  sort: SortFn,
  event: { readonly type: string } & Record<string, unknown>,
  context: Ctx,
): void => {
  const mine = advanceSequence(view);
  const details: SortDetails = {
    items: context.items,
    descriptor: event.type === "SORT"
      ? descriptorOf(event)
      : context.sortDescriptor ?? undefined,
    filterText: context.filterText,
  };
  let settled: SortResult | Promise<SortResult>;
  try {
    settled = sort(details);
  } catch (error: unknown) {
    if (mine === view.seq) send({ type: "ERROR", error });
    return;
  }
  void Promise.resolve(settled).then(
    (result: unknown) => {
      if (mine !== view.seq) return;
      const resolved = asSortResult(result);
      send({
        type: "SUCCESS",
        items: resolved?.items ?? context.items,
        cursor: null,
        append: false,
      });
    },
    (error: unknown) => {
      if (mine !== view.seq) return;
      send({ type: "ERROR", error });
    },
  );
};

const def: ComponentDef<AsyncListContext, AsyncListEvent> = {
  name: "async-list",
  config,
  implementations,
  seed: (raw, _authored) => {
    const props: AsyncListInitial = isAsyncListInitial(raw) ? raw : {};
    const shaped = initial(props);
    // No throw: a static list (initialItems, no loader) renders, sorts,
    // and filters client-side. Loads without a loader are already no-ops
    // in settled, so the throw only ever killed static usage.
    return { ...shaped, cursor: null, error: undefined, dependenciesHash: undefined };
  },
  // An autoReload mount loads once; the reconcile watcher answers every
  // dependency change after it.
  establish: (raw) => {
    const props: AsyncListInitial = isAsyncListInitial(raw) ? raw : {};
    return props["autoReload" as keyof AsyncListInitial] === true ? [{ type: "RELOAD" }] : [];
  },
  // The reflex table runs after every transmit: which event needs which
  // piece of async work, with the state the send landed in.
  settled: ({ event, before, after, props, root, send }) => {
    const view = viewOf(root());
    const load: unknown = props["load"];
    if (!isLoadFn(load)) return;
    const beforeState = before.state;
    const afterCtx = after.context;
    const afterState = after.state;
    // Sorting drives the sort fn; loading drives the fetch. The sort fn
    // rides the props, read live at drive time.
    if (event.type === "ABORT") {
      if (beforeState !== "idle") advanceSequence(view);
      return;
    }
    if (event.type === "SUCCESS" || event.type === "ERROR") return;
    if (afterState === "sorting") {
      const sort = props["sortFn"];
      if (!isSortFn(sort)) return;
      startSort(view, send, sort, event, afterCtx);
      return;
    }
    if (afterState === "loading") {
      startFetch(view, send, load, event, afterCtx);
    }
  },
  scalars: ["hasSortFn"],
  scalarsOf: (parsed) => ({
    hasSortFn: isSortFn(parsed["sortFn"]),
  }),
  reconcile: ({ context, parsed, send }) => {
    // The dependencies watcher: the mount hash is captured, never
    // dispatched — the watcher fires on a change only, and the mount load
    // is autoReload's job.
    const raw: unknown = parsed["dependencies"];
    const dependencies = itemsOf(raw).filter((dependency) => Boolean(dependency)).join(",");
    if (context.dependenciesHash === undefined) {
      context.dependenciesHash = dependencies;
      return false;
    }
    if (dependencies !== context.dependenciesHash) {
      context.dependenciesHash = dependencies;
      send({ type: "RELOAD" });
      return true;
    }
    return false;
  },
  parts: {
    root: {
      sig: (scope) => `${scope.state}`,
      attrs: (scope) => ({
        id: scope.id(""),
        "data-state": scope.state,
        "data-loading": dataAttr(scope.state === "loading" || scope.state === "sorting"),
      }),
    },
    progress: {
      sig: (scope) => `${scope.state}`,
      attrs: (scope) => ({
        id: scope.id("progress"),
        role: "progressbar",
        "aria-hidden": true,
        "aria-busy": scope.state === "loading" || scope.state === "sorting",
        "data-state": scope.state,
      }),
    },
    list: {
      sig: (scope) => {
        const items = scope.context.items;
        return `${scope.state} ${items.length}`;
      },
      attrs: (scope) => {
        const count = scope.context.items.length;
        const loading = scope.state === "loading" || scope.state === "sorting";
        return {
          id: scope.id("list"),
          role: "list",
          "aria-busy": loading,
          "data-state": scope.state,
          "data-count": count,
          "data-empty": dataAttr(count === 0),
        };
      },
    },
    empty: {
      sig: (scope) => `${scope.context.items.length}`,
      attrs: (scope) => {
        const count = scope.context.items.length;
        return {
          id: scope.id("empty"),
          "data-empty": dataAttr(count === 0),
        };
      },
    },
    error: {
      sig: (scope) => `${scope.context.error !== undefined}`,
      attrs: (scope) => {
        const failed = scope.context.error !== undefined;
        return {
          id: scope.id("error"),
          role: "alert",
          "data-state": failed ? "error" : "idle",
        };
      },
    },
    filterInput: {
      id: "filter",
      sig: (scope) => {
        const ctx = scope.context;
        return `${ctx.filterText} ${scope.state === "loading" || scope.state === "sorting"}`;
      },
      attrs: (scope) => {
        const ctx = scope.context;
        return {
          id: scope.id("filterInput"),
          type: "text",
          value: ctx.filterText,
          placeholder: "Filter",
          autoComplete: "off",
          "data-state": scope.state,
          onInput: (event: InputEvent): void => {
            const target = event.currentTarget;
            if (!(target instanceof HTMLInputElement)) return;
            scope.send({ type: "FILTER", filterText: target.value });
          },
        };
      },
    },
    clearFilter: {
      id: "clear-filter",
      sig: (scope) => `${scope.context.filterText.length === 0}`,
      attrs: (scope) => {
        const empty = scope.context.filterText.length === 0;
        return {
          id: scope.id("clearFilter"),
          type: "button",
          "aria-label": "Clear filter",
          "data-filled": dataAttr(!empty),
          hidden: empty,
          onClick: (): void => scope.send({ type: "FILTER", filterText: "" }),
        };
      },
    },
    reload: {
      sig: (scope) => `${scope.state}`,
      attrs: (scope) => ({
        id: scope.id("reload"),
        type: "button",
        "data-state": scope.state,
        onClick: (): void => scope.send({ type: "RELOAD" }),
      }),
    },
    loadMore: {
      id: "load-more",
      sig: (scope) => {
        const ctx = scope.context;
        return `${ctx.cursor != null} ${scope.state}`;
      },
      attrs: (scope) => {
        const ctx = scope.context;
        const more = ctx.cursor != null;
        const loading = scope.state === "loading" || scope.state === "sorting";
        return {
          id: scope.id("loadMore"),
          type: "button",
          "data-state": scope.state,
          "data-more": dataAttr(more),
          hidden: !more,
          disabled: loading,
          onClick: (): void => scope.send({ type: "LOAD_MORE" }),
        };
      },
    },
    sentinel: {
      sig: (scope) => {
        const ctx = scope.context;
        return `${ctx.cursor != null} ${scope.state}`;
      },
      attrs: (scope) => {
        const ctx = scope.context;
        const more = ctx.cursor != null;
        return {
          id: scope.id("sentinel"),
          "aria-hidden": true,
          "data-state": scope.state,
          hidden: !more,
          "data-more": dataAttr(more),
          // The infinite scroll: hidden once the cursor runs out, and
          // never visible to anything but the action attached to it.
          "use:infinite-scroll": {
            enabled: more,
            onLoadMore: (): void => scope.send({ type: "LOAD_MORE" }),
          },
        };
      },
    },
  },
  slots: {
    item: {
      indexes: (context: AsyncListContext) => rowsFor(context.items),
      sig: (scope: SlotLike<AsyncListRow>) => `${scope.slot.value}`,
      attrs: (scope: SlotLike<AsyncListRow>) => {
        const row = scope.slot;
        return {
          id: scope.id("item", row.value),
          role: "listitem",
          "data-value": row.value,
          "data-index": row.index,
        };
      },
    },
    sortTrigger: {
      id: "sort-trigger",
      indexes: () => [],
      sig: (scope: SlotLike<SortTrigger>) => {
        const trigger = scope.slot;
        const ctx = scope.context;
        const active = ctx.sortDescriptor?.column === trigger.column &&
          ctx.sortDescriptor?.direction === trigger.direction;
        return `${scope.state} ${active}`;
      },
      attrs: (scope: SlotLike<SortTrigger>) => {
        const trigger = scope.slot;
        const ctx = scope.context;
        const active = ctx.sortDescriptor?.column === trigger.column &&
          ctx.sortDescriptor?.direction === trigger.direction;
        return {
          id: scope.id("sortTrigger", `${trigger.column}:${trigger.direction}`),
          type: "button",
          "data-column": trigger.column,
          "data-direction": trigger.direction,
          "data-state": scope.state,
          "data-active": dataAttr(active),
          "aria-pressed": active,
          onClick: (): void => scope.send({ type: "SORT", sortDescriptor: trigger }),
        };
      },
    },
  },
  commands: {
    abort: { event: () => ({ type: "ABORT" }) },
    reload: { event: () => ({ type: "RELOAD" }) },
    loadMore: { event: () => ({ type: "LOAD_MORE" }) },
    sort: {
      event: (args) => {
        const descriptor = args[0];
        if (isSortDescriptor(descriptor)) return { type: "SORT", sortDescriptor: descriptor };
        return { type: "SORT", sortDescriptor: { column: "", direction: "ascending" } };
      },
    },
    setFilterText: {
      event: (args) => {
        const text = args[0];
        return { type: "FILTER", filterText: typeof text === "string" ? text : "" };
      },
    },
    clearFilter: { event: () => ({ type: "FILTER", filterText: "" }) },
  },
  readers: {
    items: { read: (context) => [...context.items] },
    loading: {
      read: (_context, state) => state === "loading" || state === "sorting",
    },
    sorting: { read: (_context, state) => state === "sorting" },
    empty: { read: (context) => context.items.length === 0 },
    hasMore: { read: (context) => context.cursor != null },
    error: { read: (context) => context.error },
    filterText: { read: (context) => context.filterText },
    cursor: { read: (context) => context.cursor ?? undefined },
    sortDescriptor: { read: (context) => context.sortDescriptor ?? undefined },
  },
  methods: {
    getRows: {
      call: (context) => {
        // The `for` effect re-runs only on signals its source reads, and
        // the rows live in machine context: the tick is the subscription
        // that re-reads them after a load.
        machineTick();
        return rowsFor(context.items);
      },
    },
  },
  events: {
    "load-success": {
      prop: "onSuccess",
      watch: () => [],
      detail: () => ({ items: [] }),
      select: (event) => {
        if (event.type !== "SUCCESS") return null;
        return { items: [...itemsOf(event["items"])] };
      },
    },
    "load-error": {
      prop: "onError",
      watch: () => [],
      detail: () => ({ error: undefined }),
      select: (event) =>
        event.type === "ERROR" ? { error: event["error"] } : null,
    },
  },
};

const toRowIndexed = (item: unknown, index: number): AsyncListRow => toRow(item, index);

/** Rows memoized on the items array's identity: a fresh row object per
 * read would replace the nodes and detach every gesture in flight. A load
 * produces a new array, so the rows rebuild exactly when the data does.
 * Pure data, so sharing across bridges on one array is correct. */
const rowsByItems = new WeakMap<readonly unknown[], readonly AsyncListRow[]>();
const rowsFor = (items: readonly unknown[]): readonly AsyncListRow[] => {
  const hit = rowsByItems.get(items);
  if (hit !== undefined) return hit;
  const rows = items.map(toRowIndexed);
  rowsByItems.set(items, rows);
  return rows;
};

export const asyncList = defineComponent<AsyncListContext, AsyncListEvent, AsyncListApi>(def);
