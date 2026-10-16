import { editable } from "./editable.def.ts";
import type { EditableEditChange, EditableValueChange } from "./editable.def.ts";

/**
 * The editable's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange`, `edit-change` carries `onEditChange`, `value-commit`
 * carries `onValueCommit` and `value-revert` carries `onValueRevert`. The
 * three interact-outside callbacks are functions rather than events: the
 * connect hands them the event object itself, so a host can veto the report
 * the way Zag's `preventDefault` does.
 */

export { editable };
export type { EditableEditChange, EditableValueChange };
