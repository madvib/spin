import type { MachineDef } from "@spin/runtime";
import { createColorPickerBridge } from "./color-picker.bridge.ts";
import type {
  ColorPickerFormatChange,
  ColorPickerOpenChange,
  ColorPickerValueChange,
} from "./color-picker.bridge.ts";

/**
 * The color-picker's seam: the bridge, the element's imperative commands and
 * the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` with the serialized color and its format,
 * `value-change-end` carries `onValueChangeEnd` on drag release and
 * committed inputs, `open-change` carries `onOpenChange`, and
 * `format-change` carries `onFormatChange`.
 */

export type {
  ColorPickerFormatChange,
  ColorPickerOpenChange,
  ColorPickerValueChange,
};

export const colorPicker: MachineDef = {
  createBridge: createColorPickerBridge,
  commands: ["setValue", "setFormat", "setOpen"],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: ColorPickerValueChange) => ({ value: change.value, format: change.format }),
    },
    "value-change-end": {
      on: "onValueChangeEnd",
      detail: (change: ColorPickerValueChange) => ({ value: change.value, format: change.format }),
    },
    "open-change": {
      on: "onOpenChange",
      detail: (change: ColorPickerOpenChange) => ({ open: change.open }),
    },
    "format-change": {
      on: "onFormatChange",
      detail: (change: ColorPickerFormatChange) => ({ format: change.format }),
    },
  },
};
