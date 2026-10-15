import type { MachineDef } from "@spin/runtime";
import { createFloatingPanelBridge } from "./floating-panel.bridge.ts";
import type { FloatingPanelSize } from "./floating-panel.machine.ts";

/**
 * The floating-panel's seam: the bridge, the element's imperative
 * commands, and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `open-change` carries
 * `onOpenChange`, `size-change` carries `onSizeChange`,
 * `position-change` carries `onPositionChange`, and `stage-change`
 * carries `onStageChange`.
 */

export type { FloatingPanelSize };

export const floatingPanel: MachineDef = {
  createBridge: createFloatingPanelBridge,
  commands: ["setOpen", "close", "minimize", "maximize", "restore"],
  events: {
    "open-change": {
      on: "onOpenChange",
      detail: (change: { open: boolean }) => ({ open: change.open }),
    },
    "size-change": {
      on: "onSizeChange",
      detail: (change: { size: { w: number; h: number } }) => ({
        size: { w: change.size.w, h: change.size.h },
      }),
    },
    "position-change": {
      on: "onPositionChange",
      detail: (change: { position: { x: number; y: number } }) => ({
        position: { x: change.position.x, y: change.position.y },
      }),
    },
    "stage-change": {
      on: "onStageChange",
      detail: (change: { stage: string }) => ({ stage: change.stage }),
    },
  },
};
