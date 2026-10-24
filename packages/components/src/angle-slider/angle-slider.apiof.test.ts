import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { AngleSliderApi } from "./angle-slider.presentation.ts";

test("AngleSliderApi state type", () => {
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    AngleSliderApi["state"],
    "idle" | "focused" | "dragging"
  > = true;
  deepStrictEqual(stateTyped, true);
});
