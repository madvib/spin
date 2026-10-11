import type { MachineDef } from "@spin/runtime";
import { createAsyncListBridge } from "./async-list.bridge.ts";
import type { AsyncListFailure, AsyncListSuccess } from "./async-list.bridge.ts";
/**
 * The async-list's seam: the bridge, the element's imperative commands and
 * the CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge` routes
 * straight to the fork, which is what makes this interpreter a drop-in behind
 * the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `load-success` carries `onSuccess`
 * with the items the resolved page contributed, `load-error` carries
 * `onError` with the failure. Zag's `abort` is not reported: an abort is the
 * host's own decision, and the load it stopped never returns anything.
 */

export type { AsyncListFailure, AsyncListSuccess };

export const asyncList: MachineDef = {
  createBridge: createAsyncListBridge,
  commands: ["abort", "reload", "loadMore", "sort", "setFilterText", "clearFilter"],
  events: {
    "load-success": {
      on: "onSuccess",
      detail: (change: AsyncListSuccess) => ({ items: change.items }),
    },
    "load-error": {
      on: "onError",
      detail: (change: AsyncListFailure) => ({ error: change.error }),
    },
  },
};
