import type { MachineDef } from "@spin/runtime";
import { createTagsBridge } from "./tags.bridge.ts";
import type {
  TagsCommands,
  TagsHighlightChange,
  TagsInputValueChange,
  TagsValueChange,
  TagsValueInvalid,
} from "./tags.bridge.ts";

/**
 * The tags-input's seam: the bridge, the element's imperative commands and
 * the CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge`
 * routes straight to the fork, which is what makes this interpreter a
 * drop-in behind the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange`, `input-value-change` carries `onInputValueChange`,
 * `highlight-change` carries `onHighlightChange` (a tag index here, where
 * Zag's is an element id), and `value-invalid` carries `onValueInvalid`
 * with the reason Zag's `ValidityState` names.
 */

export type { TagsCommands, TagsHighlightChange, TagsInputValueChange, TagsValueChange, TagsValueInvalid };

export const tags: MachineDef = {
  createBridge: createTagsBridge,
  commands: [
    "setValue",
    "addValue",
    "setValueAtIndex",
    "clearValue",
    "setInputValue",
    "clearInputValue",
    "focus",
  ],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: TagsValueChange) => ({ value: change.value }),
    },
    "input-value-change": {
      on: "onInputValueChange",
      detail: (change: TagsInputValueChange) => ({ inputValue: change.inputValue }),
    },
    "highlight-change": {
      on: "onHighlightChange",
      detail: (change: TagsHighlightChange) => ({ highlightedValue: change.highlightedValue }),
    },
    "value-invalid": {
      on: "onValueInvalid",
      detail: (change: TagsValueInvalid) => ({ reason: change.reason }),
    },
  },
};
