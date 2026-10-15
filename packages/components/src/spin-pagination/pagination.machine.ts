/**
 * Pagination machine: one idle state with guarded transitions, over Zag's
 * single-state machine.
 *
 * The gating is the whole component: SET_PAGE refuses out-of-range pages,
 * PREVIOUS refuses page one, NEXT refuses the last page, and a page-size
 * change that strands the page resets to one. The ellipsis/sibling/
 * boundary window math is Zag's own `pagination.utils`, vendored below
 * because it is pure integer arithmetic. The machine owns no math of its
 * own.
 *
 * Context stays serializable for the scope channel: page, page size, and
 * the scalars the window math reads. There is one state because there is
 * one mode; the events are all legal, always, subject to the guards.
 */

export interface PaginationContext {
  page: number;
  pageSize: number;
  count: number;
  siblingCount: number;
  boundaryCount: number;
}

export type PaginationEvent =
  | { type: "SET_PAGE"; page: number }
  | { type: "SET_PAGE_SIZE"; size: number }
  | { type: "FIRST_PAGE" }
  | { type: "LAST_PAGE" }
  | { type: "PREVIOUS_PAGE" }
  | { type: "NEXT_PAGE" }
  | { type: "SET_COUNT"; count: number };

export type PaginationPageChange = {
  readonly page: number;
  readonly pageSize: number;
};

export type PaginationPageSizeChange = {
  readonly pageSize: number;
};

export type PaginationPageItem = {
  readonly type: "page";
  readonly value: number;
  readonly key: string;
  readonly label: string;
} | {
  readonly type: "ellipsis";
  readonly index: number;
  readonly key: string;
  readonly label: string;
};

export function totalPages(ctx: PaginationContext): number {
  return Math.max(1, Math.ceil(ctx.count / Math.max(1, ctx.pageSize)));
}

export function previousPage(ctx: PaginationContext): number | null {
  return ctx.page <= 1 ? null : ctx.page - 1;
}

export function nextPage(ctx: PaginationContext): number | null {
  return ctx.page >= totalPages(ctx) ? null : ctx.page + 1;
}

export function pageRange(ctx: PaginationContext): { start: number; end: number } {
  const start = (ctx.page - 1) * ctx.pageSize;
  return { start, end: Math.min(start + ctx.pageSize, ctx.count) };
}

/** Zag's pagination.utils range, vendored: inclusive integer span. */
function range(start: number, end: number): number[] {
  const length = end - start + 1;
  return Array.from({ length }, (_, index) => index + start);
}

/** Zag's getRange, vendored: the sibling/boundary/ellipsis window. */
export function pageWindow(ctx: PaginationContext): (number | "ellipsis")[] {
  const total = totalPages(ctx);
  const { siblingCount, boundaryCount } = ctx;
  const page = ctx.page;
  if (total <= 0) return [];
  if (total === 1) return [1];
  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, total);
  const totalNumbers = Math.min(siblingCount * 2 + 3 + boundaryCount * 2, total);
  if (total <= totalNumbers) return range(1, total);
  const slots = totalNumbers - 1 - boundaryCount;
  const showLeft = leftSibling > 1 + boundaryCount + 1 && Math.abs(leftSibling - 1) > boundaryCount + 1;
  const showRight = rightSibling < total - boundaryCount - 1 &&
    Math.abs(total - rightSibling) > boundaryCount + 1;
  let pages: (number | "ellipsis")[] = [];
  if (!showLeft && showRight) {
    pages.push(...range(1, slots), "ellipsis");
    pages.push(...range(total - boundaryCount + 1, total));
  } else if (showLeft && !showRight) {
    pages.push(...range(1, boundaryCount));
    pages.push("ellipsis");
    pages.push(...range(total - slots + 1, total));
  } else if (showLeft && showRight) {
    pages.push(...range(1, boundaryCount));
    pages.push("ellipsis");
    pages.push(...range(leftSibling, rightSibling));
    pages.push("ellipsis");
    pages.push(...range(total - boundaryCount + 1, total));
  } else {
    pages.push(...range(1, total));
  }
  // An ellipsis hiding a single page becomes the page.
  for (let index = 0; index < pages.length; index += 1) {
    if (pages[index] === "ellipsis") {
      const prev = typeof pages[index - 1] === "number" ? (pages[index - 1] as number) : 0;
      const next = typeof pages[index + 1] === "number" ? (pages[index + 1] as number) : total + 1;
      if (next - prev === 2) pages[index] = prev + 1;
    }
  }
  return pages;
}

