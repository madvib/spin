import type { MachineDef } from "@spin/runtime";
import { createEditableBridge } from "./editable.bridge.ts";
import type { EditableEditChange, EditableValueChange } from "./editable.bridge.ts";
/**
 * The editable's seam: the bridge, the element's imperative commands and the
 * CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge` routes
 * straight to the fork, which is what makes this interpreter a drop-in behind
 * the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange`, `edit-change` carries `onEditChange`, `value-commit`
 * carries `onValueCommit` and `value-revert` carries `onValueRevert`. The
 * three interact-outside callbacks are functions rather than events: the
 * connect hands them the event object itself, so a host can veto the report
 * the way Zag's `preventDefault` does.
 */

export type { EditableEditChange, EditableValueChange };

export const editable: MachineDef = {
  createBridge: createEditableBridge,
  commands: ["setValue", "clearValue", "edit", "cancel", "submit"],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: EditableValueChange) => ({ value: change.value }),
    },
    "edit-change": {
      on: "onEditChange",
      detail: (change: EditableEditChange) => ({ edit: change.edit }),
    },
    "value-commit": {
      on: "onValueCommit",
      detail: (change: EditableValueChange) => ({ value: change.value }),
    },
    "value-revert": {
      on: "onValueRevert",
      detail: (change: EditableValueChange) => ({ value: change.value }),
    },
  },
};
