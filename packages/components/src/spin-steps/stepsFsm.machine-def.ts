import type { MachineDef } from "@spin/runtime";
import { steps } from "./steps.fsm.ts";

/**
 * The forked-FSM steps machine-def, consumed by `spin-steps-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. Always runs the fork — the Zag steps
 * stays the shipping path; this exists to prove a single-state Zag machine
 * whose guards read host predicates survives config-first authoring with the
 * guards as named conds and the refusals reported through context.
 */

export const stepsFsm: MachineDef = steps;
