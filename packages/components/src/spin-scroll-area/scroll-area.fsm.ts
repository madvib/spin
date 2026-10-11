import type { MachineDef } from "@spin/runtime";
import { createScrollAreaFsmBridge } from "./scroll-area.bridge.ts";

/**
 * The scroll-area's seam: the bridge and the element's imperative commands.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge` routes
 * straight to the fork, which is what makes this interpreter a drop-in behind
 * the `scrollAreaFsm.machine-def.ts` contract the plugin consumes.
 *
 * Zag publishes no callbacks for this component: its whole surface is the api
 * and the six part bags, so there are no CustomEvents to declare. Hosts poll
 * the edges through the element's own reads; the two scroll commands move it.
 */

export const scrollArea: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("scroll-area fsm runs through createScrollAreaFsmBridge");
  }) as never,
  createBridge: createScrollAreaFsmBridge,
  commands: ["scrollTo", "scrollToEdge", "getScrollProgress", "getScrollbarState"],
  events: {},
};
