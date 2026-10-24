import type { AssignFor, GuardFor } from "@spin/runtime/fsm";
import type { PaginationEvents } from "./pagination.events.ts";
import type { PaginationContext } from "./pagination.state.ts";
import { asCount, clampPage, totalPages } from "./pagination.state.ts";

type PaginationAssign<
  K extends keyof PaginationEvents = keyof PaginationEvents,
> = AssignFor<
  PaginationContext,
  PaginationEvents,
  K
>;

export const setCount: PaginationAssign<"SET_COUNT"> = (_ctx, event) => ({
  count: Math.max(0, Math.floor(event.count)),
});

export const canSetPage: GuardFor<PaginationContext, PaginationEvents> = (
  _ctx,
  event,
) =>
  event.type === "SET_PAGE" && event.page >= 1 &&
  event.page <= totalPages(_ctx);

export const setPage: PaginationAssign<"SET_PAGE"> = (ctx, event) => {
  const page = clampPage(asCount(event.page) ?? 1, totalPages(ctx));
  return page === ctx.page ? {} : { page };
};

export const setPageSize: PaginationAssign<"SET_PAGE_SIZE"> = (ctx, event) => {
  const size = asCount(event.pageSize);
  if (size === null) return {};
  return { pageSize: Math.max(1, Math.floor(size)) };
};

export const resetPageIfStranded: PaginationAssign<
  "SET_PAGE_SIZE" | "SET_COUNT"
> = (ctx) => {
  return ctx.page > totalPages(ctx) ? { page: 1 } : {};
};

export const firstPage: PaginationAssign<"FIRST_PAGE"> = (ctx) => {
  return ctx.page === 1 ? {} : { page: 1 };
};

export const lastPage: PaginationAssign<"LAST_PAGE"> = (ctx) => {
  const last = totalPages(ctx);
  return ctx.page === last ? {} : { page: last };
};

export const hasPrev: GuardFor<PaginationContext, PaginationEvents> = (ctx) =>
  ctx.page > 1;

export const prevPage: PaginationAssign<"PREVIOUS_PAGE"> = (ctx) => ({
  page: clampPage(ctx.page - 1, totalPages(ctx)),
});

export const hasNext: GuardFor<PaginationContext, PaginationEvents> = (ctx) =>
  ctx.page < totalPages(ctx);

export const nextPage: PaginationAssign<"NEXT_PAGE"> = (ctx) => ({
  page: clampPage(ctx.page + 1, totalPages(ctx)),
});
