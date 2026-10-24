import { assertEquals } from "@std/assert";
import type { AngleSliderApi } from "./angle-slider.presentation.ts";

Deno.test("AngleSliderApi state type", () => {
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    AngleSliderApi["state"],
    "idle" | "focused" | "dragging"
  > = true;
  assertEquals(stateTyped, true);
});
