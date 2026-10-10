import type { MachineDef } from "@spin/runtime";
import { carousel } from "./carousel.fsm.ts";

/**
 * The forked-FSM carousel's machine-def, consumed by
 * `spin-carousel-fsm.html`. Same lookup pattern as tree-view: the consume
 * name is the filename, this file routes to the real def, and the element
 * always runs the fork.
 */

export const carouselFsm: MachineDef = carousel;
