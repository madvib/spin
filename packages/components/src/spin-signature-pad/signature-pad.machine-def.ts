import { signaturePad } from "./signature-pad.bindings.ts";
import type { SignaturePadDrawDetails } from "./signature-pad.bindings.ts";

/**
 * The signature-pad's seam: the synthesized bridge, the element's
 * imperative commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `draw` carries the committed
 * paths plus the in-progress stroke on every move; `draw-end` carries the
 * committed paths on release and on clear.
 */

export { signaturePad };
export type { SignaturePadDrawDetails };
