import type { MachineDef } from "@spin/runtime";
import { listbox } from "./listbox.fsm.ts";

/**
 * The forked-FSM listbox's machine-def, consumed by `spin-listbox-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. Always runs the fork — the Zag listbox
 * stays the shipping path; this exists to prove a single-state Zag machine
 * (whose events are all root-level) survives config-first authoring with the
 * selection arithmetic as named pure assigns and the keyboard map in the
 * view, where the collection lives.
 */

export const listboxFsm: MachineDef = listbox;
