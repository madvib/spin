import { ratingGroup } from "./rating-group.bindings.ts";
import type { RatingGroupValueChange } from "./rating-group.machine.ts";
import type { RatingGroupHoverChange } from "./rating-group.bindings.ts";

/**
 * The rating-group's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries the
 * committed rating, `hover-change` the preview.
 */

export { ratingGroup };
export type { RatingGroupHoverChange, RatingGroupValueChange };
