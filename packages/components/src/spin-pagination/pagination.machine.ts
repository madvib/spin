/**
 * Pagination machine: the page, the page size, and the total pages they
 * imply.
 *
 * Zag ships one state (`idle`) with all six events on it, and the fork's
 * root tier is exactly that — "this event works everywhere" — so the config
 * is a root `on` plus an `idle` state that declares nothing. What survives
 * the port is the page arithmetic: `SET_PAGE` is guarded and clamped,
 * `FIRST`/`LAST` jump, `PREVIOUS`/`NEXT` are guarded, and a page-size change
 * repairs a page the new size pushed out of range.
 *
 * No DOM access and no timers: the whole machine is bookkeeping over two
 * scalars, which is why the fork's flat config is a lossless shape for it.
 */

export interface PaginationContext {
  /** The active page, 1-based. */
  page: number;
  pageSize: number;
  /** Total items — synced from scope. Every clamp reads it. */
  count: number;
}

export type PaginationEvent =
  | { type: "SET_PAGE"; page: number }
  | { type: "SET_PAGE_SIZE"; size: number }
  | { type: "FIRST_PAGE" }
  | { type: "LAST_PAGE" }
  | { type: "PREVIOUS_PAGE" }
  | { type: "NEXT_PAGE" };

/** Zag's `computed.totalPages`: a size of zero or less pages nothing. */
export const totalPages = (count: number, pageSize: number): number =>
  Math.ceil(count / pageSize);

/** Zag's `clampPage`. */
export const clampPage = (page: number, total: number): number =>
  Math.min(Math.max(page, 1), total);

export const config = {
  id: "pagination",
  initial: "idle",
  context: {
    page: 1,
    pageSize: 10,
    count: 1,
  },
  // The root tier: every event is valid everywhere, which is Zag's whole
  // chart — the machine has exactly one state.
  on: {
    SET_PAGE: { cond: "isValidPage", actions: [{ assign: "setPage" }] },
    SET_PAGE_SIZE: { actions: [{ assign: "setPageSize" }] },
    FIRST_PAGE: { actions: [{ assign: "goToFirstPage" }] },
    LAST_PAGE: { actions: [{ assign: "goToLastPage" }] },
    PREVIOUS_PAGE: { cond: "canGoToPrevPage", actions: [{ assign: "goToPrevPage" }] },
    NEXT_PAGE: { cond: "canGoToNextPage", actions: [{ assign: "goToNextPage" }] },
  },
  states: {
    idle: {},
  },
};

/** Zag's `setPageIfNeeded` guard. */
const pageStillValid = (page: number, count: number, pageSize: number): number =>
  page >= 1 && page <= totalPages(count, pageSize) ? page : 1;

export const implementations = {
  conds: {
    isValidPage: (ctx: PaginationContext, e: PaginationEvent): boolean =>
      e.type === "SET_PAGE" && e.page >= 1 && e.page <= totalPages(ctx.count, ctx.pageSize),
    canGoToPrevPage: (ctx: PaginationContext): boolean => ctx.page > 1,
    canGoToNextPage: (ctx: PaginationContext): boolean =>
      ctx.page < totalPages(ctx.count, ctx.pageSize),
  },
  assigns: {
    setPage: (ctx: PaginationContext, e: PaginationEvent): Partial<PaginationContext> =>
      e.type === "SET_PAGE"
        ? { page: clampPage(e.page, totalPages(ctx.count, ctx.pageSize)) }
        : {},
    /**
     * Zag splits this into the assign plus a `watch` on `pageSize` that runs
     * `setPageIfNeeded`. The fork has no watch, so the repair is folded in:
     * a page the new size pushed out of range resets to 1, which is what the
     * watch's guard decides.
     */
    setPageSize: (ctx: PaginationContext, e: PaginationEvent): Partial<PaginationContext> => {
      if (e.type !== "SET_PAGE_SIZE") return {};
      return { pageSize: e.size, page: pageStillValid(ctx.page, ctx.count, e.size) };
    },
    goToFirstPage: (): Partial<PaginationContext> => ({ page: 1 }),
    goToLastPage: (ctx: PaginationContext): Partial<PaginationContext> => ({
      page: totalPages(ctx.count, ctx.pageSize),
    }),
    goToPrevPage: (ctx: PaginationContext): Partial<PaginationContext> => ({
      page: clampPage(ctx.page - 1, totalPages(ctx.count, ctx.pageSize)),
    }),
    goToNextPage: (ctx: PaginationContext): Partial<PaginationContext> => ({
      page: clampPage(ctx.page + 1, totalPages(ctx.count, ctx.pageSize)),
    }),
  },
};

