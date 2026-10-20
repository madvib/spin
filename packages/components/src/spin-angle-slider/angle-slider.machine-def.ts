import { angleSlider } from "./angle-slider.bindings.ts";
import type { AngleSliderValueChangeEnd } from "./angle-slider.bindings.ts";
import type { AngleSliderValueChange } from "./angle-slider.machine.ts";

/**
 * The angle-slider's seam: the synthesized bridge, the element's
 * imperative commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries the
 * degrees on every move, `value-change-end` on release and keyboard
 * commits.
 */

export { angleSlider };
export type { AngleSliderValueChange, AngleSliderValueChangeEnd };
