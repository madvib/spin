import type { MachineDef } from "@spin/runtime";
import { dialog } from "./dialog.fsm.ts";

/**
 * The forked-FSM dialog's machine-def, consumed by `spin-dialog-fsm.html`.
 *
 * The reflexes Zag keeps as machine-internal effects (focus trap,
 * dismissable, scroll lock) are stdlib actions here, attached through the
 * content bag. The machine is open/closed plus four events — states, not
 * reflexes.
 */

export const dialogFsm: MachineDef = dialog;
