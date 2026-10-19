import { pagination } from "./pagination.bindings.ts";
import type { PaginationPageChange, PaginationPageSizeChange } from "./pagination.machine.ts";

/**
 * The pagination's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `page-change` carries the page
 * and size on every move, `page-size-change` the size alone.
 */

export { pagination };
export type { PaginationPageChange, PaginationPageSizeChange };
