import type { MachineDef } from "@spin/runtime";
import { asyncList } from "./async-list.fsm.ts";

/**
 * The forked-FSM async-list's machine-def, consumed by
 * `spin-async-list-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. Always runs the fork — the Zag async-list
 * stays the shipping path; this exists to prove an async state machine
 * survives config-first authoring with the fetch, the sort and the abort as
 * bridge-owned reflexes rather than machine refs and entry actions.
 */

export const asyncListFsm: MachineDef = asyncList;
