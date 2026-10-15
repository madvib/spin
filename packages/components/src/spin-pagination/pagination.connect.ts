import { dataAttr } from "../spin-select/select.shared.ts";
import {
  nextPage,
  pageItems,
  previousPage,
  totalPages,
  type PaginationContext,
  type PaginationPageItem,
} from "./pagination.machine.ts";

/**
 * Pagination connect: the DOM contract and the reflexes the parts carry.
 *
 * What the machine owns stays there: the page, the page size, the count,
 * the window math, the guards. Everything else here is bags: the nav
 * semantics, the current-page mark, the ellipsis placeholders.
 */

export interface PaginationConnectProps {
  readonly dir: "ltr" | "rtl";
  readonly label: string;
  readonly firstLabel: string;
  readonly prevLabel: string;
  readonly nextLabel: string;
  readonly lastLabel: string;
}

export interface PaginationItemSlotProps {
  readonly value: number;
}

export interface PaginationEllipsisSlotProps {
  readonly index: number;
}

/** Zag's api methods, narrowed to the command surface the element exposes. */
export interface PaginationCommands {
  setPage(page: number): void;
  setPageSize(size: number): void;
  goToFirstPage(): void;
  goToLastPage(): void;
  goToNextPage(): void;
  goToPrevPage(): void;
}

export interface PaginationApi extends PaginationCommands {
  readonly page: number;
  readonly pageSize: number;
  readonly count: number;
  readonly totalPages: number;
  readonly previousPage: number | null;
  readonly nextPage: number | null;
  readonly firstPage: boolean;
  readonly lastPage: boolean;
  /** The window items (pages + ellipses), for the recipe's iteration. */
  getItems(): readonly PaginationPageItem[];
  /** The button props for a page item, or a hiding bag for an ellipsis:
   * templates have no conditional, so the recipe renders button + span
   * twins and the wrong kind hides itself on data-hidden. */
  getPageButtonProps(item: PaginationPageItem): Record<string, unknown>;
  /** The span props for an ellipsis item, or a hiding bag for a page. */
  getEllipsisSpanProps(item: PaginationPageItem): Record<string, unknown>;
  getItemLabel(value: number): string;
  getRootProps(): Record<string, unknown>;
  getItemProps(slot: PaginationItemSlotProps): Record<string, unknown>;
  getEllipsisProps(slot: PaginationEllipsisSlotProps): Record<string, unknown>;
  getFirstTriggerProps(): Record<string, unknown>;
  getPrevTriggerProps(): Record<string, unknown>;
  getNextTriggerProps(): Record<string, unknown>;
  getLastTriggerProps(): Record<string, unknown>;
}

/** The service the connect reads: the fork's, narrowed to what it needs. */
export interface PaginationService {
  readonly context: PaginationContext;
  /** The machine's state: always idle. */
  readonly state: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

export interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A bag cached until the signature of the fields it reads moves. One memo
 * holds the single bag of one part (there is one root, one prev trigger
 * per element), so a single slot is the whole cache. */
function memo(): (
  sig: string,
  build: () => Record<string, unknown>,
) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next, build) => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** Items and ellipses are stable slots, so the memo dies with the slot it
 * came from. */
