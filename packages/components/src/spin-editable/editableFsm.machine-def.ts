import type { MachineDef } from "@spin/runtime";
import { editable } from "./editable.fsm.ts";

/**
 * The forked-FSM editable's machine-def, consumed by `spin-editable-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. Always runs the fork — the Zag editable
 * stays the shipping path; this exists to prove a two-state machine with a
 * controlled edit channel, a commit/revert pair and a pure config survives
 * config-first authoring with the focus reflexes moved out to the view.
 */

export const editableFsm: MachineDef = editable;
