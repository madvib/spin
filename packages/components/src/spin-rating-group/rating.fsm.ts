import type { MachineDef } from "@spin/runtime";
import { createRatingFsmBridge } from "./rating.bridge.ts";
import type { RatingHoverChange, RatingValueChange } from "./rating.bridge.ts";

/**
 * The rating group's seam: the bridge, the element's imperative commands and
 * the CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge` routes
 * straight to the fork, which is what makes this interpreter a drop-in behind
 * the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange({ value })` and `hover-change` carries
 * `onHoverChange({ hoveredValue })`, the previewed value while the pointer
 * is over the group.
 */

export type { RatingHoverChange, RatingValueChange };

export const rating: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("rating fsm runs through createRatingFsmBridge");
  }) as never,
  createBridge: createRatingFsmBridge,
  commands: ["setValue", "clearValue"],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: RatingValueChange) => ({ value: change.value }),
    },
    "hover-change": {
      on: "onHoverChange",
      detail: (change: RatingHoverChange) => ({ hoveredValue: change.hoveredValue }),
    },
  },
};
