import { createGenerator } from "@unocss/core";
import { spinPreset } from "@spin/preset";
import { parseTokens } from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";


/**
 * The showcase — every tag, one route each.
 *
 *     deno task serve
 *
 * Organized by tag rather than by component, because a tag is what a consumer
 * writes and therefore what is worth demonstrating. A page per component would
 * put a switch beside a checkbox because they are both form controls, which is
 * a grouping nobody asked for.
 *
 * Each example carries the markup a consumer would actually write — no
 * test-only wrappers — and the page reports what the whole fixture costs on
 * its own, measured against a generator carrying only that tag. The number is
 * the point: it says whether the primitive is a handful of declarations or a
 * preflight pretending to be one.
 */
// EVERY starter goes to the preset. The rail listed `console` while the
// preset was handed two names, so console rendered with no variables at all —
// and the two lists were hand-written, so nothing noticed.
export const ALL_THEMES = starterThemes;

/**
 * The catalog is derived from a THEME, so it needs one parsed — and it must be
 * the TREE, because that is what `describeCatalog` walks.
 *
 * Parsed once: the catalog is asked for on every utilities request and a
 * parse is not free.
 */
let themeTree: TokenTree | undefined;
export function themeTreeOrParse(): TokenTree {
  if (themeTree === undefined) {
    const parsed = parseTokens(ALL_THEMES.default);
    if (!parsed.ok) throw new Error(parsed.error);
    themeTree = parsed.tree;
  }
  return themeTree;
}

/** A label and a declaration are both authored text. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const bytes = (s: string) => Buffer.byteLength(s);

/**
 * What one fixture costs alone.
 *
 * Against a generator carrying only that tag, so the figure is the primitive
 * and not the other seven that have not been migrated to rules yet.
 */
export async function cost(root: string, markup: string) {
  const own = await createGenerator({
    presets: [spinPreset({ themes: ALL_THEMES, primitives: [root] })],
  });
  const empty = await createGenerator({
    presets: [spinPreset({ themes: ALL_THEMES, primitives: false })],
  });
  const [withIt, without] = await Promise.all([
    own.generate(markup),
    empty.generate("p-4"),
  ]);
  return Math.max(0, bytes(withIt.css) - bytes(without.css));
}

/** The cost root a fixture is measured against. An alias follows its control. */
export const COST_ROOT: Record<string, string> = {
  radio: "input",
  select: "input",
  textarea: "input",
  label: "input",
  fieldset: "input",
  dialog: "dialog",
  alert: "alert",
  tabs: "tabs",
  popover: "popover",
  prose: "prose",
  details: "details",
  progress: "progress",
  meter: "progress",
  group: "group",
  summary: "details",
  td: "table",
  th: "table",
  caption: "table",
};
