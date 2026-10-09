import type { MachineDef } from "@spin/runtime";
import { tabs } from "./tabs.fsm.ts";

/** The forked-FSM tabs' seam file, consumed by `spin-tabs-fsm.html`. */
export const tabsFsm: MachineDef = tabs;
