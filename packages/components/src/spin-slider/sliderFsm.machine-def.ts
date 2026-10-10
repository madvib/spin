import type { MachineDef } from "@spin/runtime";
import { slider } from "./slider.fsm.ts";

/**
 * The forked-FSM slider's machine-def, consumed by
 * `spin-slider-fsm.html`.
 *
 * Same lookup pattern as tree-view: the consume name is the filename, this
 * file routes to the real def. Always runs the fork — the Zag slider
 * remains the shipping path; this exists to prove the continuous case
 * (pointer drag, step arithmetic, geometry as data) survives config-first
 * authoring with the machine holding only value and state.
 */

export const sliderFsm: MachineDef = slider;
