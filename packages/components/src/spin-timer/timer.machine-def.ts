import { timer } from "./timer.def.ts";
import type { TimerTickChange } from "./timer.def.ts";

/**
 * The timer's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `tick` carries `onTick` with
 * the new count and its parts, `complete` carries `onComplete` once the
 * run reaches its target.
 */

export { timer };
export type { TimerTickChange };
