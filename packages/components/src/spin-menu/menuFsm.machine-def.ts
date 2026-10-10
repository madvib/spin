import type { MachineDef } from "@spin/runtime";
import { menu } from "./menu.fsm.ts";

/**
 * The forked-FSM menu's machine-def, consumed by `spin-menu-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. This runs is the fork — the Zag menu
 * remains the shipping path behind `spin-menu.html`.
 */

export const menuFsm: MachineDef = menu;