/** Zag's transform: numbers become page items, gaps become ellipses. */
export function pageItems(ctx: PaginationContext): PaginationPageItem[] {
  let ellipsis = 0;
  return pageWindow(ctx).map((value) => {
    if (typeof value === "number") {
      return { type: "page" as const, value, key: `page:${value}`, label: String(value) };
    }
    ellipsis += 1;
    return { type: "ellipsis" as const, index: ellipsis, key: `ellipsis:${ellipsis}`, label: "\u2026" };
  });
}

const clampPage = (page: number, total: number): number => Math.min(Math.max(page, 1), total);

export const config = {
  id: "pagination",
  initial: "idle",
  context: {
    page: 1,
    pageSize: 10,
    count: 1,
    siblingCount: 1,
    boundaryCount: 1,
  },
  on: {
    SET_COUNT: { actions: [{ assign: "setCount" }] },
  },
  states: {
    idle: {
      on: {
        SET_PAGE: [{ cond: "isValidPage", actions: [{ assign: "setPage" }] }],
        SET_PAGE_SIZE: { actions: [{ assign: "setPageSize" }, { assign: "resetPageIfNeeded" }] },
        FIRST_PAGE: { actions: [{ assign: "goToFirst" }] },
        LAST_PAGE: { actions: [{ assign: "goToLast" }] },
        PREVIOUS_PAGE: [{ cond: "canGoPrev", actions: [{ assign: "goToPrev" }] }],
        NEXT_PAGE: [{ cond: "canGoNext", actions: [{ assign: "goToNext" }] }],
      },
    },
  },
};

export const implementations = {
  conds: {
    isValidPage: (ctx: PaginationContext, event: PaginationEvent): boolean => {
      if (event.type !== "SET_PAGE") return false;
      return event.page >= 1 && event.page <= totalPages(ctx);
    },
    canGoPrev: (ctx: PaginationContext): boolean => ctx.page > 1,
    canGoNext: (ctx: PaginationContext): boolean => ctx.page < totalPages(ctx),
  },
  assigns: {
    setPage: (ctx: PaginationContext, event: PaginationEvent): Partial<PaginationContext> => {
      if (event.type !== "SET_PAGE") return {};
      const page = clampPage(event.page, totalPages(ctx));
      return page === ctx.page ? {} : { page };
    },
    setPageSize: (ctx: PaginationContext, event: PaginationEvent): Partial<PaginationContext> => {
      if (event.type !== "SET_PAGE_SIZE") return {};
      void ctx;
      return { pageSize: Math.max(1, Math.floor(event.size)) };
    },
    resetPageIfNeeded: (ctx: PaginationContext): Partial<PaginationContext> =>
      ctx.page > totalPages(ctx) ? { page: 1 } : {},
    goToFirst: (ctx: PaginationContext): Partial<PaginationContext> =>
      ctx.page === 1 ? {} : { page: 1 },
    goToLast: (ctx: PaginationContext): Partial<PaginationContext> => {
      const last = totalPages(ctx);
      return ctx.page === last ? {} : { page: last };
    },
    goToPrev: (ctx: PaginationContext): Partial<PaginationContext> => ({
      page: clampPage(ctx.page - 1, totalPages(ctx)),
    }),
    goToNext: (ctx: PaginationContext): Partial<PaginationContext> => ({
      page: clampPage(ctx.page + 1, totalPages(ctx)),
    }),
    setCount: (ctx: PaginationContext, event: PaginationEvent): Partial<PaginationContext> => {
      if (event.type !== "SET_COUNT") return {};
      void ctx;
      return { count: Math.max(0, Math.floor(event.count)) };
    },
  },
};
