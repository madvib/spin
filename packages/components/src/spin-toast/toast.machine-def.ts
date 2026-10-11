import type { MachineDef } from "@spin/runtime";
import { createToastBridge } from "./toast.bridge.ts";
import type { ToastStatusChange } from "./toast.bridge.ts";
/**
 * The toast's seam: the bridge, the element's imperative commands and the
 * CustomEvent the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge`
 * routes straight to the fork, which is what makes this interpreter a
 * drop-in behind the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Zag's toast has no group-level callbacks: its store is the out-side, and
 * its per-toast machine reports `onStatusChange`. The one CustomEvent here is
 * that status, with the id and the src Zag's payload carries. The store's own
 * api (`toaster.success`, `toaster.promise`, `isVisible`, ...) is app code
 * and does not travel with the machine — see the port's parity notes.
 */

export type { ToastStatusChange };

export const toast: MachineDef = {
  createBridge: createToastBridge,
  commands: [
    "create",
    "update",
    "dismiss",
    "remove",
    "dismissAll",
    "pause",
    "resume",
  ],
  events: {
    "status-change": {
      on: "onStatusChange",
      detail: (change: ToastStatusChange) => ({
        id: change.id,
        status: change.status,
        src: change.src,
      }),
    },
  },
};
