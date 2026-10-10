import type { MachineDef } from "@spin/runtime";
import { timer } from "./timer.fsm.ts";

/**
 * The forked-FSM timer's machine-def, consumed by `spin-timer-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. Always runs the fork — the Zag timer
 * stays the shipping path; this exists to prove a clock survives config-first
 * authoring with the interval as a stdlib action and the tick's arithmetic
 * as named pure assigns.
 */

export const timerFsm: MachineDef = timer;
