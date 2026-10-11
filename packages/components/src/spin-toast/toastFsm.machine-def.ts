import type { MachineDef } from "@spin/runtime";
import { toast } from "./toast.fsm.ts";

/**
 * The forked-FSM toast's machine-def, consumed by `spin-toast-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. Always runs the fork — the Zag toast
 * stays the shipping path; this exists to prove the one Zag component whose
 * state is mostly its own store survives config-first authoring with the
 * queue in context, the per-toast lifecycle as a status on each entry, and
 * every clock as an action.
 */

export const toastFsm: MachineDef = toast;
