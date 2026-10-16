import { navigationMenu } from "./navigation-menu.def.ts";
import type { NavigationMenuValueChange } from "./navigation-menu.machine.ts";

/**
 * The navigation-menu's seam: the synthesized bridge, the element's
 * imperative commands, and the CustomEvents the host reads.
 *
 * `value-change` carries `onValueChange` with the open item and the one
 * it came from — the pair drives the viewport slide for hosts that
 * build one.
 */

export { navigationMenu };
export type { NavigationMenuValueChange };
