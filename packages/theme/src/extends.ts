/**
 * Language inheritance: sparse documents over shipped languages.
 *
 * A project theme is a layer, not a copy: `{ "$extends": "minimal" }` plus the
 * tokens the project owns. The language stays shipped, the document stays
 * small, and a language fix reaches every theme that layers over it.
 *
 * This module is a leaf on purpose: the parser needs expansion and the
 * resolver re-exports it, while the language registry must not learn what a
 * document is. So this imports only the document type and the registry —
 * and touches the registry lazily, never at module evaluation, because the
 * contract reads the parser back and the cycle must stay deferred.
 */

import type { ThemeDocument } from "./pipeline/types.ts";
import { baseDocument } from "./base-document.ts";
import { mergeThemeDocuments } from "./merge.ts";
import { designLanguages } from "./languages/index.ts";

export { mergeThemeDocuments } from "./merge.ts";

/**
 * Resolve `"$extends"` to the full document it names, following the chain.
 *
  * A document without a string `$extends` is returned as written. A document
  * naming a language — or the `base` foundation a language itself names — is
  * deep-merged over a clone of that document, and expansion repeats until no
  * `$extends` remains, so a project over a language over the base reads as one
 * document. The `$extends` key is stripped from the output so downstream
 * stages read a plain document. An unknown name throws, because a layer over
 * nothing is a theme that cannot build; a chain that never ends is a cycle,
 * and it throws rather than looping.
 */
export function expandExtends(
  doc: ThemeDocument,
  builtins: Readonly<Record<string, ThemeDocument>> = {
    ...designLanguages,
    base: baseDocument,
  },
): ThemeDocument {
  let current = doc;
  for (let depth = 0; depth < 10; depth++) {
    const name = current["$extends"];
    if (typeof name !== "string") return current;
    const base = builtins[name];
    if (base === undefined) {
      throw new Error(
        `unknown design language "${name}" in $extends — expected one of ${
          Object.keys(builtins).join(", ")
        }`,
      );
    }
    current = mergeThemeDocuments(base, current);
  }
  throw new Error(
    `"$extends" chain never ends — expected a document, found a cycle`,
  );
}
