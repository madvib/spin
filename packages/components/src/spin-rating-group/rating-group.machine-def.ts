import type { MachineDef } from "@spin/runtime";
import { createRatingGroupBridge } from "./rating-group.bridge.ts";
import type { RatingGroupHoverChange } from "./rating-group.bridge.ts";
import type { RatingGroupValueChange } from "./rating-group.machine.ts";

/**
 * The rating-group's seam: the bridge, the element's imperative commands
 * and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries the
 * committed rating, `hover-change` the preview.
 */

export type { RatingGroupHoverChange, RatingGroupValueChange };

export const ratingGroup: MachineDef = {
  createBridge: createRatingGroupBridge,
  commands: ["setValue", "clearValue"],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: RatingGroupValueChange) => ({ value: change.value }),
    },
    "hover-change": {
      on: "onHoverChange",
      detail: (change: RatingGroupHoverChange) => ({ hoveredValue: change.hoveredValue }),
    },
  },
};
