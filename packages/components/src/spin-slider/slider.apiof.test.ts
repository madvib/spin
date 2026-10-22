import { assertEquals } from "@std/assert";
import type { SliderApi } from "./slider.bindings.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, part, or slot from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
Deno.test("SliderApi promises the component's surface", () => {
  const keys: (keyof SliderApi)[] = [
    "state",
    "value",
    "markers",
    "valueText",
    "dragging",
    "focused",
    "focusedIndex",
    "disabled",
    "setValue",
    "setThumbValue",
    "increment",
    "decrement",
    "focus",
    "getThumbValue",
    "getThumbPercent",
    "getThumbMin",
    "getThumbMax",
    "getThumbIndexes",
    "getMarkerIndexes",
    "getMarkers",
    "getRootProps",
    "getLabelProps",
    "getValueTextProps",
    "getControlProps",
    "getMarkerGroupProps",
    "getMarkerProps",
    "getTrackProps",
    "getRangeProps",
    "getThumbProps",
    "getHiddenInputProps",
  ];
  assertEquals(keys.length, 30);
  // Derived member signatures: state union, typed command tuples, typed
  // methods, and typed slot parameter records.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
  const stateTyped: AssertExact<SliderApi["state"], "idle" | "focus" | "dragging"> = true;
  const setValueTyped: AssertExact<SliderApi["setValue"], (value: readonly number[]) => void> = true;
  const setThumbValueTyped: AssertExact<SliderApi["setThumbValue"], (index: number, value: number) => void> = true;
  const incrementTyped: AssertExact<SliderApi["increment"], (index?: number) => void> = true;
  const focusTyped: AssertExact<SliderApi["focus"], () => void> = true;
  const getThumbValueTyped: AssertExact<SliderApi["getThumbValue"], (index: number) => number> = true;
  const getMarkersTyped: AssertExact<SliderApi["getMarkers"], () => number[]> = true;
  const getThumbPropsTyped: AssertExact<SliderApi["getThumbProps"], (slot: { readonly index: number }) => Record<string, unknown>> = true;
  const getMarkerPropsTyped: AssertExact<SliderApi["getMarkerProps"], (slot: { readonly value: number }) => Record<string, unknown>> = true;
  assertEquals(
    [
      stateTyped,
      setValueTyped,
      setThumbValueTyped,
      incrementTyped,
      focusTyped,
      getThumbValueTyped,
      getMarkersTyped,
      getThumbPropsTyped,
      getMarkerPropsTyped,
    ].every(Boolean),
    true,
  );
});
