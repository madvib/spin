import type { MachineDef } from "@spin/runtime";
import { createSplitterBridge } from "./splitter.bridge.ts";
import type { SplitterResizeDetails } from "./splitter.machine.ts";

/**
 * The splitter's seam: the bridge, the element's imperative commands and
 * the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `resize` carries the percent
 * sizes on every move, `resize-end` on release and keyboard commits.
 */

export type { SplitterResizeDetails };

export const splitter: MachineDef = {
  createBridge: createSplitterBridge,
  commands: ["setSizes", "resetSizes", "collapsePanel", "expandPanel", "resizePanel"],
  events: {
    resize: {
      on: "onResize",
      detail: (change: SplitterResizeDetails) => ({
        size: [...change.size],
        handleId: change.handleId,
      }),
    },
    "resize-end": {
      on: "onResizeEnd",
      detail: (change: SplitterResizeDetails) => ({
        size: [...change.size],
        handleId: change.handleId,
      }),
    },
  },
};
