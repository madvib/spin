/**
 * The app's theme set: the names it serves, and what each one renders in.
 *
 * The picker and the montage read the SAME list, so a theme the app can
 * switch to is a theme the montage has a column for — a column that was left
 * out is a theme nobody can compare, and a theme compared under a name the
 * app does not serve is a theme that does not exist.
 *
 * The list is the starters the theme package ships. A project forks a starter
 * by putting a file of the same name in `spin/`, and the fork REPLACES the
 * starter of that name in the stylesheet — so the names here are the names
 * the page carries either way, and the montage shows whatever the project
 * serves under them.
 */

import { starterThemes, themeModes } from "@spin/theme/themes";

/** The themes the app serves, by name. */
export const THEMES: readonly string[] = Object.keys(starterThemes);

/**
 * A theme's document, or undefined when the name is not one of ours.
 *
 * The starters are a fixed set, so the lookup is a cast rather than an index
 * signature: the cast is the price of `Object.keys` giving back strings, and
 * the undefined arm is what keeps a name that is not a theme from reading as
 * one.
 */
export function themeDocument(
  name: string,
): Record<string, unknown> | undefined {
  const themes = starterThemes as unknown as Record<
    string,
    Record<string, unknown>
  >;
  return themes[name];
}

/**
 * One rendering of one theme.
 *
 * The mode is the block the page reads; the label is what the reader sees.
 * They are not always the same word, and the difference is the point: see
 * {@link renderingsFor}.
 */
export interface Rendering {
  /** The `data-mode` the theme's own block is scoped to. */
  readonly mode: string;
  /** The mode the reader SEES, which is what the label says. */
  readonly label: string;
}

/**
 * The renderings a theme serves.
 *
 * A theme's own rendering is `base`, and the dark restatement — the tokens a
 * theme names again for the dark mode — is `dark`. A theme that declares no
 * dark mode has ONE rendering, and that is not a missing half: neobrut has no
 * dark tokens to restate, and console's base IS its dark rendering.
 *
 * So the LABEL says what the reader sees and the MODE says which block the
 * page reads. A theme that serves both renders light first — its base IS the
 * light rendering, and the dark one is the restatement of it — and a theme
 * that serves one renders that one, labelled by what it is.
 */
export function renderingsFor(name: string): readonly Rendering[] {
  const doc = themeDocument(name);
  if (doc === undefined) return [];
  const modes = themeModes(doc);
  // A theme that serves BOTH modes has two renderings: its base is the light
  // one, and the dark restatement is the second. A theme that serves ONE mode
  // has one rendering — and that rendering IS the mode it serves, which for
  // console is dark: console's base is dark, so it has no light rendering to
  // show, and showing its base twice would be a theme pretending to have a
  // second face.
  if (modes.includes("light") && modes.includes("dark")) {
    return [
      { mode: "base", label: "light" },
      { mode: "dark", label: "dark" },
    ];
  }
  return [{ mode: "base", label: modes[0] ?? "base" }];
}

/**
 * Whether the page carries a rendering for this theme at all.
 *
 * The montage promises every theme a column, so a theme that never reached
 * the stylesheet has to be SAID rather than shown in whatever the app's own
 * theme happens to paint. The absence of the block is the fact: the generator
 * emits nothing for a theme that has no tokens, and a forked theme whose
 * document does not parse never gets one.
 *
 * The rule is read from the document's own stylesheets rather than from the
 * theme, because the theme is what is in question.
 */
export function themeIsServed(name: string): boolean {
  const selector = `[data-theme="${name}"]`;
  let rules = 0;
  for (const sheet of Array.from(document.styleSheets)) {
    let sheetRules: CSSRuleList;
    try {
      sheetRules = sheet.cssRules;
    } catch {
      // A stylesheet from another origin cannot be read, and says nothing
      // about this theme either way.
      continue;
    }
    rules += sheetRules.length;
    for (const rule of Array.from(sheetRules)) {
      if (
        rule instanceof CSSStyleRule && rule.selectorText.includes(selector)
      ) {
        return true;
      }
    }
  }
  // No stylesheet carried a rule at all: the page's own sheet has not landed
  // yet, and a theme cannot be said to be missing from a sheet that is not
  // there. The page shows itself unstyled instead, which is a thing a reader
  // can see.
  return rules === 0;
}
