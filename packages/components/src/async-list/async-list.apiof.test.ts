import { assertEquals } from "@std/assert";
import type { AsyncListApi, AsyncListRow } from "./async-list.presentation.ts";
import type { SortDescriptor } from "./async-list.state.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, part, or slot from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
Deno.test("AsyncListApi promises the component's surface", () => {
  const keys: (keyof AsyncListApi)[] = [
    "state",
    "items",
    "loading",
    "sorting",
    "empty",
    "hasMore",
    "error",
    "filterText",
    "cursor",
    "sortDescriptor",
    "abort",
    "reload",
    "loadMore",
    "sort",
    "setFilterText",
    "clearFilter",
    "getRows",
    "getRootProps",
    "getProgressProps",
    "getListProps",
    "getItemProps",
    "getEmptyProps",
    "getErrorProps",
    "getFilterInputProps",
    "getClearFilterProps",
    "getReloadProps",
    "getLoadMoreProps",
    "getSortTriggerProps",
    "getSentinelProps",
    "getItemIndexes",
    "getSortTriggerIndexes",
  ];
  assertEquals(keys.length, 31);
  // Derived member signatures: state union, typed command tuples, typed
  // methods, and typed slot parameter records.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    AsyncListApi["state"],
    "idle" | "loading" | "sorting"
  > = true;
  const sortTyped: AssertExact<
    AsyncListApi["sort"],
    (sortDescriptor: SortDescriptor) => void
  > = true;
  const getRowsTyped: AssertExact<
    AsyncListApi["getRows"],
    () => readonly AsyncListRow[]
  > = true;
  assertEquals(
    [
      stateTyped,
      sortTyped,
      getRowsTyped,
    ].every(Boolean),
    true,
  );
});
