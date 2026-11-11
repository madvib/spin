import type { ThemeDocument } from "./pipeline/types.ts";

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

