/** The type pages' shared facts: stacks, specimens, ramps, and face helpers. */

import { firstFamily } from "../../components/FamilyField.tsx";
import { activeMode, activeTree, themeText } from "../../lib/store.ts";
import { groupTokens, type TokenRow } from "../../lib/tokens.ts";
import { facesOf } from "../../lib/fonts.ts";

/** System fonts the picker offers when no webfont names the family. */
export const SYSTEM_STACKS: readonly { label: string; stack: string }[] = [
  { label: "System sans", stack: "ui-sans-serif, system-ui, sans-serif" },
  { label: "System serif", stack: "ui-serif, Georgia, Cambria, serif" },
  { label: "System mono", stack: "ui-monospace, SFMono-Regular, Menlo, monospace" },
];

/** The step's own name: the last segment of its path. */
export function stepName(path: string): string {
  return path.split(".").pop() ?? path;
}

/** Concise specimen phrases for each HTML element in the attachment table. */
export const ELEMENT_SPECIMENS: Record<string, string> = {
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  h5: "Heading 5",
  h6: "Heading 6",
  p: "Body paragraph copy",
  blockquote: "Quoted editorial passage",
  code: "const token = true",
  small: "Small caption label",
  strong: "Strong emphasis",
  a: "Interactive link",
  figcaption: "Figure caption",
};

/** The ramps this page edits: the scales named styles are built from. */
export const RAMPS: readonly { group: string; title: string; info: string }[] = [
  { group: "font.size", title: "Size", info: "Ramps — the scales styles are built from. The sizes named styles read at." },
  { group: "font.weight", title: "Weight", info: "The weights named styles read at." },
  { group: "font.tracking", title: "Tracking", info: "How far the letters sit from each other." },
  { group: "font.leading", title: "Leading", info: "How far the lines sit from each other." },
];

/** Every token under `font.family`: the faces the theme declares. */
export function familyRows(): readonly TokenRow[] {
  return groupTokens(activeTree(), [["font", "family"]], activeMode());
}

/** The face names the theme actually declares. */
export function declaredFaces(): readonly string[] {
  return familyRows().map((row) => row.path.split(".").pop()!);
}

/**
 * The families the theme loads.
 *
 * A name in a stack is not a family on the machine: the theme says which
 * families it loads under `$extensions.spin.fonts`, and a stack that names
 * one the theme does not load falls through to the next name in the stack.
 */
export function loadedFamilies(): readonly string[] {
  return facesOf(themeText()).map((face) => face.family);
}

/** Re-exported with the shared family field. */
export { firstFamily };
