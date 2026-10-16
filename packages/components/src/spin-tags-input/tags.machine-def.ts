import { tagsInput } from "./tags.def.ts";
import type {
  TagsApi,
  TagsCommands,
  TagsHighlightChange,
  TagsInputValueChange,
  TagsRow,
  TagsTranslations,
  TagsValueChange,
  TagsValueInvalid,
} from "./tags.def.ts";

/**
 * The tags-input's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange`, `input-value-change` carries `onInputValueChange`,
 * `highlight-change` carries `onHighlightChange` (a tag index here, where
 * Zag's is an element id), and `value-invalid` carries `onValueInvalid`
 * with the reason Zag's `ValidityState` names.
 */

export { tagsInput as tags };
export type {
  TagsApi,
  TagsCommands,
  TagsHighlightChange,
  TagsInputValueChange,
  TagsRow,
  TagsTranslations,
  TagsValueChange,
  TagsValueInvalid,
};
