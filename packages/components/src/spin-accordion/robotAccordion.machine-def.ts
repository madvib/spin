import type { MachineDef } from "@spin/runtime";
import { accordion } from "./accordion.robot-def.ts";

/**
 * The robot3 accordion's machine-def, consumed by
 * `spin-accordion-robot.html`.
 *
 * Same export name as the Zag def beside it (`accordion`) because the
 * consume name is what codegen turns into a filename lookup: `consume={
 * robotAccordion }` reads `robotAccordion.machine-def.ts` from this
 * directory. This file is that lookup, and it re-exports the robot
 * machine-def unchanged — the A/B flag lives in `accordion.machine-def.ts`
 * (the element `spin-accordion` consumes), NOT here: this element always
 * runs robot3, which is what makes the side-by-side honest.
 */

export const robotAccordion: MachineDef = accordion;