// ---------------------------------------------------------------------------
// The page range: which page numbers and which ellipses render.
//
// Zag keeps this in `pagination.utils.ts` as a pure function of
// (page, totalPages, siblingCount, boundaryCount) and the connect calls it
// per tick. It lives beside the machine for the same reason the listbox's
// selection arithmetic does: it is pure state math with no side of its own,
// and it is the port's only algorithm of consequence.
// ---------------------------------------------------------------------------

const range = (start: number, end: number): number[] => {
  const length = end - start + 1;
  return Array.from({ length }, (_, index) => index + start);
};

const ELLIPSIS = "ellipsis";

export interface PaginationRangeInput {
  readonly page: number;
  readonly totalPages: number;
  readonly siblingCount: number;
  readonly boundaryCount: number;
}

/** Zag's `getRange`: the page-number list, ellipses still raw. */
export function getRange(ctx: PaginationRangeInput): readonly (number | typeof ELLIPSIS)[] {
  const { page, totalPages: total, siblingCount } = ctx;
  const boundaryCount = ctx.boundaryCount;
  if (total <= 0) return [];
  if (total === 1) return [1];
  const firstPageIndex = 1;
  const lastPageIndex = total;
  const leftSiblingIndex = Math.max(page - siblingCount, firstPageIndex);
  const rightSiblingIndex = Math.min(page + siblingCount, lastPageIndex);
  const totalPageNumbers = Math.min(siblingCount * 2 + 3 + boundaryCount * 2, total);
  if (total <= totalPageNumbers) return range(firstPageIndex, lastPageIndex);

  const itemCount = totalPageNumbers - 1 - boundaryCount;
  const showLeftEllipsis =
    leftSiblingIndex > firstPageIndex + boundaryCount + 1 &&
    Math.abs(leftSiblingIndex - firstPageIndex) > boundaryCount + 1;
  const showRightEllipsis =
    rightSiblingIndex < lastPageIndex - boundaryCount - 1 &&
    Math.abs(lastPageIndex - rightSiblingIndex) > boundaryCount + 1;

  let pages: (number | "ellipsis")[] = [];
  if (!showLeftEllipsis && showRightEllipsis) {
    pages.push(...range(1, itemCount), ELLIPSIS);
    pages.push(...range(lastPageIndex - boundaryCount + 1, lastPageIndex));
  } else if (showLeftEllipsis && !showRightEllipsis) {
    pages.push(...range(firstPageIndex, firstPageIndex + boundaryCount - 1));
    pages.push(ELLIPSIS);
    pages.push(...range(lastPageIndex - itemCount + 1, lastPageIndex));
  } else if (showLeftEllipsis && showRightEllipsis) {
    pages.push(...range(firstPageIndex, firstPageIndex + boundaryCount - 1));
    pages.push(ELLIPSIS);
    pages.push(...range(leftSiblingIndex, rightSiblingIndex));
    pages.push(ELLIPSIS);
    pages.push(...range(lastPageIndex - boundaryCount + 1, lastPageIndex));
  } else {
    pages.push(...range(firstPageIndex, lastPageIndex));
  }

  // A gap of exactly one page is the page itself, not a gap.
  for (let index = 0; index < pages.length; index += 1) {
    if (pages[index] !== ELLIPSIS) continue;
    const before = pages[index - 1];
    const after = pages[index + 1];
    const prevPage = typeof before === "number" ? before : 0;
    const nextPage = typeof after === "number" ? after : total + 1;
    if (nextPage - prevPage === 2) pages[index] = prevPage + 1;
  }
  return pages;
}
