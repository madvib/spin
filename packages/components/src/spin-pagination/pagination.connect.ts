/**
 * Pagination connect: the DOM contract and the page list the view iterates.
 *
 * The machine owns two scalars; everything else here is derivation and
 * wiring: the total pages and the range they imply, the ellipsis positions,
 * the part ids (Zag's scheme verbatim), and the handlers that turn a click
 * into an event.
 *
 * The view iterates `api.pages` — one entry per slot, page or ellipsis, in
 * reading order — because the slots' ORDER is the component. The entries are
 * discriminated so the markup asks for the right bag for each kind with one
 * expression, and both kinds render as a button so the loop needs no
 * conditional of its own: an ellipsis's bag makes it inert.
 */

import { getRange, type PaginationContext } from "./pagination.machine.ts";

/** A page-number slot: the active part of the control. */
export interface PaginationPageEntry {
  readonly type: "page";
  readonly value: number;
}

/** A gap in the sequence: position-valued, never clickable. */
export interface PaginationEllipsisEntry {
  readonly type: "ellipsis";
  /** The slot's position in the list, which Zag keys the ellipsis id on. */
  readonly index: number;
}

export type PaginationEntry = PaginationPageEntry | PaginationEllipsisEntry;

/** Zag's `PageRange`: the item indices the current page covers. */
export interface PaginationPageRange {
  readonly start: number;
  readonly end: number;
}

/** Zag's `IntlTranslations`. Every member is optional in the host's object. */
export interface PaginationTranslations {
  readonly rootLabel: string;
  readonly firstTriggerLabel: string;
  readonly prevTriggerLabel: string;
  readonly nextTriggerLabel: string;
  readonly lastTriggerLabel: string;
  readonly itemLabel: (details: { page: number; totalPages: number }) => string;
}

export interface PaginationFsmConnectProps {
  readonly count: number;
  readonly siblingCount: number;
  readonly boundaryCount: number;
  readonly dir: string;
  /** The host's localized strings, merged over the English defaults. */
  readonly translations: PaginationTranslations;
}

/** The element's imperative surface — Zag's api methods. Each one is a send:
 * the machine holds the state, and the view decides nothing more. */
export interface PaginationCommands {
  setPage(page: number): void;
  setPageSize(size: number): void;
  goToNextPage(): void;
  goToPrevPage(): void;
  goToFirstPage(): void;
  goToLastPage(): void;
}

export interface PaginationFsmApi extends PaginationCommands {
  readonly count: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly pages: readonly PaginationEntry[];
  readonly previousPage: number | null;
  readonly nextPage: number | null;
  readonly pageRange: PaginationPageRange;
  getRootProps(): Record<string, unknown>;
  getItemProps(entry: PaginationPageEntry): Record<string, unknown>;
  getEllipsisProps(entry: PaginationEllipsisEntry): Record<string, unknown>;
  getPrevTriggerProps(): Record<string, unknown>;
  getFirstTriggerProps(): Record<string, unknown>;
  getNextTriggerProps(): Record<string, unknown>;
  getLastTriggerProps(): Record<string, unknown>;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

const NAMESPACE = "pagination";

export interface PaginationService {
  readonly context: PaginationContext;
  send(event: { type: string } & Record<string, unknown>): void;
}

export type ReadPaginationProps = () => PaginationFsmConnectProps;

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

/** A `for` loop whose rows are rebuilt per read would replace every node on
 * every move: the entries are cached against the fields the range reads, so
 * a move that leaves the slot list alone leaves the nodes alone too. */
function memoized<T>(): (sig: string, make: () => readonly T[]) => readonly T[] {
  let sig = "";
  let rows: readonly T[] | undefined;
  return (next: string, make: () => readonly T[]): readonly T[] => {
    if (rows !== undefined && sig === next) return rows;
    sig = next;
    rows = make();
    return rows;
  };
}

/** Zag's `dataAttr`: the attribute is present when the condition holds. */
function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

export function connectRobotPagination(
  service: PaginationService,
  readProps: ReadPaginationProps,
  id: string,
): PaginationFsmApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const firstId = `${ownerId}:first`;
  const prevId = `${ownerId}:prev`;
  const nextId = `${ownerId}:next`;
  const lastId = `${ownerId}:last`;

  const ctx = (): PaginationContext => service.context;

  const send: Send = (event): void => {
    service.send(event);
  };

  const pagesOf = memoized<PaginationEntry>();
  const pages = (): readonly PaginationEntry[] => {
    const props = readProps();
    const page = ctx().page;
    const pageSize = ctx().pageSize;
    const range = getRange({
      page,
      totalPages: Math.ceil(props.count / pageSize),
      siblingCount: props.siblingCount,
      boundaryCount: props.boundaryCount,
    });
    return pagesOf(
      `${page}\u0000${pageSize}\u0000${props.count}\u0000${props.siblingCount}\u0000${props.boundaryCount}`,
      () =>
        range.map((value, index) =>
          value === "ellipsis"
            ? { type: "ellipsis" as const, index }
            : { type: "page" as const, value },
        ),
    );
  };

