import type { MachineDef } from "@spin/runtime";
import { createPaginationFsmBridge } from "./pagination.bridge.ts";
import type { PaginationPageChange, PaginationPageSizeChange } from "./pagination.bridge.ts";

/**
 * The pagination's seam: the bridge, the element's imperative commands and
 * the CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge` routes
 * straight to the fork, which is what makes this interpreter a drop-in behind
 * the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `page-change` carries
 * `onPageChange` with the page and the page size it landed on, and
 * `page-size-change` carries `onPageSizeChange`. Zag fires the size change
 * before the page repair, so a host that watches both sees the same order.
 */

export type { PaginationPageChange, PaginationPageSizeChange };

export const pagination: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("pagination fsm runs through createPaginationFsmBridge");
  }) as never,
  createBridge: createPaginationFsmBridge,
  commands: [
    "setPage",
    "setPageSize",
    "goToNextPage",
    "goToPrevPage",
    "goToFirstPage",
    "goToLastPage",
  ],
  events: {
    "page-change": {
      on: "onPageChange",
      detail: (change: PaginationPageChange) => ({
        page: change.page,
        pageSize: change.pageSize,
      }),
    },
    "page-size-change": {
      on: "onPageSizeChange",
      detail: (change: PaginationPageSizeChange) => ({ pageSize: change.pageSize }),
    },
  },
};
