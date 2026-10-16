import { listbox } from "./listbox.def.ts";
import type {
  ListboxHighlightChange,
  ListboxSelect,
  ListboxValueChange,
} from "./listbox.def.ts";

/**
 * The listbox's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` with the new keys and the items they resolve to,
 * `highlight-change` carries `onHighlightChange` with the row it names, and
 * `select` carries `onSelect` with the value the pick landed on.
 */

export { listbox };
export type {
  ListboxHighlightChange,
  ListboxSelect,
  ListboxValueChange,
};
