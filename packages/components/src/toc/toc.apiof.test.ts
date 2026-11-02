import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { TocApi, TocItem, TocItemState, TocRow } from "./toc.presentation.ts";

test("TocApi promises the component's surface", () => {
  const keys: (keyof TocApi)[] = [
    "state",
    "items",
    "activeIds",
    "activeItems",
    "value",
    "scrollTo",
    "setActiveIds",
    "setItems",
    "getItemState",
    "getRootProps",
    "getNavProps",
    "getTitleProps",
    "getListProps",
    "getIndicatorProps",
    "getItemProps",
    "getLinkProps",
  ];
  deepStrictEqual(keys.length, 16);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<TocApi["state"], "idle" | "focused"> = true;
  const scrollToTyped: AssertExact<
    TocApi["scrollTo"],
    (value: string) => void
  > = true;
  const setActiveIdsTyped: AssertExact<
    TocApi["setActiveIds"],
    (activeIds: readonly string[]) => void
  > = true;
  const setItemsTyped: AssertExact<
    TocApi["setItems"],
    (items: readonly TocRow[]) => void
  > = true;
  const getItemStateTyped: AssertExact<
    TocApi["getItemState"],
    (row: TocItem | string) => TocItemState
  > = true;
  deepStrictEqual(
    [
      stateTyped,
      scrollToTyped,
      setActiveIdsTyped,
      setItemsTyped,
      getItemStateTyped,
    ].every(Boolean),
    true,
  );
});
