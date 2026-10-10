import type { MachineDef } from "@spin/runtime";
import { createAvatarFsmBridge } from "./avatar.bridge.ts";
import type { AvatarStatusChange } from "./avatar.bridge.ts";

/**
 * The avatar's seam: the bridge, the element's imperative commands and the
 * CustomEvent the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge`
 * routes straight to the fork, which is what makes this interpreter a
 * drop-in behind the `avatarFsm.machine-def.ts` contract the plugin
 * consumes.
 *
 * The event is faithful to Zag's callback: `status-change` carries
 * `onStatusChange`, which fires with the settled status (`loaded` or
 * `error`) — never with `loading`, exactly as Zag's `invokeOnLoad` and
 * `invokeOnError` do.
 */

export type { AvatarStatusChange };

export const avatar: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("avatar fsm runs through createAvatarFsmBridge");
  }) as never,
  createBridge: createAvatarFsmBridge,
  // `setSrc` is the connect's (a DOM write the observer then reports), so
  // the bridge owns only the two imperative status writes.
  commands: ["setSrc", "setLoaded", "setError"],
  events: {
    "status-change": {
      on: "onStatusChange",
      detail: (change: AvatarStatusChange) => ({ status: change.status }),
    },
  },
};
