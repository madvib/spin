/**
 * Async-list connect: the DOM contract, and the rows the recipe iterates.
 *
 * Zag's connect returns no DOM props at all — this machine has no parts.
 * The parts here are the recipe's: a root that states the lifecycle, a
 * progress bar, the item list, the empty and error regions, the filter
 * field, the reload / load-more / sort triggers, and the sentinel that
 * drives the infinite scroll. Each is addressed by the machine's id scheme
 * (`async-list:<id>:<part>`) and carries its state as `data-state`, because
 * the utility engine paints from attributes and `group-data-` selectors are
 * banned in markup.
 *
 * The rows are the one presentational normalization the recipe makes: a
 * host's items are its own data, so a row is the `value` the recipe can
 * address and the `label` it can show. An item with neither keeps its index
 * as its identity — the same normalization the listbox applies to its
 * collection, and for the same reason.
 *
 * The sentinel is where the reflex lives: `use:infinite-scroll` reports when
 * the bottom of the list scrolls into view, which is the one thing the
 * machine must not know about. The action is a stdlib entry the bridge
 * reports load-more through.
 */

import type { AsyncListContext, SortDescriptor } from "./async-list.machine.ts";
import { machineTick } from "@spin/runtime";

/** One presentation row per loaded item. */
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

/** The element's imperative surface — Zag's api methods, verbatim. Every one
 * is a send: the machine holds the lifecycle, the bridge owns the fetch, and
 * the view only decides what the host's words mean. */
export interface AsyncListCommands {
  abort(): void;
  reload(): void;
  loadMore(): void;
  sort(sortDescriptor: SortDescriptor): void;
  setFilterText(filterText: string): void;
  clearFilter(): void;
}

