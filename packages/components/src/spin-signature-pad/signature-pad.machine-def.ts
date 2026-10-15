import type { MachineDef } from "@spin/runtime";
import { createSignaturePadBridge } from "./signature-pad.bridge.ts";
import type { SignaturePadDrawDetails } from "./signature-pad.machine.ts";

/**
 * The signature-pad's seam: the bridge, the element's imperative commands
 * and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `draw` carries the committed
 * paths plus the in-progress stroke on every move; `draw-end` carries the
 * committed paths on release and on clear.
 */

export type { SignaturePadDrawDetails };

export const signaturePad: MachineDef = {
  createBridge: createSignaturePadBridge,
  commands: ["clear", "getDataUrl"],
  events: {
    draw: {
      on: "onDraw",
      detail: (change: SignaturePadDrawDetails) => ({
        paths: [...change.paths],
        currentPath: change.currentPath,
      }),
    },
    "draw-end": {
      on: "onDrawEnd",
      detail: (change: SignaturePadDrawDetails) => ({
        paths: [...change.paths],
        currentPath: change.currentPath,
      }),
    },
  },
};