function keyed<K extends object>(
  store: WeakMap<K, BagMemo>,
  owner: K,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> {
  const hit = store.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(owner, { sig, bag });
  return bag;
}

export function connectPagination(
  service: PaginationService,
  readProps: () => PaginationConnectProps,
  id: string,
): PaginationApi {
  // Live accessor, never a snapshot: the fork replaces the context object
  // on every assign, so a destructured copy would freeze the first read.
  const ctx = (): PaginationContext => service.context;
  const send = service.send;
  const rootId = `pagination:${id}`;
  const itemId = (value: number): string => `pagination:${id}:item:${value}`;
  const ellipsisId = (index: number): string => `pagination:${id}:ellipsis:${index}`;
  const firstTriggerId = `pagination:${id}:first`;
  const prevTriggerId = `pagination:${id}:prev`;
  const nextTriggerId = `pagination:${id}:next`;
  const lastTriggerId = `pagination:${id}:last`;

  const rootBag = memo();
  const itemBags = new WeakMap<{ value: number }, BagMemo>();
  const ellipsisBags = new WeakMap<{ index: number }, BagMemo>();
  const firstTriggerBag = memo();
  const prevTriggerBag = memo();
  const nextTriggerBag = memo();
  const lastTriggerBag = memo();

  /** Stable item-array identity: the recipe's `for` re-stamps rows when
   * the source identity moves (the slider's focus-loss lesson). The
   * window only changes when its inputs do. */
  const items = (() => {
    let sig = "";
    let cached: readonly PaginationPageItem[] = [];
    return () => {
      const context = ctx();
      const next = [context.page, context.pageSize, context.count, context.siblingCount, context.boundaryCount]
        .join("|");
      if (next !== sig) {
        sig = next;
        cached = pageItems(context);
      }
      return cached;
    };
  })();

  const triggerBag = (
    bag: (sig: string, build: () => Record<string, unknown>) => Record<string, unknown>,
    partId: string,
    part: string,
    label: string,
    enabled: boolean,
    event: { type: string },
  ): Record<string, unknown> =>
    bag([label, enabled].join("|"), () => ({
      id: partId,
      type: "button",
      dir: readProps().dir,
      "aria-label": label,
      "data-scope": "pagination",
      "data-part": part,
      "data-disabled": dataAttr(!enabled),
      disabled: enabled ? undefined : true,
      onClick: (e: MouseEvent) => {
        if (e.defaultPrevented) return;
        send(event);
      },
    }));

  const api: PaginationApi = {
    get page() {
      return ctx().page;
    },
    get pageSize() {
      return ctx().pageSize;
    },
    get count() {
      return ctx().count;
    },
    get totalPages() {
      return totalPages(ctx());
    },
    get previousPage() {
      return previousPage(ctx());
    },
    get nextPage() {
      return nextPage(ctx());
    },
    get firstPage() {
      return ctx().page === 1;
    },
    get lastPage() {
      return ctx().page >= totalPages(ctx());
    },
    setPage: (page: number) => {
      send({ type: "SET_PAGE", page });
    },
    setPageSize: (size: number) => {
      send({ type: "SET_PAGE_SIZE", size });
    },
    goToFirstPage: () => {
      send({ type: "FIRST_PAGE" });
    },
    goToLastPage: () => {
      send({ type: "LAST_PAGE" });
    },
    goToNextPage: () => {
      send({ type: "NEXT_PAGE" });
    },
    goToPrevPage: () => {
      send({ type: "PREVIOUS_PAGE" });
    },
    getItems: () => items(),
    getPageButtonProps: (item: PaginationPageItem) =>
      item.type === "page"
        ? api.getItemProps({ value: item.value })
        : { "data-hidden": "", "aria-hidden": "true", tabindex: "-1" },
    getEllipsisSpanProps: (item: PaginationPageItem) =>
      item.type === "ellipsis"
        ? api.getEllipsisProps({ index: item.index })
        : { "data-hidden": "", "aria-hidden": "true" },
    getItemLabel: (value: number) => {
      const total = totalPages(ctx());
      const last = total > 1 && value === total ? "last page, " : "";
      return `${last}page ${value}`;
    },
    getRootProps: () => {
      const props = readProps();
      return rootBag([props.label, props.dir, ctx().page].join("|"), () => ({
        id: rootId,
        dir: props.dir,
        role: "navigation",
        "aria-label": props.label,
        "data-scope": "pagination",
        "data-part": "root",
      }));
    },
    getItemProps: (slot: PaginationItemSlotProps) => {
      const props = readProps();
      const current = slot.value === ctx().page;
      return keyed(itemBags, slot, [current, slot.value].join("|"), () => ({
        id: itemId(slot.value),
        type: "button",
        dir: props.dir,
        "data-scope": "pagination",
        "data-part": "item",
        "data-index": String(slot.value),
        "data-selected": dataAttr(current),
        "aria-current": current ? "page" : undefined,
        "aria-label": `page ${slot.value}`,
        onClick: (e: MouseEvent) => {
          if (e.defaultPrevented) return;
          send({ type: "SET_PAGE", page: slot.value });
        },
      }));
    },
    getEllipsisProps: (slot: PaginationEllipsisSlotProps) =>
      keyed(ellipsisBags, slot, String(slot.index), () => ({
        id: ellipsisId(slot.index),
        dir: readProps().dir,
        "data-scope": "pagination",
        "data-part": "ellipsis",
        "aria-hidden": "true",
      })),
    getFirstTriggerProps: () =>
      triggerBag(firstTriggerBag, firstTriggerId, "first-trigger", readProps().firstLabel, ctx().page !== 1, {
        type: "FIRST_PAGE",
      }),
    getPrevTriggerProps: () =>
      triggerBag(prevTriggerBag, prevTriggerId, "prev-trigger", readProps().prevLabel, previousPage(ctx()) !== null, {
        type: "PREVIOUS_PAGE",
      }),
    getNextTriggerProps: () =>
      triggerBag(nextTriggerBag, nextTriggerId, "next-trigger", readProps().nextLabel, nextPage(ctx()) !== null, {
        type: "NEXT_PAGE",
      }),
    getLastTriggerProps: () =>
      triggerBag(lastTriggerBag, lastTriggerId, "last-trigger", readProps().lastLabel, ctx().page < totalPages(ctx()), {
        type: "LAST_PAGE",
      }),
  };

  return api;
}