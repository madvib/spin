import type { MachineDef } from "@spin/runtime";
import { cascadeSelect } from "./cascade.fsm.ts";

/**
 * The forked-FSM cascade-select's machine-def, consumed by
 * `spin-cascade-select-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. This runs is the fork — the Zag
 * cascade-select remains the shipping path behind `spin-cascade-select.html`.
 */

export const cascadeFsm: MachineDef = cascadeSelect;
