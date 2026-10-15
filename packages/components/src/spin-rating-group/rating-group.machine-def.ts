import { ratingGroup } from "./rating-group.def.ts";
import type { RatingGroupValueChange } from "./rating-group.machine.ts";
import type { RatingGroupHoverChange } from "./rating-group.def.ts";

/**
 * The rating-group's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries the
 * committed rating, `hover-change` the preview.
 */

export { ratingGroup };
export type { RatingGroupHoverChange, RatingGroupValueChange };
