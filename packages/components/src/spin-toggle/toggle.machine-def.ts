import { toggle } from "./toggle.def.ts";
import type { TogglePressedChange } from "./toggle.machine.ts";

/**
 * The toggle's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `pressed-change` carries the
 * pressed bit on every toggle.
 */

export { toggle };
export type { TogglePressedChange };
export type ToggleValueChange = TogglePressedChange;
