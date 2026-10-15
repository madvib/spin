/**
 * @spin/api — the studio's own surface: the stylesheet it previews with.
 *
 * The preview needs TWO things no single contract provides: a theme's
 * variables, and the utility declarations the demos in the preview actually
 * use. A theme on its own is variables; a preset on its own is rules that
 * reference variables that may not exist. Only the thing that knows a project
 * can produce both — and that is the daemon, not either package.
 *
 * This is also the last direct import the studio makes of the domain. The
 * browser was shipping @unocss/core plus the whole preset in order to
 * generate a stylesheet, which is work a server does in milliseconds and a
 * client should not do at all.
 */

import { oc } from "@orpc/contract";
import { implement } from "@orpc/server";
import * as v from "valibot";
import { parseTokens } from "@spin/theme";
import { describeCatalog, spinPreset } from "@spin/preset";
import type { ThemeDocument, TokenTree } from "@spin/theme";
import { createGenerator } from "@unocss/core";

const PreviewInput = v.object({
  /** The theme document, as authored. */
  text: v.string(),
  /** The name the preview scopes its `[data-theme]` selector to. */
  name: v.string(),
  /**
   * The markup the preview is about to render.
   *
   * Uno scans source text for tokens, which is how a real application gets
   * its CSS — and a preview that passes only a list of utility names emits
   * utilities and nothing else, so every primitive renders unstyled. Passing
   * the markup makes the preview honest: the same scanner, the same rules,
   * the same result a consumer gets.
   */
  markup: v.optional(v.string()),
});

const PreviewOutput = v.object({
  /** The stylesheet, or empty when the theme does not build. */
  css: v.string(),
  /** Why it does not build, when it does not. */
  error: v.nullable(v.string()),
});

/**
 * The stylesheet for one theme document.
 *
 * Failure is data, not an exception: the preset refuses a theme that breaks a
 * legibility floor, which is right for a build and wrong for a preview. The
 * studio shows the reason next to the theme that produced it, and the last
 * good stylesheet stays in place — an author mid-edit should never lose the
 * page they are working on.
 */
export const previewCss = oc
  .input(PreviewInput)
  .output(PreviewOutput)
  .route({
    method: "POST",
    path: "/preview/css",
    summary: "Generate the stylesheet a studio previews with",
  });

export const previewContract = { preview: { css: previewCss } };

/** Every utility the catalog names, as one selector string. */
function catalogUtilities(sections: readonly { utilities: string[] }[]) {
  return sections.flatMap((section) => section.utilities).join(" ");
}
/**
 * The selector the preview's utilities are scoped under. The studio marks
 * its preview host with it, so the injected sheet styles specimens and
 * never the chrome around them. :where() keeps the scope at zero
 * specificity, so the studio's own sheet wins every tie on chrome the
 * preview also names.
 */
const PREVIEW_SCOPE = ":where(.spin-preview)";

/**
 * Scope every utility rule under the preview host.
 *
 * A line pass, not a CSS parser: the generator emits one rule per line in
 * minified form, and at-rules (`@media`) pass through untouched with their
 * inner rules scoped on their own lines. Theme variable blocks (`:root`,
 * `[data-theme]`) keep their own selectors — variables are read through
 * the cascade, not matched as utilities.
 */
function scopePreview(css: string): string {
  return css
    .split("\n")
    .map((line) => {
      const text = line.trimStart();
      if (!text.startsWith(".")) return line;
      const indent = line.slice(0, line.length - text.length);
      return `${indent}${PREVIEW_SCOPE} ${text}`;
    })
    .join("\n");
}

/**
 * The generator itself, as a function so the daemon mounts it and a test can
 * call it without a transport.
 */
export async function generatePreview(
  input: v.InferInput<typeof PreviewInput>,
): Promise<v.InferOutput<typeof PreviewOutput>> {
  const parsed = parseTokens(input.text);
  if (!parsed.ok) return { css: "", error: `does not parse: ${parsed.error}` };
  const tree = parsed.tree;
  try {
    const document = JSON.parse(input.text) as ThemeDocument;
    const uno = await createGenerator({
      presets: [spinPreset({ themes: { [input.name]: document } })],
    });
    // The markup first, so its tokens emit the primitive rules and the
    // utilities they reference; the catalog's utilities backstop every
    // utility the explorer can name, which markup alone would not reach.
    const scanned = uno.generate(
      `${input.markup ?? ""} ${catalogUtilities(describeCatalog(tree))}`,
    );
    const { css } = await scanned;
    // The sheet is injected into the studio's own document, so every
    // utility rule is scoped under the preview host: an unscoped preview
    // re-declares utilities the chrome also uses, and the later duplicate
    // wins by order. Theme variables keep their own data-theme scope.
    return { css: scopePreview(css), error: null };
  } catch (err) {
    return { css: "", error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * The router, mounted by the daemon.
 *
 * Its own `implement` because it composes nothing else: a preview is one
 * procedure and it belongs to the studio's surface, not to the theme's.
 */
export const previewRouter = implement(previewContract).router({
  preview: {
    css: implement(previewContract).preview.css.handler(
      async ({ input }) => await generatePreview(input),
    ),
  },
});
