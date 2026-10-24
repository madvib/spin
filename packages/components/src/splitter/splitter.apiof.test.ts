import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { SplitterApi } from "./splitter.presentation.ts";

test("SplitterApi state type", () => {
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    SplitterApi["state"],
    "idle" | "hover" | "focused" | "dragging"
  > = true;
  deepStrictEqual(stateTyped, true);
});
