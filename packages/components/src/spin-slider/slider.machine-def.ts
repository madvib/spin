import { slider } from "./slider.def.ts";
import type {
  SliderFocusChange,
  SliderValueChange,
  SliderValueChangeEnd,
} from "./slider.machine.ts";

/**
 * The slider's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries the values
 * on every move, `value-change-end` on release and keyboard commits,
 * `focus-change` the focused thumb.
 */

export { slider };
export type { SliderFocusChange, SliderValueChange, SliderValueChangeEnd };