  const rootMemo = cached();
  const itemMemo = cached();
  const ellipsisMemo = cached();
  const triggerMemo = cached();

  return {
    get count(): number {
      return readProps().count;
    },
    get page(): number {
      return ctx().page;
    },
    get pageSize(): number {
      return ctx().pageSize;
    },
    get totalPages(): number {
      return Math.ceil(readProps().count / ctx().pageSize);
    },
    get pages(): readonly PaginationEntry[] {
      return pages();
    },
    get previousPage(): number | null {
      return ctx().page === 1 ? null : ctx().page - 1;
    },
    get nextPage(): number | null {
      const total = Math.ceil(readProps().count / ctx().pageSize);
      return ctx().page === total ? null : ctx().page + 1;
    },
    get pageRange(): PaginationPageRange {
      const pageSize = ctx().pageSize;
      const start = (ctx().page - 1) * pageSize;
      return { start, end: Math.min(start + pageSize, readProps().count) };
    },
    setPage: (page: number): void => send({ type: "SET_PAGE", page }),
    setPageSize: (size: number): void => send({ type: "SET_PAGE_SIZE", size }),
    goToNextPage: (): void => send({ type: "NEXT_PAGE" }),
    goToPrevPage: (): void => send({ type: "PREVIOUS_PAGE" }),
    goToFirstPage: (): void => send({ type: "FIRST_PAGE" }),
    goToLastPage: (): void => send({ type: "LAST_PAGE" }),
    getRootProps: () => {
      const props = readProps();
      return rootMemo(`${props.dir}\u0000${props.count}`, () => ({
        id: ownerId,
        "aria-label": props.translations.rootLabel,
        dir: props.dir.length > 0 ? props.dir : undefined,
        "data-empty": dataAttr(props.count === 0),
      }));
    },
    getItemProps: (entry: PaginationPageEntry) => {
      const props = readProps();
      const value = entry.value;
      const total = Math.ceil(props.count / ctx().pageSize);
      const current = value === ctx().page;
      const label = props.translations.itemLabel({ page: value, totalPages: total });
      return itemMemo(`${value}\u0000${current}\u0000${label}`, () => ({
        id: `${ownerId}:item:${value}`,
        "data-index": value,
        "data-selected": dataAttr(current),
        "aria-current": current ? "page" : undefined,
        "aria-label": label,
        type: "button",
        onClick: () => send({ type: "SET_PAGE", page: value }),
      }));
    },
    getEllipsisProps: (entry: PaginationEllipsisEntry) => {
      const props = readProps();
      return ellipsisMemo(`${entry.index}\u0000${props.dir}`, () => ({
        id: `${ownerId}:ellipsis:${entry.index}`,
        // A gap is not a control: the button that renders it carries no
        // activation, no tab stop and no announcement.
        type: "button",
        disabled: true,
        "aria-hidden": true,
        tabindex: -1,
      }));
    },
    getPrevTriggerProps: () => {
      const props = readProps();
      const atFirst = ctx().page === 1;
      return triggerMemo(`prev\u0000${atFirst}\u0000${props.translations.prevTriggerLabel}`, () => ({
        id: prevId,
        "aria-label": props.translations.prevTriggerLabel,
        "data-disabled": dataAttr(atFirst),
        disabled: atFirst,
        type: "button",
        onClick: () => send({ type: "PREVIOUS_PAGE" }),
      }));
    },
    getFirstTriggerProps: () => {
      const props = readProps();
      const atFirst = ctx().page === 1;
      return triggerMemo(`first\u0000${atFirst}\u0000${props.translations.firstTriggerLabel}`, () => ({
        id: firstId,
        "aria-label": props.translations.firstTriggerLabel,
        "data-disabled": dataAttr(atFirst),
        disabled: atFirst,
        type: "button",
        onClick: () => send({ type: "FIRST_PAGE" }),
      }));
    },
    getNextTriggerProps: () => {
      const props = readProps();
      const total = Math.ceil(props.count / ctx().pageSize);
      const atLast = ctx().page >= total;
      return triggerMemo(`next\u0000${atLast}\u0000${props.translations.nextTriggerLabel}`, () => ({
        id: nextId,
        "aria-label": props.translations.nextTriggerLabel,
        "data-disabled": dataAttr(atLast),
        disabled: atLast,
        type: "button",
        onClick: () => send({ type: "NEXT_PAGE" }),
      }));
    },
    getLastTriggerProps: () => {
      const props = readProps();
      const total = Math.ceil(props.count / ctx().pageSize);
      const atLast = ctx().page >= total;
      return triggerMemo(`last\u0000${atLast}\u0000${props.translations.lastTriggerLabel}`, () => ({
        id: lastId,
        "aria-label": props.translations.lastTriggerLabel,
        "data-disabled": dataAttr(atLast),
        disabled: atLast,
        type: "button",
        onClick: () => send({ type: "LAST_PAGE" }),
      }));
    },
  };
}
