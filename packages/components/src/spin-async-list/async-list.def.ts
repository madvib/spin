import {
  dataAttr,
  defineComponent,
  machineTick,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import {
  config,
  implementations,
  type AsyncListContext,
  type AsyncListEvent,
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

const isSortDescriptor = (value: unknown): value is SortDescriptor => {
  if (typeof value !== "object" || value === null) return false;
  const column: unknown = Reflect.get(value, "column");
  const direction: unknown = Reflect.get(value, "direction");
  return typeof column === "string" &&
    (direction === "ascending" || direction === "descending");
};

/** A fetch the host was told to stop is not a failure. */
const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

/** An array off the prop channel, whatever actually arrived. The
 * grammar's `string[]` coerces a `= []` default to `["[]"]`; a property
 * write lands verbatim. The lone artifact entry is dropped here, once,
 * for every reader. */
const asArray = (raw: unknown): readonly unknown[] => {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 1 && raw[0] === "[]") return [];
  const out: unknown[] = [];
  for (const entry of raw) out.push(entry);
  return out;
};

/** A load the host resolved with. A result missing its items is an empty
 * page rather than a crash inside the assign. */
const asLoadResult = (raw: unknown): LoadResult => {
  if (typeof raw !== "object" || raw === null) return { items: [] };
  const cursor: unknown = Reflect.get(raw, "cursor");
  return {
    items: asArray(Reflect.get(raw, "items")),
    ...(cursor === undefined ? {} : { cursor }),
  };
};

/** No result keeps the items that were sorted. */
const asSortResult = (raw: unknown): SortResult => {
  if (typeof raw !== "object" || raw === null) return undefined;
  return { items: asArray(Reflect.get(raw, "items")) };
};

/** The `value` a row is addressed by: a non-empty string `value` field,
 * else the row's index. */
const textField = (item: unknown, field: string): string | undefined => {
  if (typeof item !== "object" || item === null) return undefined;
  const raw: unknown = Reflect.get(item, field);
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
};

const toRow = (item: unknown, index: number): AsyncListRow => {
  const value = textField(item, "value") ?? String(index);
  const label = textField(item, "label") ?? value;
  return { value, label, index };
};

type Ctx = AsyncListContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

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
    filterText: event.type === "FILTER" ? (event["filterText"] as string) : context.filterText,
    cursor: loadMore ? context.cursor : null,
    sortDescriptor: event.type === "SORT"
      ? (event["sortDescriptor"] as SortDescriptor)
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
      ? (event["sortDescriptor"] as SortDescriptor)
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
  seed: (props) => {
    if (!isLoadFn(props["load"])) {
      throw new Error(
        "[async-list] load is required: pass a function resolving { items, cursor }",
      );
    }
    return {
      items: asArray(props["initialItems"]),
      cursor: null,
      filterText: typeof props["initialFilterText"] === "string" ? props["initialFilterText"] : "",
      sortDescriptor: isSortDescriptor(props["initialSortDescriptor"]) ? props["initialSortDescriptor"] : null,
      error: undefined,
      hasSortFn: isSortFn(props["sortFn"]),
    };
  },
  // An autoReload mount loads once; the reconcile watcher answers every
  // dependency change after it.
  establish: (props) =>
    (props["autoReload"] as boolean) === true ? [{ type: "RELOAD" }] : [],
  // The reflex table runs after every transmit: which event needs which
  // piece of async work, with the state the send landed in.
  settled: ({ event, before, after, props, root, send }) => {
    const view = viewOf(root());
    const load = props["load"];
    if (!isLoadFn(load)) return;
    const beforeState = (before as unknown as { state: string }).state;
    const afterCtx = (after as unknown as { context: Ctx }).context;
    const afterState = (after as unknown as { state: string }).state;
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
  channels: {
    initialItems: { parse: asArray },
    initialFilterText: { parse: (raw) => (typeof raw === "string" ? raw : "") },
    initialSortDescriptor: {
      parse: (raw) => (isSortDescriptor(raw) ? raw : null),
    },
    autoReload: { parse: (raw) => raw === true },
    dependencies: { parse: asArray },
    load: { parse: (raw) => (isLoadFn(raw) ? raw : undefined) },
    sortFn: { parse: (raw) => (isSortFn(raw) ? raw : undefined) },
  },
  scalars: ["hasSortFn"],
  scalarsOf: (parsed) => ({
    hasSortFn: isSortFn(parsed["sortFn"]),
  }),
  reconcile: ({ context, parsed, send }) => {
    // The dependencies watcher: the mount hash is captured, never
    // dispatched — the watcher fires on a change only, and the mount load
    // is autoReload's job.
    const dependencies = (parsed["dependencies"] as readonly unknown[])
      .filter((dependency) => Boolean(dependency))
      .join(",");
    const known = (context as unknown as { dependencies?: string }).dependencies;
    if (known === undefined) {
      (context as unknown as { dependencies?: string }).dependencies = dependencies;
      return false;
    }
    if (dependencies !== known) {
      (context as unknown as { dependencies?: string }).dependencies = dependencies;
      send({ type: "RELOAD" });
      return true;
    }
    return false;
  },
  parts: {
    root: {
      sig: (scope) => `${scope.state}`,
      attrs: (scope) => ({
        id: scope.id("root"),
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
        const items = asCtx(scope.context).items;
        return `${scope.state} ${items.length}`;
      },
      attrs: (scope) => {
        const count = asCtx(scope.context).items.length;
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
      sig: (scope) => `${asCtx(scope.context).items.length}`,
      attrs: (scope) => {
        const count = asCtx(scope.context).items.length;
        return {
          id: scope.id("empty"),
          "data-empty": dataAttr(count === 0),
        };
      },
    },
    error: {
      sig: (scope) => `${asCtx(scope.context).error !== undefined}`,
      attrs: (scope) => {
        const failed = asCtx(scope.context).error !== undefined;
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
        const ctx = asCtx(scope.context);
        return `${ctx.filterText} ${scope.state === "loading" || scope.state === "sorting"}`;
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
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
      sig: (scope) => `${asCtx(scope.context).filterText.length === 0}`,
      attrs: (scope) => {
        const empty = asCtx(scope.context).filterText.length === 0;
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
        const ctx = asCtx(scope.context);
        return `${ctx.cursor != null} ${scope.state}`;
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
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
        const ctx = asCtx(scope.context);
        return `${ctx.cursor != null} ${scope.state}`;
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
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
      indexes: (context) => rowsFor(asCtx(context).items),
      sig: (scope) => `${(scope.slot as unknown as AsyncListRow).value}`,
      attrs: (scope) => {
        const row = scope.slot as unknown as AsyncListRow;
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
      sig: (scope) => {
        const trigger = scope.slot as unknown as SortTrigger;
        const ctx = asCtx(scope.context);
        const active = ctx.sortDescriptor?.column === trigger.column &&
          ctx.sortDescriptor?.direction === trigger.direction;
        return `${scope.state} ${active}`;
      },
      attrs: (scope) => {
        const trigger = scope.slot as unknown as SortTrigger;
        const ctx = asCtx(scope.context);
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
    sort: { event: (args) => ({ type: "SORT", sortDescriptor: args[0] as SortDescriptor }) },
    setFilterText: { event: (args) => ({ type: "FILTER", filterText: args[0] as string }) },
    clearFilter: { event: () => ({ type: "FILTER", filterText: "" }) },
  },
  readers: {
    items: { read: (context) => [...asCtx(context).items] },
    loading: {
      read: (_context, state) => state === "loading" || state === "sorting",
    },
    sorting: { read: (_context, state) => state === "sorting" },
    empty: { read: (context) => asCtx(context).items.length === 0 },
    hasMore: { read: (context) => asCtx(context).cursor != null },
    error: { read: (context) => asCtx(context).error },
    filterText: { read: (context) => asCtx(context).filterText },
    cursor: { read: (context) => asCtx(context).cursor ?? undefined },
    sortDescriptor: { read: (context) => asCtx(context).sortDescriptor ?? undefined },
  },
  methods: {
    getRows: {
      call: (context) => {
        // The `for` effect re-runs only on signals its source reads, and
        // the rows live in machine context: the tick is the subscription
        // that re-reads them after a load.
        machineTick();
        return rowsFor(asCtx(context).items);
      },
    },
  },
  events: {
    "load-success": {
      prop: "onSuccess",
      watch: () => [],
      detail: (watched) => ({ items: watched as readonly unknown[] }),
      select: (event) =>
        event.type === "SUCCESS"
          ? { items: [...(event["items"] as readonly unknown[])] }
          : null,
    },
    "load-error": {
      prop: "onError",
      watch: () => [],
      detail: (watched) => ({ error: (watched as unknown[])[0] }),
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
