import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { PaginationApi } from "./pagination.presentation.ts";
import type { PaginationPageItem } from "./pagination.events.ts";

test("PaginationApi promises the component's surface", () => {
  const keys: (keyof PaginationApi)[] = [
    "state",
    "page",
    "pageSize",
    "count",
    "totalPages",
    "pageRange",
    "previousPage",
    "nextPage",
    "firstPage",
    "lastPage",
    "setPage",
    "setPageSize",
    "goToFirstPage",
    "goToLastPage",
    "goToNextPage",
    "goToPrevPage",
    "getItems",
    "getItemLabel",
    "getRootProps",
    "getFirstTriggerProps",
    "getPrevTriggerProps",
    "getNextTriggerProps",
    "getLastTriggerProps",
    "getItemProps",
    "getEllipsisProps",
  ];
  deepStrictEqual(keys.length, 25);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<PaginationApi["state"], "idle"> = true;
  const setPageTyped: AssertExact<
    PaginationApi["setPage"],
    (page: number) => void
  > = true;
  const getItemsTyped: AssertExact<
    PaginationApi["getItems"],
    () => PaginationPageItem[]
  > = true;
  const getItemPropsTyped: AssertExact<
    PaginationApi["getItemProps"],
    (slot: PaginationPageItem) => Record<string, unknown>
  > = true;
  deepStrictEqual(
    [stateTyped, setPageTyped, getItemsTyped, getItemPropsTyped].every(Boolean),
    true,
  );
});
