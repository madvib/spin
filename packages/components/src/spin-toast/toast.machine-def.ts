import { toast } from "./toast.def.ts";
import type { ToastStatusChange } from "./toast.def.ts";

/**
 * The toast's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * `status-change` carries `onStatusChange` with the toast's id, its status
 * and what caused it — the pair drives the exit motion for hosts that
 * build one.
 */

export { toast };
export type { ToastStatusChange };