export interface AsyncListFsmApi extends AsyncListCommands {
  readonly items: readonly unknown[];
  readonly loading: boolean;
  readonly sorting: boolean;
  readonly empty: boolean;
  readonly hasMore: boolean;
  readonly error: unknown;
  readonly filterText: string;
  readonly cursor: unknown;
  readonly sortDescriptor: SortDescriptor | undefined;
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

type Send = (event: AsyncListEvent) => void;

/** The part-id namespace. */
const NAMESPACE = "async-list";

/** The events the view sends. The connect never walks the machine: it sends
 * what the host asked for and the bridge reports the outcome back. */
type AsyncListEvent =
  | { type: "RELOAD" }
  | { type: "LOAD_MORE" }
  | { type: "ABORT" }
  | { type: "SORT"; sortDescriptor: SortDescriptor }
  | { type: "FILTER"; filterText: string };

export interface AsyncListService {
  readonly context: AsyncListContext;
  readonly state: { readonly value: string };
  send(event: AsyncListEvent): void;
}

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A binding re-reads the bag on every machine move, so a fresh bag per read
 * would detach and re-attach every listener each move. Only one of the
 * fields the signature enumerates moving rebuilds it. */
function cached(): (sig: string, build: () => Record<string, unknown>) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** `cached` per owner: the rows are stable objects, so the memo dies with the
 * item tree they came from. */
function keyed(
  store: WeakMap<object, BagMemo>,
  owner: object,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> {
  const hit = store.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(owner, { sig, bag });
  return bag;
}

/** Zag's `dataAttr`: the attribute is present when the condition holds and
 * absent otherwise, which is what `hidden`-style utilities key on. */
function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

/** The `value` a row is addressed by: a non-empty string `value` field, else
 * the row's index. */
function textField(item: unknown, field: string): string | undefined {
  if (typeof item !== "object" || item === null) return undefined;
  const raw: unknown = Reflect.get(item, field);
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

const toRow = (item: unknown, index: number): AsyncListRow => {
  const value = textField(item, "value") ?? String(index);
  const label = textField(item, "label") ?? value;
  return { value, label, index };
};

export function connectRobotAsyncList(
  service: AsyncListService,
  id: string,
): AsyncListFsmApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const partId = (part: string): string => `${ownerId}:${part}`;
  const ctx = (): AsyncListContext => service.context;
  const phase = (): string => service.state.value;
  const loading = (): boolean => phase() === "loading" || phase() === "sorting";
  const hasMore = (): boolean => ctx().cursor != null;
  /** Every event the view sends, funnelled through the service the bridge
   * hands it — the bridge's wrapper is what starts the fetch. */
  const send: Send = (event): void => {
    service.send(event);
  };

  // ---- the rows -----------------------------------------------------------

  /** Memoized on the items array's identity: the `for` directive iterates
   * this array, and a fresh row object per read would replace the nodes,
   * detach every gesture in flight. A load produces a new array, so the
   * rows rebuild exactly when the data does. */
  let rowsSource: readonly unknown[] | undefined;
  let rowsCache: readonly AsyncListRow[] | undefined;
  const rows = (): readonly AsyncListRow[] => {
    // The `for` effect re-runs only on signals its source reads, and the
    // rows live in machine context: the tick is the subscription that
    // re-reads them after a load. The memo below keeps the identity stable
    // when nothing moved, so the re-read syncs nothing.
    machineTick();
    const source = ctx().items;
    if (rowsCache !== undefined && source === rowsSource) return rowsCache;
    rowsSource = source;
    rowsCache = source.map(toRow);
    return rowsCache;
  };

  const onFilterInput = (event: InputEvent): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    send({ type: "FILTER", filterText: target.value });
  };

  // ---- cached bags --------------------------------------------------------

  const rootBag = cached();
  const progressBag = cached();
  const listBag = cached();
  const emptyBag = cached();
  const errorBag = cached();
  const filterBag = cached();
  const clearFilterBag = cached();
  const reloadBag = cached();
  const loadMoreBag = cached();
  const sentinelBag = cached();
  const itemBags = new WeakMap<AsyncListRow, BagMemo>();
  const sortBags = new WeakMap<SortTrigger, BagMemo>();

  return {
    get items(): readonly unknown[] {
      return ctx().items;
    },
    get loading(): boolean {
      return loading();
    },
    get sorting(): boolean {
      return phase() === "sorting";
    },
    get empty(): boolean {
      return ctx().items.length === 0;
    },
    get hasMore(): boolean {
      return hasMore();
    },
    get error(): unknown {
      return ctx().error;
    },
    get filterText(): string {
      return ctx().filterText;
    },
    get cursor(): unknown {
      return ctx().cursor ?? undefined;
    },
    get sortDescriptor(): SortDescriptor | undefined {
      return ctx().sortDescriptor ?? undefined;
    },
    abort: (): void => send({ type: "ABORT" }),
    reload: (): void => send({ type: "RELOAD" }),
    loadMore: (): void => send({ type: "LOAD_MORE" }),
    sort: (sortDescriptor: SortDescriptor): void => send({ type: "SORT", sortDescriptor }),
    setFilterText: (filterText: string): void => send({ type: "FILTER", filterText }),
    clearFilter: (): void => send({ type: "FILTER", filterText: "" }),
    getRows: rows,
    getRootProps: () =>
      rootBag(phase(), () => ({
        id: partId("root"),
        "data-state": phase(),
        "data-loading": dataAttr(loading()),
      })),
    getProgressProps: () =>
      progressBag(phase(), () => ({
        id: partId("progress"),
        role: "progressbar",
        "aria-hidden": true,
        "aria-busy": loading(),
        "data-state": phase(),
      })),
    getListProps: () => {
      const count = ctx().items.length;
      return listBag(`${phase()}\u0000${count}`, () => ({
        id: partId("list"),
        role: "list",
        "aria-busy": loading(),
        "data-state": phase(),
        "data-count": count,
        "data-empty": dataAttr(count === 0),
      }));
    },
    getItemProps: (row: AsyncListRow) =>
      keyed(itemBags, row, row.value, () => ({
        id: partId(`item:${row.value}`),
        role: "listitem",
        "data-value": row.value,
        "data-index": row.index,
      })),
    getEmptyProps: () => {
      const count = ctx().items.length;
      return emptyBag(`${count}`, () => ({
        id: partId("empty"),
        "data-empty": dataAttr(count === 0),
      }));
    },
    getErrorProps: () => {
      const failed = ctx().error !== undefined;
      return errorBag(`${failed}`, () => ({
        id: partId("error"),
        role: "alert",
        "data-state": failed ? "error" : "idle",
      }));
    },
    getFilterInputProps: () => {
      const filterText = ctx().filterText;
      return filterBag(`${filterText}\u0000${loading()}`, () => ({
        id: partId("filter"),
        type: "text",
        value: filterText,
        placeholder: "Filter",
        autoComplete: "off",
        "data-state": phase(),
        onInput: onFilterInput,
      }));
    },
    getClearFilterProps: () => {
      const empty = ctx().filterText.length === 0;
      return clearFilterBag(`${empty}`, () => ({
        id: partId("clear-filter"),
        type: "button",
        "aria-label": "Clear filter",
        "data-filled": dataAttr(!empty),
        hidden: empty,
        onClick: (): void => send({ type: "FILTER", filterText: "" }),
      }));
    },
    getReloadProps: () =>
      reloadBag(phase(), () => ({
        id: partId("reload"),
        type: "button",
        "data-state": phase(),
        onClick: (): void => send({ type: "RELOAD" }),
      })),
    getLoadMoreProps: () => {
      const more = hasMore();
      return loadMoreBag(`${more}\u0000${phase()}`, () => ({
        id: partId("load-more"),
        type: "button",
        "data-state": phase(),
        "data-more": dataAttr(more),
        hidden: !more,
        disabled: loading(),
        onClick: (): void => send({ type: "LOAD_MORE" }),
      }));
    },
    getSortTriggerProps: (trigger: SortTrigger) => {
      const active = ctx().sortDescriptor?.column === trigger.column &&
        ctx().sortDescriptor?.direction === trigger.direction;
      return keyed(
        sortBags,
        trigger,
        `${phase()}\u0000${active}`,
        () => ({
          id: partId(`sort-trigger:${trigger.column}:${trigger.direction}`),
          type: "button",
          "data-column": trigger.column,
          "data-direction": trigger.direction,
          "data-state": phase(),
          "data-active": dataAttr(active),
          "aria-pressed": active,
          onClick: (): void => send({ type: "SORT", sortDescriptor: trigger }),
        }),
      );
    },
    /** The infinite-scroll sentinel: hidden once the cursor runs out, and
     * never visible to anything but the action attached to it. */
    getSentinelProps: () => {
      const more = hasMore();
      return sentinelBag(`${more}\u0000${phase()}`, () => ({
        id: partId("sentinel"),
        "aria-hidden": true,
        "data-state": phase(),
        hidden: !more,
        "data-more": dataAttr(more),
        "use:infinite-scroll": {
          enabled: more,
          onLoadMore: (): void => send({ type: "LOAD_MORE" }),
        },
      }));
    },
  };
}
