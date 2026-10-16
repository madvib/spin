import { dateInput } from "./date-input.def.ts";
import type { DateInputValueChange, DateValue } from "./date-input.def.ts";

/**
 * The date-input's seam: the synthesized bridge, the element's
 * imperative commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` with the committed ISO date and its `yyyy-mm-dd` string.
 */

export { dateInput };
export type { DateInputValueChange, DateValue };
