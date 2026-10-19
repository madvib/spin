import { colorPicker } from "./color-picker.bindings.ts";
import type {
  ColorPickerFormatChange,
  ColorPickerOpenChange,
  ColorPickerValueChange,
} from "./color-picker.bindings.ts";

/**
 * The color-picker's seam: the synthesized bridge, the element's
 * imperative commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` with the serialized color and its format,
 * `value-change-end` carries `onValueChangeEnd` on drag release and
 * committed inputs, `open-change` carries `onOpenChange`, and
 * `format-change` carries `onFormatChange`.
 */

export { colorPicker };
export type {
  ColorPickerFormatChange,
  ColorPickerOpenChange,
  ColorPickerValueChange,
};
