import { cascade } from "./cascade.def.ts";
import type {
  CascadeHighlightChange,
  CascadeOpenChange,
  CascadeValueChange,
} from "./cascade.def.ts";

/**
 * The cascade-select's seam: the synthesized bridge, the element's
 * imperative commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `open-change` carries
 * `onOpenChange` (with the value, as select does), `value-change` carries
 * `onValueChange` with the paths and the item chains along them,
 * `highlight-change` carries `onHighlightChange`, and the three outside
 * callbacks the dismissable reflex reports (`pointer-down-outside`,
 * `focus-outside`, `interact-outside`) map to `onPointerDownOutside`,
 * `onFocusOutside` and `onInteractOutside`.
 */

export { cascade };
export type { CascadeHighlightChange, CascadeOpenChange, CascadeValueChange };
