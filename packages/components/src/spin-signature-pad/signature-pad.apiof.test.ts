import { assertEquals } from "@std/assert";
import type { SignaturePadApi } from "./signature-pad.presentation.ts";

Deno.test("SignaturePadApi promises the component's surface", () => {
  const keys: (keyof SignaturePadApi)[] = [
    "empty",
    "drawing",
    "currentPath",
    "paths",
    "getDataUrl",
    "clear",
    "getRootProps",
    "getLabelProps",
    "getControlProps",
    "getSegmentProps",
    "getSegmentPathProps",
    "getGuideProps",
    "getClearTriggerProps",
    "getHiddenInputProps",
  ];
  assertEquals(keys.length, 14);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
  const clearTyped: AssertExact<SignaturePadApi["clear"], () => void> = true;
  const drawingTyped: AssertExact<SignaturePadApi["drawing"], boolean> = true;
  assertEquals([clearTyped, drawingTyped].every(Boolean), true);
});
