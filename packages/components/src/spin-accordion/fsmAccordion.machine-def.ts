import type { MachineDef } from "@spin/runtime";
import { accordion } from "./accordion.fsm.ts";

/**
 * The forked-FSM accordion's machine-def, consumed by
 * `spin-accordion-fsm.html`.
 *
 * Same lookup pattern as the robot def: the consume name
 * (`fsmAccordion`) is the filename (`fsmAccordion.machine-def.ts`), and
 * this file only routes to the real def. This element always runs the
 * forked FSM — no build flag — so the three-way side-by-side is honest:
 * Zag, robot3, and our fork, all live in one page.
 */

export const fsmAccordion: MachineDef = accordion;
