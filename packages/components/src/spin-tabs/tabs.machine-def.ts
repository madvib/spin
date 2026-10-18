import { tabs } from "./tabs.def.ts";
import type { TabsValueChange } from "./tabs.machine.ts";

/**
 * The tabs seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Selection is component state (the platform owns no tab selection),
 * so this is a machine behind the same bag names the controller used.
 */

export { tabs };
export type { TabsValueChange };
