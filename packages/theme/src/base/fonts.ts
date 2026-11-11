/**
 * Font loading — the one thing a theme declares that is not a token.
 *
 * `font.family.sans` names a family; naming is not loading. The source has to
 * live in the same document as the name, or the two drift and a theme renders
 * in a family it never asked for. It is an extension rather than a token
 * because a `src` is a URL or a bundled file, not a design value.
 */

import * as v from "valibot";
import type { ValidationIssue } from "../pipeline/types.ts";

const Font = v.object({
  family: v.pipe(v.string(), v.nonEmpty("a font needs a family name")),
  src: v.pipe(v.string(), v.nonEmpty("a font needs a source")),
  weight: v.optional(v.string()),
  style: v.optional(v.string()),
  display: v.optional(
    v.picklist(["auto", "block", "swap", "fallback", "optional"]),
  ),
});

export type FontDeclaration = v.InferOutput<typeof Font>;

export interface FontResult {
  /** Declarations that parsed, in document order. */
  fonts: FontDeclaration[];
  /** One issue per declaration that did not, naming its index. */
  issues: ValidationIssue[];
}

/** The declared fonts, plus what was wrong with the ones that were not. */
export function readFonts(doc: Record<string, unknown>): FontResult {
  const fonts = doc["$extensions"] as
    | Record<string, Record<string, unknown> | undefined>
    | undefined;
  const declared = fonts?.["spin"]?.["fonts"];
  if (!Array.isArray(declared)) return { fonts: [], issues: [] };

  const result: FontResult = { fonts: [], issues: [] };
  for (const [index, entry] of declared.entries()) {
    const parsed = v.safeParse(Font, entry);
    if (parsed.success) {
      result.fonts.push(parsed.output);
      continue;
    }
    // A malformed declaration is reported rather than dropped: a font the
    // studio silently ignores is a font the author never learns is missing.
    for (const issue of parsed.issues) {
      const key = issue.path?.map((segment) =>
        typeof segment === "object" && segment !== null
          ? segment.key
          : segment
      ).join(".") ?? "";
      result.issues.push({
        path: `$extensions.spin.fonts[${index}]${key ? `.${key}` : ""}`,
        message: issue.message,
      });
    }
  }
  return result;
}

/** One `@font-face` block per distinct family, in declaration order. */
export function fontFaces(result: FontResult): string {
  const seen = new Set<string>();
  const blocks: string[] = [];
  for (const font of result.fonts) {
    if (seen.has(font.family)) continue;
    seen.add(font.family);
    blocks.push([
      "@font-face {",
      `  font-family: "${font.family}";`,
      `  src: ${font.src};`,
      ...(font.weight !== undefined ? [`  font-weight: ${font.weight};`] : []),
      ...(font.style !== undefined ? [`  font-style: ${font.style};`] : []),
      ...(font.display !== undefined
        ? [`  font-display: ${font.display};`]
        : []),
      "}",
    ].join("\n"));
  }
  return blocks.join("\n\n");
}
