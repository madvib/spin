import { toggleGroup } from "./toggle-group.bindings.ts";
import type { ToggleGroupValueChange } from "./toggle-group.machine.ts";

/**
 * The toggle-group's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries the
 * selection on every toggle.
 */

export { toggleGroup };
export type { ToggleGroupValueChange };
