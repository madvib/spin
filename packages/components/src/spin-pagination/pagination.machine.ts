/** Pagination machine: one idle state with guarded transitions. */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export interface PaginationContext {
  page: number;
  pageSize: number;
  count: number;
  siblingCount: number;
  boundaryCount: number;
}

export type PaginationEvent =
  | { type: "SET_PAGE"; page: number }
  | { type: "SET_PAGE_SIZE"; pageSize: number }
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

function range(start: number, end: number): number[] {
  const length = end - start + 1;
  return Array.from({ length }, (_, index) => index + start);
}

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
  // An ellipsis hiding a single page becomes that page.
  const at = (index: number): number | null => {
    const value: unknown = pages[index];
    return typeof value === "number" ? value : null;
  };
  for (let index = 0; index < pages.length; index += 1) {
    if (pages[index] === "ellipsis") {
      const prev = at(index - 1) ?? 0;
      const next = at(index + 1) ?? total + 1;
      if (next - prev === 2) pages[index] = prev + 1;
    }
  }
  return pages;
}

/**
 * The pagination's arguments: the values the host may set.
 *
 * The twin (`defaultPage`) is resolved by the framework before the factory
 * is called, so the machine only ever sees the live value.
 */
export interface PaginationArgs {
  page?: string | number;
  pageSize?: string | number;
  count?: number;
  siblingCount?: number;
  boundaryCount?: number;
  defaultBoundaryCount?: number;
}

/** A numeric prop: numbers pass, numeric strings parse, everything else
 * absent. */
const asCount = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** The machine's context, from its arguments: the page falls back to one,
 * the size to ten, and the window's own counts to one each.
 *
 * The seed twins (`defaultPage`, `defaultPageSize`) are the host's writes
 * of the page and the size — the framework resolved them into the args —
 * so they count as writes too.
 */
export function initial(args: PaginationArgs, authored: (name: string) => boolean): PaginationContext {
  // A host that wrote `defaultPage` (or `defaultPageSize`) wrote the
  // channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  return {
    page: written("page") ? asCount(args.page) ?? 1 : 1,
    pageSize: written("pageSize") ? asCount(args.pageSize) ?? 10 : 10,
    count: asCount(args.count) ?? 0,
    siblingCount: asCount(args.siblingCount) ?? 1,
    boundaryCount: asCount(args.boundaryCount) ?? 1,
  };
}

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

export function pagination(
  args: PaginationArgs = {},
  authored: (name: string) => boolean,
): Machine<PaginationContext, PaginationEvent> {
  return createMachine<PaginationContext, PaginationEvent>({
    id: "pagination",
    initial: "idle",
    /**
     * The machine's contract with its hosts: the context fields a host may
     * write, and the event each write carries. A field with an event is
     * REPORTED — the machine decides, and the change reaches the host; a
     * field without one is SILENT.
     */
    fields: {
      page: { event: "SET_PAGE" },
      pageSize: { event: "SET_PAGE_SIZE" },
      count: {},
      siblingCount: {},
      boundaryCount: {},
    },
    context: initial(args, authored),
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
        // The page arrives the way the host wrote it; the machine shapes it.
        const page = clampPage(asCount(event.page) ?? 1, totalPages(ctx));
        return page === ctx.page ? {} : { page };
      },
      setPageSize: (ctx: PaginationContext, event: PaginationEvent): Partial<PaginationContext> => {
        if (event.type !== "SET_PAGE_SIZE") return {};
        const size = asCount(event.pageSize);
        if (size === null) return {};
        return { pageSize: Math.max(1, Math.floor(size)) };
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
  });
}
