import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type {
  NavigationMenuApi,
  NavItemRecord,
} from "./navigation-menu.presentation.ts";

test("NavigationMenuApi promises the component's surface", () => {
  const keys: (keyof NavigationMenuApi)[] = [
    "state",
    "value",
    "items",
    "open",
    "show",
    "hide",
    "toggle",
    "getRootProps",
    "getItems",
    "getListProps",
    "getItemProps",
    "getLinkProps",
    "getItemContentProps",
  ];
  deepStrictEqual(keys.length, 13);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<NavigationMenuApi["state"], "idle" | "open"> =
    true;
  const showTyped: AssertExact<
    NavigationMenuApi["show"],
    (value: string) => void
  > = true;
  const valueTyped: AssertExact<NavigationMenuApi["value"], string> = true;
  const itemsTyped: AssertExact<
    NavigationMenuApi["items"],
    readonly NavItemRecord[]
  > = true;
  deepStrictEqual(
    [stateTyped, showTyped, valueTyped, itemsTyped].every(Boolean),
    true,
  );
});
