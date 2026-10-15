import type { MachineDef } from "@spin/runtime";
import { createPaginationBridge } from "./pagination.bridge.ts";
import type { PaginationPageChange, PaginationPageSizeChange } from "./pagination.machine.ts";

/**
 * The pagination's seam: the bridge, the element's imperative commands and
 * the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `page-change` carries the page
 * and size on every move, `page-size-change` the size alone.
 */

export type { PaginationPageChange, PaginationPageSizeChange };

export const pagination: MachineDef = {
  createBridge: createPaginationBridge,
  commands: [
    "setPage",
    "setPageSize",
    "goToFirstPage",
    "goToLastPage",
    "goToNextPage",
    "goToPrevPage",
  ],
  events: {
    "page-change": {
      on: "onPageChange",
      detail: (change: PaginationPageChange) => ({ page: change.page, pageSize: change.pageSize }),
    },
    "page-size-change": {
      on: "onPageSizeChange",
      detail: (change: PaginationPageSizeChange) => ({ pageSize: change.pageSize }),
    },
  },
};
