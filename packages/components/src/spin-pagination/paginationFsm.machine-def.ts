import type { MachineDef } from "@spin/runtime";
import { pagination } from "./pagination.fsm.ts";

/**
 * The forked-FSM pagination's machine-def, consumed by
 * `spin-pagination-fsm.html`.
 *
 * Same lookup pattern as the other ports: the consume name is the filename,
 * this file routes to the real def. Always runs the fork — the Zag pagination
 * stays the shipping path; this exists to show a machine whose entire state
 * is two scalars ported as config-first named pure assigns, with the page
 * range as derivation in the connect.
 */

export const paginationFsm: MachineDef = pagination;
