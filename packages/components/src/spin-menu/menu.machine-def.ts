import { menu } from "./menu.bindings.ts";
import type {
  MenuHighlightChange,
  MenuOpenChange,
  MenuSelect,
} from "./menu.machine.ts";

/**
 * The menu's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `open-change` carries
 * `onOpenChange`, `select` carries `onSelect` with the clicked item's
 * value, and `highlight-change` carries `onHighlightChange`, which fires
 * whenever the highlighted item moves.
 */

export { menu };
export type { MenuHighlightChange, MenuOpenChange, MenuSelect };
