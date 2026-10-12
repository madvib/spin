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
    const { css } = await uno.generate(catalogUtilities(describeCatalog(tree)));
    return { css, error: null };
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
