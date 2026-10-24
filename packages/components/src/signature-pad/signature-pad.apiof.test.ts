import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { SignaturePadApi } from "./signature-pad.presentation.ts";

test("SignaturePadApi promises the component's surface", () => {
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
  deepStrictEqual(keys.length, 14);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const clearTyped: AssertExact<SignaturePadApi["clear"], () => void> = true;
  const drawingTyped: AssertExact<SignaturePadApi["drawing"], boolean> = true;
  deepStrictEqual([clearTyped, drawingTyped].every(Boolean), true);
});
