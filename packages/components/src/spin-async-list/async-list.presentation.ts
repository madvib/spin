import { ariaBusy, ariaHidden, ariaPressed, dataAttr, defineComponent, isRecord, machineTick, type ApiOf, type ComponentDef, type ScopeFor, type SlotScopeFor } from "@spin/runtime";
import { asyncList as asyncListMachine } from "./async-list.machine.ts";
import type { AsyncListArgs, AsyncListContext, AsyncListState, SortDescriptor } from "./async-list.state.ts";
import type { AsyncListEvents } from "./async-list.events.ts";
import { isSortDescriptor, itemsOf } from "./async-list.state.ts";
/**
 * Async-list definition: the DOM contract as data.
 *
 * The fetch lives here and nowhere else: the abort controller and the
 * sequence number are per-bridge reflexes over host data. The sequence
 * makes a stale resolution a no-op instead of a write over newer data; the
 * controller tells a superseded fetch to stop.
 */

export interface AsyncListRow {
  readonly value: string;
  readonly label: string;
  readonly index: number;
}

/** A sort trigger. */
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

export interface SortDetails {
  readonly items: readonly unknown[];
  readonly descriptor: SortDescriptor | undefined;
  readonly filterText: string;
}

export type SortResult = { readonly items: readonly unknown[] } | undefined;

export type SortFn = (details: SortDetails) => SortResult | Promise<SortResult>;

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

type ScopeLike = ScopeFor<AsyncListContext, AsyncListEvents, AsyncListState>;
type SlotLike<R> = SlotScopeFor<R, AsyncListContext, AsyncListEvents, AsyncListState>;

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

const def = {
  name: "async-list",
  machine: (args: AsyncListArgs, authored: (name: string) => boolean) => asyncListMachine(args, authored),
  start: "idle",
  // `autoReload` loads once at mount; the reconcile watcher answers every
  // dependency change after it.
  establish: (raw) => {
    return raw["autoReload"] === true ? [{ type: "RELOAD" }] : [];
  },
  // Runs after every transmit: which event needs which async work, with the
  // state the send landed in.
  settled: ({ event, before, after, root, send }) => {
    const view = viewOf(root());
    const load: unknown = after.context.load;
    if (!isLoadFn(load)) return;
    const beforeState = before.state;
    const afterCtx = after.context;
    const afterState = after.state;
    if (event.type === "ABORT") {
      if (beforeState !== "idle") advanceSequence(view);
      return;
    }
    if (event.type === "SUCCESS" || event.type === "ERROR") return;
    if (afterState === "sorting") {
      const sort = after.context.sortFn;
      if (!isSortFn(sort)) return;
      startSort(view, send, sort, event, afterCtx);
      return;
    }
    if (afterState === "loading") {
      startFetch(view, send, load, event, afterCtx);
    }
  },
  // The derived flag follows the host's sort function, so a host that
  // writes one after the mount still sorts client-side. The merge runs
  // BEFORE the send (on the way in), so a sort issued right after the
  // write takes the client-side branch; the reconcile would be too late.
  scalarsOf: (parsed) => ({
    hasSortFn: isSortFn(parsed["sortFn"]),
    load: parsed["load"],
    sortFn: parsed["sortFn"],
  }),
  reconcile: ({ context, parsed, send }) => {
    let moved = false;
    // The mount hash is captured, never dispatched: the watcher fires on a
    // change only, and the mount load is autoReload's job.
    const raw: unknown = parsed["dependencies"];
    const dependencies = itemsOf(raw).filter((dependency) => Boolean(dependency)).join(",");
    if (context.dependenciesHash === undefined) {
      context.dependenciesHash = dependencies;
      return moved;
    }
    if (dependencies !== context.dependenciesHash) {
      context.dependenciesHash = dependencies;
      send({ type: "RELOAD" });
      return true;
    }
    return moved;
  },
  parts: {
    root: {
      attrs: (scope: ScopeLike) => ({
        "data-state": scope.state,
        "data-loading": scope.attr(scope.state === "loading" || scope.state === "sorting"),
      }),
    },
    progress: {
      attrs: (scope: ScopeLike) => ({
        role: "progressbar",
        ...ariaHidden(true),
        ...ariaBusy(scope.state === "loading" || scope.state === "sorting"),
        "data-state": scope.state,
      }),
    },
    list: {
      attrs: (scope) => {
        const count = scope.context.items.length;
        const loading = scope.state === "loading" || scope.state === "sorting";
        return {
          role: "list",
          ...ariaBusy(loading),
          "data-state": scope.state,
          "data-count": count,
          "data-empty": dataAttr(count === 0),
        };
      },
    },
    empty: {
      attrs: (scope) => {
        const count = scope.context.items.length;
        return {
          "data-empty": dataAttr(count === 0),
        };
      },
    },
    error: {
      attrs: (scope) => {
        const failed = scope.context.error !== undefined;
        return {
          role: "alert",
          "data-state": failed ? "error" : "idle",
        };
      },
    },
    filterInput: {
      id: "filter",
      attrs: (scope) => {
        const ctx = scope.context;
        return {
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
      attrs: (scope) => {
        const empty = scope.context.filterText.length === 0;
        return {
          type: "button",
          "aria-label": "Clear filter",
          "data-filled": dataAttr(!empty),
          hidden: empty,
          onClick: (): void => scope.send({ type: "FILTER", filterText: "" }),
        };
      },
    },
    reload: {
      attrs: (scope: ScopeLike) => ({
        type: "button",
        "data-state": scope.state,
        onClick: (): void => scope.send({ type: "RELOAD" }),
      }),
    },
    loadMore: {
      id: "load-more",
      attrs: (scope) => {
        const ctx = scope.context;
        const more = ctx.cursor != null;
        const loading = scope.state === "loading" || scope.state === "sorting";
        return {
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
      attrs: (scope) => {
        const ctx = scope.context;
        const more = ctx.cursor != null;
        return {
          ...ariaHidden(true),
          "data-state": scope.state,
          hidden: !more,
          "data-more": dataAttr(more),
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
          ...ariaPressed(active),
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
      event: ([descriptor]: [descriptor: SortDescriptor]) => ({ type: "SORT" as const, sortDescriptor: descriptor }),
    },
    setFilterText: {
      event: ([text]: [text: string]) => ({ type: "FILTER" as const, filterText: text }),
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
        // The `for` effect re-runs only on the signals its source reads:
        // the tick is the subscription that re-reads the rows after a load.
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
} satisfies ComponentDef<AsyncListContext, AsyncListEvents, Record<string, unknown>, AsyncListArgs, AsyncListState>;

const toRowIndexed = (item: unknown, index: number): AsyncListRow => toRow(item, index);

/** Rows memoized on the items array's identity: a fresh row object per
 * read would replace the nodes and detach every gesture in flight. A load
 * produces a new array, so the rows rebuild exactly when the data does.
 * Pure data, so sharing one array's rows across bridges is correct. */
const rowsByItems = new WeakMap<readonly unknown[], readonly AsyncListRow[]>();
const rowsFor = (items: readonly unknown[]): readonly AsyncListRow[] => {
  const hit = rowsByItems.get(items);
  if (hit !== undefined) return hit;
  const rows = items.map(toRowIndexed);
  rowsByItems.set(items, rows);
  return rows;
};

export type AsyncListApi = ApiOf<typeof def>;
export const asyncList = defineComponent<AsyncListContext, AsyncListEvents, AsyncListApi, AsyncListArgs, AsyncListState>(def);
