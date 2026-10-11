import type { MachineDef } from "@spin/runtime";
import { scrollArea } from "./scroll-area.fsm.ts";

/**
 * The forked-FSM scroll-area's machine-def, consumed by
 * `spin-scroll-area-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. Always runs the fork — the Zag scroll-area
 * stays the shipping path; this exists to prove the one component whose state
 * is entirely derived from layout survives the port: the measuring lives in
 * the view, the readings travel as event payloads, and the machine holds
 * them and decides what a new one means.
 */

export const scrollAreaFsm: MachineDef = scrollArea;
