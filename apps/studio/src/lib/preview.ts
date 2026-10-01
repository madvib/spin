/**
 * Preview stylesheet generation.
 *
 * The preview is scoped to the theme it is previewing, which means the theme
 * name is part of the CSS it produces: `spinPreset({themes: {[name]: tree}})`
 * emits `[data-theme="name"] { --color-primary: … }`, and the preview surface
 * carries that same `data-theme`. Passing the document rather than the parsed
 * tree is what lets `$extensions.spin.fonts` reach the preview — a parsed tree
 * keeps tokens and drops extensions, so a previewed font would silently not
 * load.
 */

import { createGenerator } from "@unocss/core";
import { describeCatalog, spinPreset } from "@spin/preset";
import type { ThemeDocument } from "@spin/preset";
import type { TokenTree } from "@spin/theme";
import { treeToJson } from "@spin/theme";

/** The theme document the preset consumes, with a stable name. */
function documentOf(
  name: string,
  tree: TokenTree,
): Record<string, ThemeDocument> {
  return {
    [name]: JSON.parse(treeToJson(tree)) as ThemeDocument,
  };
}

/** Generates the theme variables plus every utility the catalog can produce. */
export async function previewCss(
  tree: TokenTree,
  name: string,
): Promise<string> {
  const utilities = describeCatalog(tree).flatMap((s) => s.utilities);
  const uno = await createGenerator({
    presets: [
      spinPreset({ themes: documentOf(name, tree) }),
    ],
  });
  const { css } = await uno.generate(utilities.join(" "));
  return css;
}

/** Generates only the named utilities, for a section preview. */
export async function previewSection(
  tree: TokenTree,
  name: string,
  utilities: string[],
): Promise<string> {
  const uno = await createGenerator({
    presets: [
      spinPreset({ themes: documentOf(name, tree) }),
    ],
  });
  const { css } = await uno.generate(utilities.join(" "));
  return css;
}

export function cssDeclarations(
  css: string,
  utilities: string[],
): Map<string, string> {
  const bodies = new Map<string, string>();
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim();
    const body = match[2].trim().replace(/\s+/g, " ");
    const name = selector
      .split(",")[0]
      .trim()
      .replace(/^\./, "")
      .replace(/\\(.)/g, "$1");
    if (!bodies.has(name)) bodies.set(name, body);
  }
  const out = new Map<string, string>();
  for (const utility of utilities) {
    const body = bodies.get(utility);
    if (body !== undefined) out.set(utility, body);
  }
  return out;
}
