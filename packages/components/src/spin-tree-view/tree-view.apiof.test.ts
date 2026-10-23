import { assertEquals } from "@std/assert";
import type { TreeApi, VisibleRow } from "./tree-view.presentation.ts";

Deno.test("TreeApi promises the component's surface", () => {
  const keys: (keyof TreeApi)[] = [
    "state",
    "focusedValue",
    "expandedValue",
    "selectedValue",
    "checkedValue",
    "renamingValue",
    "loadingStatus",
    "nodes",
    "getVisibleRows",
    "isBranch",
    "getItemState",
    "startRenaming",
    "getRootProps",
    "getTreeProps",
    "getLabelProps",
    "getValueTextProps",
    "getItemProps",
    "getBranchControlProps",
    "getBranchIndicatorProps",
    "getItemIconProps",
    "getRailProps",
    "getBranchTextProps",
    "getBranchContentProps",
    "getCheckboxProps",
    "getLoadingProps",
    "getRenameInputProps",
    "getItemIndexes",
    "getBranchControlIndexes",
    "getBranchIndicatorIndexes",
    "getItemIconIndexes",
    "getRailIndexes",
    "getBranchTextIndexes",
    "getBranchContentIndexes",
    "getCheckboxIndexes",
    "getLoadingIndexes",
    "getRenameInputIndexes",
  ];
  assertEquals(keys.length, 36);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
  const stateTyped: AssertExact<TreeApi["state"], "idle" | "renaming"> = true;
  const startRenamingTyped: AssertExact<TreeApi["startRenaming"], (value: string) => void> = true;
  const getVisibleRowsTyped: AssertExact<TreeApi["getVisibleRows"], () => readonly VisibleRow[]> = true;
  assertEquals([stateTyped, startRenamingTyped, getVisibleRowsTyped].every(Boolean), true);
});
