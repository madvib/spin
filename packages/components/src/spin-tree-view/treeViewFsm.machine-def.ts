import type { MachineDef } from "@spin/runtime";
import { treeView } from "./tree-view.fsm.ts";

/**
 * The forked-FSM tree-view's machine-def, consumed by
 * `spin-tree-view-fsm.html`.
 *
 * Same lookup pattern as the accordion experiments: the consume name is the
 * filename, this file routes to the real def. Always runs the fork — the
 * Zag tree-view remains the shipping path; this exists to prove the
 * hard case (per-node state, ~30 events, keyboard navigation) survives
 * config-first authoring with the machine holding only state.
 */

export const treeViewFsm: MachineDef = treeView;
