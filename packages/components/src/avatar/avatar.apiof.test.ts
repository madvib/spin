import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { AvatarApi } from "./avatar.presentation.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, or part from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
test("AvatarApi promises the component's surface", () => {
  const keys: (keyof AvatarApi)[] = [
    "state",
    "loaded",
    "src",
    "status",
    "setSrc",
    "setLoaded",
    "setError",
    "getRootProps",
    "getImageProps",
    "getFallbackProps",
  ];
  deepStrictEqual(keys.length, 10);
  // Derived member signatures: state union and typed command tuples.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    AvatarApi["state"],
    "loading" | "loaded" | "error"
  > = true;
  const setSrcTyped: AssertExact<AvatarApi["setSrc"], (src: string) => void> =
    true;
  const setLoadedTyped: AssertExact<AvatarApi["setLoaded"], () => void> = true;
  const statusTyped: AssertExact<
    AvatarApi["status"],
    "loading" | "error" | "loaded"
  > = true;
  const srcTyped: AssertExact<AvatarApi["src"], string> = true;
  deepStrictEqual(
    [
      stateTyped,
      setSrcTyped,
      setLoadedTyped,
      statusTyped,
      srcTyped,
    ].every(Boolean),
    true,
  );
});
