import { defaultTwin } from "@spinjs/components/runtime";
import type { PaginationPageItem } from "./pagination.events.ts";

export type PaginationState = "idle";

export interface PaginationContext {
  page: number;
  pageSize: number;
  count: number;
  siblingCount: number;
  boundaryCount: number;
  label: string | undefined;
  firstLabel: string | undefined;
  prevLabel: string | undefined;
  nextLabel: string | undefined;
  lastLabel: string | undefined;
}

export interface PaginationArgs {
  page?: string | number;
  pageSize?: string | number;
  count?: number;
  siblingCount?: number;
  boundaryCount?: number;
  defaultBoundaryCount?: number;
  label?: string;
  firstLabel?: string;
  prevLabel?: string;
  nextLabel?: string;
  lastLabel?: string;
}

/** A numeric prop: numbers pass, numeric strings parse, everything else
 * absent. */
export const asCount = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
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

export function pageRange(
  ctx: PaginationContext,
): { start: number; end: number } {
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
  const totalNumbers = Math.min(
    siblingCount * 2 + 3 + boundaryCount * 2,
    total,
  );
  if (total <= totalNumbers) return range(1, total);
  const slots = totalNumbers - 1 - boundaryCount;
  const showLeft = leftSibling > 1 + boundaryCount + 1 &&
    Math.abs(leftSibling - 1) > boundaryCount + 1;
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

export function pageOptions(ctx: PaginationContext): PaginationPageItem[] {
  return range(1, totalPages(ctx)).map((value) => ({
    type: "page" as const,
    value,
    key: `page:${value}`,
    label: String(value),
  }));
}

export function pageItems(
  ctx: PaginationContext,
): import("./pagination.events.ts").PaginationPageItem[] {
  let ellipsis = 0;
  return pageWindow(ctx).map((value) => {
    if (typeof value === "number") {
      return {
        type: "page" as const,
        value,
        key: `page:${value}`,
        label: String(value),
      };
    }
    ellipsis += 1;
    return {
      type: "ellipsis" as const,
      index: ellipsis,
      key: `ellipsis:${ellipsis}`,
      label: "\u2026",
    };
  });
}

const clampPage = (page: number, total: number): number =>
  Math.min(Math.max(page, 1), total);
export { clampPage };

export function initial(
  args: PaginationArgs,
  authored: (name: string) => boolean,
): PaginationContext {
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
    label: args.label,
    firstLabel: args.firstLabel,
    prevLabel: args.prevLabel,
    nextLabel: args.nextLabel,
    lastLabel: args.lastLabel,
  };
}
