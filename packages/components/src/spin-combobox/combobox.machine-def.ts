import { combobox } from "./combobox.def.ts";
import type {
  ComboboxHighlightChange,
  ComboboxInputValueChange,
  ComboboxOpenChange,
  ComboboxSelect,
  ComboboxValueChange,
} from "./combobox.def.ts";

/**
 * The combobox's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` with the new keys and the items they resolve to,
 * `highlight-change` carries `onHighlightChange` with the row it names,
 * `input-value-change` carries `onInputValueChange` with the reason the text
 * moved, `open-change` carries `onOpenChange` with the panel's state and the
 * gesture's reason, and `select` carries `onSelect` with the value the pick
 * landed on.
 */

export { combobox };
export type {
  ComboboxHighlightChange,
  ComboboxInputValueChange,
  ComboboxOpenChange,
  ComboboxSelect,
  ComboboxValueChange,
};
