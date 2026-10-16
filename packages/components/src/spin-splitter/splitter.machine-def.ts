import { splitter } from "./splitter.def.ts";
import type { SplitterResizeDetails } from "./splitter.def.ts";

/**
 * The splitter's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `resize` carries the percent
 * sizes on every move, `resize-end` on release and keyboard commits.
 */

export { splitter };
export type { SplitterResizeDetails };
