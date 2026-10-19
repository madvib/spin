import { carousel } from "./carousel.bindings.ts";

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

export { carousel };
export type {
  CarouselAutoplayStatusChange,
  CarouselDragStatus,
  CarouselDragStatusChange,
  CarouselIndexChange,
} from "./carousel.bindings.ts";
