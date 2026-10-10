import type { MachineDef } from "@spin/runtime";
import { tags } from "./tags.fsm.ts";

/**
 * The forked-FSM tags-input's machine-def, consumed by
 * `spin-tags-input-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the
 * filename, this file routes to the real def. This runs the fork.
 */

export const tagsFsm: MachineDef = tags;
