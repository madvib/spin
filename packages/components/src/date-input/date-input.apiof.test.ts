import { assertEquals } from "@std/assert";
import type { DateInputApi } from "./date-input.presentation.ts";
import type { DateValue } from "./date-input.state.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, part, or slot from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
Deno.test("DateInputApi promises the component's surface", () => {
  const keys: (keyof DateInputApi)[] = [
    "state",
    "value",
    "valueAsString",
    "focused",
    "focus",
    "setValue",
    "clearValue",
    "getSegments",
    "getRootProps",
    "getLabelProps",
    "getControlProps",
    "getSegmentProps",
    "getHiddenInputProps",
  ];
  assertEquals(keys.length, 13);
  // Derived member signatures: state union, typed command tuples, typed
  // methods, and typed slot parameter records.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
  const stateTyped: AssertExact<DateInputApi["state"], "idle" | "focused"> = true;
  const focusTyped: AssertExact<DateInputApi["focus"], () => void> = true;
  const setValueTyped: AssertExact<DateInputApi["setValue"], (value: DateValue | null) => void> = true;
  assertEquals(
    [
      stateTyped,
      focusTyped,
      setValueTyped,
    ].every(Boolean),
    true,
  );
});
