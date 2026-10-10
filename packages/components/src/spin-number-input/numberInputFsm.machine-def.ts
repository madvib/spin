import type { MachineDef } from "@spin/runtime";
import { numberInput } from "./number-input.fsm.ts";
/**
 * The forked-FSM number-input's machine-def, consumed by
 * `spin-number-input-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. Always runs the fork — the Zag
 * number-input stays the shipping path; this exists to prove a gesture-driven
 * machine survives config-first authoring with the press-and-hold clock as a
 * reflex rather than as transitional states.
 */

export const numberInputFsm: MachineDef = numberInput;
