import { select } from "./select.bindings.ts";
import type {
  SelectHighlightChange,
  SelectOpenChange,
  SelectSelect,
  SelectValueChange,
} from "./select.bindings.ts";

/**
 * The select's seam: the synthesized bridge, the element's imperative
 * commands, and the CustomEvents the host reads.
 */

export { select };
export type {
  SelectHighlightChange,
  SelectOpenChange,
  SelectSelect,
  SelectValueChange,
};
