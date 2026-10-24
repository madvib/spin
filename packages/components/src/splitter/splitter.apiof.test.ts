import { assertEquals } from "@std/assert";
import type { SplitterApi } from "./splitter.presentation.ts";

Deno.test("SplitterApi state type", () => {
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    SplitterApi["state"],
    "idle" | "hover" | "focused" | "dragging"
  > = true;
  assertEquals(stateTyped, true);
});
