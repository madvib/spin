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
  assertEquals(keys.length, 29);
});
