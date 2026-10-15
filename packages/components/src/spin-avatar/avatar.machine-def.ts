import type { MachineDef } from "@spin/runtime";
import { createAvatarBridge } from "./avatar.bridge.ts";
import type { AvatarStatusChange } from "./avatar.machine.ts";

/**
 * The avatar's seam: the bridge, the element's imperative commands and the
 * CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `status-change` carries loading,
 * error, or loaded on every transition.
 */

export type { AvatarStatusChange };

export const avatar: MachineDef = {
  createBridge: createAvatarBridge,
  commands: ["setSrc", "setLoaded", "setError"],
  events: {
    "status-change": {
      on: "onStatusChange",
      detail: (change: AvatarStatusChange) => ({ status: change.status }),
    },
  },
};
