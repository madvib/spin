import type { MachineDef } from "@spin/runtime";
import { rating } from "./rating.fsm.ts";

/**
 * The forked-FSM rating group's machine-def, consumed by
 * `spin-rating-group-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. This runs is the fork — the Zag
 * rating-group remains the port source.
 */

export const ratingFsm: MachineDef = rating;
