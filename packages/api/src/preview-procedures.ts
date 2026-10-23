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
import {
  claimedElements,
  describeCatalog,
  primitiveVariants,
  spinPreset,
} from "@spin/preset";
import type { ThemeDocument } from "@spin/theme";
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
 * The primitives' vocabulary, as text the scanner can read.
 *
 * The preview pane is authored in the same vocabulary it previews — its own
 * controls are the active theme's controls — so the sheet must carry those
 * rules whether or not the route's markup happened to mention them. Generated
 * from markup alone the sheet changed with the page: the overview's "new
 * theme" button rested on the project's theme and hovered on the studio's,
 * because no sample on that page spelled `button`. Tags arrive as markup and
 * variants as classes, because the element and variant extractors read those
 * forms and a bare word would reach neither.
 */
function primitiveVocabulary(): string {
  return [
    ...[...claimedElements()].map((tag) => `<${tag}></${tag}>`),
    ...[...primitiveVariants()].map((variant) => `class="${variant}"`),
  ].join(" ");
}

/**
 * The selector the preview's utilities are scoped under. The studio marks
 * its preview host with it, so the injected sheet styles the pane and never
 * the chrome around it. :where() keeps the scope at zero specificity, so the
 * studio's own sheet wins every tie on chrome the preview also names.
 */
const PREVIEW_SCOPE = ":where(.spin-preview)";

/** Braces opened minus closed, for stepping over a block. */
function braceDelta(text: string): number {
  let delta = 0;
  for (const ch of text) {
    if (ch === "{") delta += 1;
    else if (ch === "}") delta -= 1;
  }
  return delta;
}

/**
 * The selectors in a selector list, split on its own commas.
 *
 * A `,` inside `:is(…)` or an attribute value separates nothing — the button
 * rule's own selector is a list inside `:is()` — so the split tracks depth
 * and quotes rather than calling `String.split`.
 */
function splitSelectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < list.length; i += 1) {
    const ch = list[i] as string;
    if (quote !== "") {
      if (ch === quote && list[i - 1] !== "\\") quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    else if (ch === "," && depth === 0) {
      out.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(list.slice(start).trim());
  return out.filter((selector) => selector !== "");
}

/**
 * Scope every rule under the preview host.
 *
 * A line pass, not a CSS parser. The generator's own rules come minified, one
 * body per line with the selector list in front of it — a list may run over
 * several lines, each ending in its comma — while the authored preflights
 * come pretty-printed, the selector ending in `{` and the declarations under
 * it. So a line is a selector line when it contains `{` or ends with `,`, and
 * every selector in it takes the scope.
 *
 * At-rules pass untouched, with their inner rules scoped on their own lines;
 * keyframe steps are stepped over (a `50%,` is not a selector); comments pass
 * whole; and theme variable blocks (`:root`, `[data-theme]`) keep their own
 * selectors — variables are read through the cascade, not matched as
 * utilities. Elements are scoped like utilities: a preview rule that styles
 * `button` may not restyle the tool around the pane.
 */
function scopePreview(css: string): string {
  const out: string[] = [];
  let keyframes = 0;
  let comment = false;
  for (const line of css.split("\n")) {
    const text = line.trimStart();
    const indent = line.slice(0, line.length - text.length);
    if (comment) {
      out.push(line);
      if (text.includes("*/")) comment = false;
      continue;
    }
    if (text.startsWith("/*")) {
      comment = !text.includes("*/");
      out.push(line);
      continue;
    }
    if (keyframes > 0 || text.startsWith("@keyframes")) {
      keyframes = Math.max(0, keyframes + braceDelta(text));
      out.push(line);
      continue;
    }
    if (
      text.startsWith("@") || text.startsWith(":root") ||
      text.startsWith("[data-theme")
    ) {
      out.push(line);
      continue;
    }
    if (text.endsWith(",") || text.includes("{")) {
      const cut = text.endsWith(",") ? text.length - 1 : text.indexOf("{");
      const selectors = splitSelectors(text.slice(0, cut));
      if (selectors.length > 0) {
        const scoped = selectors.map((selector) =>
          `${PREVIEW_SCOPE} ${selector}`
        ).join(", ");
        out.push(`${indent}${scoped}${text.slice(cut)}`);
        continue;
      }
    }
    out.push(line);
  }
  return out.join("\n");
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
    // The markup first, so its tokens emit the primitive rules it spells;
    // the primitives' vocabulary after it, so the pane's own controls have
    // the active theme's rules whichever route is mounted; the catalog's
    // utilities last, as the backstop for every utility the explorer can
    // name, which markup alone would not reach.
    const scanned = uno.generate(
      `${input.markup ?? ""} ${primitiveVocabulary()} ${
        catalogUtilities(describeCatalog(tree))
      }`,
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
