import { pinInput } from "./pin-input.def.ts";
import type {
  PinInputValueChange,
  PinInputValueComplete,
  PinInputValueInvalid,
} from "./pin-input.machine.ts";

/**
 * The pin-input's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` with the filled cells and their joined string,
 * `value-complete` carries `onValueComplete` (an edge report, fired once
 * when the last empty cell fills), and `value-invalid` carries
 * `onValueInvalid` with the refused keystroke and the focused index.
 */

export { pinInput };
export type { PinInputValueChange, PinInputValueComplete, PinInputValueInvalid };
