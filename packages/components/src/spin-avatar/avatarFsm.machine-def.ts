import type { MachineDef } from "@spin/runtime";
import { avatar } from "./avatar.fsm.ts";

/**
 * The forked-FSM avatar's machine-def, consumed by `spin-avatar-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. This runs the fork — the Zag avatar
 * remains the shipping path behind `spin-avatar.html` when a legacy
 * element is added.
 */

export const avatarFsm: MachineDef = avatar;
