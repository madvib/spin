/** Pagination machine: one idle state with guarded transitions. */

import { createMachine, type Machine } from "@spin/runtime/fsm";
import type { PaginationArgs, PaginationContext, PaginationState } from "./pagination.state.ts";
import { initial } from "./pagination.state.ts";
import type { PaginationEvents } from "./pagination.events.ts";
import {
  canSetPage,
  firstPage,
  hasNext,
  hasPrev,
  lastPage,
  nextPage as nextPageTransition,
  prevPage,
  resetPageIfStranded,
  setCount,
  setPage,
  setPageSize,
} from "./pagination.transitions.ts";

export {
  asCount,
  clampPage,
  nextPage,
  pageItems,
  pageRange,
  pageWindow,
  previousPage,
  totalPages,
} from "./pagination.state.ts";

export type { PaginationPageChange, PaginationPageSizeChange, PaginationPageItem } from "./pagination.events.ts";

export function pagination(
  args: PaginationArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<PaginationContext, PaginationEvents, PaginationState> {
  return createMachine<PaginationContext, PaginationEvents, PaginationState>({
    id: "pagination",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      page: { event: "SET_PAGE" },
      pageSize: { event: "SET_PAGE_SIZE" },
      count: { event: "SET_COUNT" },
      siblingCount: {},
      boundaryCount: {},
      label: {},
      firstLabel: {},
      prevLabel: {},
      nextLabel: {},
      lastLabel: {},
    },
    on: {
      SET_COUNT: { assign: [setCount, resetPageIfStranded] },
    },
    states: {
      idle: {
        on: {
          SET_PAGE: [{ cond: canSetPage, assign: setPage }],
          SET_PAGE_SIZE: { assign: [setPageSize, resetPageIfStranded] },
          FIRST_PAGE: { assign: firstPage },
          LAST_PAGE: { assign: lastPage },
          PREVIOUS_PAGE: [{ cond: hasPrev, assign: prevPage }],
          NEXT_PAGE: [{ cond: hasNext, assign: nextPageTransition }],
        },
      },
    },
  });
}
