import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { ColorPickerApi } from "./color-picker.presentation.ts";
import type { ColorChannel } from "@zag-js/color-utils";

// The derived api's public surface, pinned: removing a reader, method,
// command, part, or slot from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
test("ColorPickerApi promises the component's surface", () => {
  const keys: (keyof ColorPickerApi)[] = [
    "state",
    "open",
    "value",
    "valueAsString",
    "format",
    "disabled",
    "empty",
    "setValue",
    "setFormat",
    "setOpen",
    "getChannelValue",
    "getRootProps",
    "getLabelProps",
    "getControlProps",
    "getTriggerProps",
    "getPositionerProps",
    "getContentProps",
    "getValueTextProps",
    "getAreaProps",
    "getAreaBackgroundProps",
    "getAreaThumbProps",
    "getTransparencyGridProps",
    "getChannelSliderProps",
    "getChannelSliderTrackProps",
    "getChannelSliderThumbProps",
    "getChannelSliderLabelProps",
    "getChannelSliderValueTextProps",
    "getChannelInputProps",
    "getHiddenInputProps",
    "getEyeDropperTriggerProps",
    "getFormatSelectProps",
    "getSwatchGroupProps",
    "getSwatchTriggerProps",
    "getSwatchIndicatorProps",
    "getSwatchProps",
  ];
  deepStrictEqual(keys.length, 35);
  // Derived member signatures: state union, typed command tuples, typed
  // methods, and typed slot parameter records.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    ColorPickerApi["state"],
    "idle" | "focused" | "active" | "dragging"
  > = true;
  const setValueTyped: AssertExact<
    ColorPickerApi["setValue"],
    (value: string) => void
  > = true;
  const setOpenTyped: AssertExact<
    ColorPickerApi["setOpen"],
    (open: boolean) => void
  > = true;
  const getChannelValueTyped: AssertExact<
    ColorPickerApi["getChannelValue"],
    (channel: ColorChannel | "hex") => string
  > = true;
  deepStrictEqual(
    [
      stateTyped,
      setValueTyped,
      setOpenTyped,
      getChannelValueTyped,
    ].every(Boolean),
    true,
  );
});
