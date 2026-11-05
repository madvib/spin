/**
 * Starter inheritance: sparse documents over shipped starters.
 *
 * A project theme is a layer, not a copy: `{ "$extends": "silk" }` plus the
 * tokens the project owns. The starter stays shipped, the document stays
 * small, and a starter fix reaches every theme that layers over it.
 *
 * This module is a leaf on purpose: the parser needs expansion and the
 * resolver re-exports it, while the starter registry must not learn what a
 * document is. So this imports only the document type and the registry —
 * and touches the registry lazily, never at module evaluation, because the
 * contract reads the parser back and the cycle must stay deferred.
 */

import { starterThemes } from "./themes/index.ts";
import type { ThemeDocument } from "./pipeline/types.ts";

/** True for the JSON objects a merge recurses into. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Layer one document over another, without mutating either.
 *
 * Token groups recurse so a sparse override keeps the starter's siblings;
 * a leaf (anything carrying `$value`) replaces so an override is total;
 * `$extensions` merges so a theme keeps the starter's fonts while adding its
 * own; `modes` replaces because the served modes are one decision.
 * `$extends` itself is skipped — expansion strips it, and a plain merge
 * never carries it forward.
 */
export function mergeThemeDocuments(
  base: ThemeDocument,
  override: ThemeDocument,
): ThemeDocument {
  const out: Record<string, unknown> = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (key === "$extends") continue;
    const current = out[key];
    if (
      key === "$extensions" && isPlainObject(current) && isPlainObject(value)
    ) {
      out[key] = mergeThemeDocuments(
        current as ThemeDocument,
        value as ThemeDocument,
      );
    } else if (
      isPlainObject(current) &&
      isPlainObject(value) &&
      !Object.hasOwn(value, "$value")
    ) {
      out[key] = mergeThemeDocuments(
        current as ThemeDocument,
        value as ThemeDocument,
      );
    } else {
      out[key] = structuredClone(value);
    }
  }
  return out;
}

/**
 * Resolve `"$extends": "<starter>"` to the full document it names.
 *
 * A document without a string `$extends` is returned as written. A document
 * naming a starter is deep-merged over a clone of that starter, and the
 * `$extends` key is stripped from the output so downstream stages read a
 * plain document. An unknown starter throws, because a layer over nothing
 * is a theme that cannot build.
 */
export function expandExtends(
  doc: ThemeDocument,
  builtins: Readonly<Record<string, ThemeDocument>> = starterThemes,
): ThemeDocument {
  const name = doc["$extends"];
  if (typeof name !== "string") return doc;
  const base = builtins[name];
  if (base === undefined) {
    throw new Error(
      `unknown starter "${name}" in $extends — expected one of ${
        Object.keys(builtins).join(", ")
      }`,
    );
  }
  return mergeThemeDocuments(base, doc);
}
