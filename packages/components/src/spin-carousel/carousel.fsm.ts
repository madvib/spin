import type { MachineDef } from "@spin/runtime";
import { createCarouselFsmBridge } from "./carousel.bridge.ts";

/**
 * The carousel machine-def: the seam file codegen finds by consume name.
 *
 * Zag's carousel is ten track/watch effects wrapped around a page index.
 * Here the index and the mode are the machine and every reflex is a stdlib
 * action attached through the connect's bag, so `machine` and `connect` are
 * inert placeholders: the bridge path bypasses the Zag adapter entirely.
 *
 * `index` is this machine's name for Zag's `page` — the element's prop, its
 * command and its event all say `index`, because a carousel pages slides
 * and `page` is one word for two ideas.
 */

export interface CarouselIndexChange {
  readonly index: number;
  readonly pageCount: number;
}

export type CarouselDragStatus = "idle" | "focus" | "dragging" | "settling";

export interface CarouselDragStatusChange {
  readonly status: CarouselDragStatus;
  readonly index: number;
}

export interface CarouselAutoplayStatusChange {
  readonly status: "playing" | "stopped";
  readonly index: number;
}

export const carousel: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("carousel fsm runs through createCarouselFsmBridge");
  }) as never,
  createBridge: createCarouselFsmBridge,
  commands: ["next", "prev", "goTo", "setAutoplay"],
  events: {
    "index-change": {
      on: "onIndexChange",
      detail: (change: CarouselIndexChange) => ({ index: change.index, pageCount: change.pageCount }),
    },
    "drag-status-change": {
      on: "onDragStatusChange",
      detail: (change: CarouselDragStatusChange) => ({ status: change.status, index: change.index }),
    },
    "autoplay-status-change": {
      on: "onAutoplayStatusChange",
      detail: (change: CarouselAutoplayStatusChange) => ({ status: change.status, index: change.index }),
    },
  },
};
