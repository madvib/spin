import type { MachineDef } from "@spin/runtime";
import { pinInput } from "./pin-input.fsm.ts";

/**
 * The forked-FSM pin-input's machine-def, consumed by
 * `spin-pin-input-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. Always runs the fork — the Zag
 * pin-input stays the port source; this exists to prove a two-state Zag
 * machine with a long assign table (filling, focused-index arithmetic, the
 * paste distribution) survives config-first authoring with the DOM
 * reflexes moved to the view.
 */

export const pinInputFsm: MachineDef = pinInput;
