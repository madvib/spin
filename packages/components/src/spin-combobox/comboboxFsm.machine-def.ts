import type { MachineDef } from "@spin/runtime";
import { combobox } from "./combobox.fsm.ts";

/**
 * The forked-FSM combobox's machine-def, consumed by `spin-combobox-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. Always runs the fork — the Zag combobox
 * stays the shipping path; this exists to prove the hardest machine in the
 * corpus survives config-first authoring: four phases as flat states, Zag's
 * `open` parent folded into the fork's root tier with the two closed states
 * shadowing the entries they do not inherit, the inline completion modelled
 * as context rather than as a DOM write, and the keyboard map in the view
 * where the collection lives.
 */

export const comboboxFsm: MachineDef = combobox;
