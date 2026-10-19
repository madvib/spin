import { datePicker } from "./date-picker.bindings.ts";
import type { DatePickerValueChange } from "./date-picker.bindings.ts";

/**
 * The date-picker's seam: the synthesized bridge, the element's
 * imperative commands, and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` (the ISO strings), `focus-change` carries
 * `onFocusChange`, `view-change` carries `onViewChange`, and
 * `open-change` carries `onOpenChange`.
 */

export { datePicker };
export type { DatePickerValueChange };
