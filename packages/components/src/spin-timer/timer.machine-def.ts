import { timer } from "./timer.bindings.ts";
import type { TimerTickChange } from "./timer.bindings.ts";

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
