/**
 * The component library's root export.
 *
 * Elements register through `elements.ts` (one import defines them all).
 * Machine-defs are the per-element seam files, exported here as the catalog:
 * each def is a component's public machine contract, and it is small — a
 * bridge factory, the commands, and the event map.
 *
 * The catalog is deliberately short: a machine earns its place only when the
 * component has distinct MODES with different legal events. Widgets whose
 * entire behavior is one mode of derived values — scroll geometry, image
 * load status, a continuous slider value, a page index — are signals and
 * actions, not machines, and the preset's primitives already own the
 * form-control widgets.
 */

export { asyncList } from "./spin-async-list/async-list.machine-def.ts";
export { carousel } from "./spin-carousel/carousel.machine-def.ts";
export { cascade } from "./spin-cascade-select/cascade.machine-def.ts";
export { combobox } from "./spin-combobox/combobox.machine-def.ts";
export { dialog } from "./spin-dialog/dialog.machine-def.ts";
export { editable } from "./spin-editable/editable.machine-def.ts";
export { menu } from "./spin-menu/menu.machine-def.ts";
export { numberInput } from "./spin-number-input/number-input.machine-def.ts";
export { pinInput } from "./spin-pin-input/pin-input.machine-def.ts";
export { popover } from "./spin-popover/popover.controller-def.ts";
export { select } from "./spin-select/select.machine-def.ts";
export { tags } from "./spin-tags-input/tags.machine-def.ts";
export { timer } from "./spin-timer/timer.machine-def.ts";
export { toast } from "./spin-toast/toast.machine-def.ts";
export { treeView } from "./spin-tree-view/tree-view.machine-def.ts";
