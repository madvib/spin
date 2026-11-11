/**
 * The app's theme set: the names it serves, and what each one renders in.
 *
 * The picker and the montage read the SAME list, so a theme the app can
 * switch to is a theme the montage has a column for — a column that was left
 * out is a theme nobody can compare, and a theme compared under a name the
 * app does not serve is a theme that does not exist.
 *
 * The list is the starters the app names through `extends`, FORKED by the
 * project's own files: a file of the same name in `spin/` replaces the
 * starter of that name, and a file of a name the package does not ship
 * adds a theme of its own. The build serves the same set — the plugin
 * reads `spin/*.json` from the same directory — so the names here are
 * the names the page carries, and the montage shows whatever the
 * project serves under them.
 */

import { starterThemes, themeModes } from "@spinjs/theme/themes";

/**
 * The project's own theme documents, read at build time.
 *
 * `import.meta.glob` is the only way to see them: the app is a browser
 * bundle, and a theme the build cannot see is a theme the page cannot render.
 *
 * The files come in as TEXT and are parsed here, so a file that does not
 * parse is skipped rather than failing the build — the same rule the plugin
 * follows when it reads the same directory for the stylesheet. A half-written
 * theme in an editor must not cost the app the rest of its themes.
 */
function readProjectSources(): Record<string, string> {
  try {
    return import.meta.glob<string>(
      "../spin/*.json",
      { eager: true, query: "?raw", import: "default" },
    );
  } catch {
    // Outside vite `import.meta.glob` is not a function: the app serves the
    // starters alone, which is what the tests assert against.
    return {};
  }
}

const PROJECT_SOURCES = readProjectSources();

/** The project's own themes, by name. */
const PROJECT_THEMES: Record<string, Record<string, unknown>> = Object
  .fromEntries(
    Object.entries(PROJECT_SOURCES).flatMap(([path, text]) => {
      const name = path.split("/").pop()?.replace(/\.json$/, "") ?? path;
      try {
        return [[name, JSON.parse(text) as Record<string, unknown>]];
      } catch {
        // Skipped: a file that does not parse is not a theme.
        return [];
      }
    }),
  );

/**
 * Every theme the app serves: the named starters, and the project's own.
 *
 * A project's file wins over the starter of the same name, which is what
 * "forked" means: the build serves the project's copy, so the app must
 * too. This merge mirrors the plugin's `extends` layering — same
 * inputs, same order — so the columns are the themes the stylesheet
 * carries.
 */
const SERVED: Record<string, Record<string, unknown>> = {
  ...starterThemes,
  ...PROJECT_THEMES,
};

/** The themes the app serves, by name. */
export const THEMES: readonly string[] = Object.keys(SERVED);

/**
 * The documents the app serves, by name.
 *
 * The kit's theme state reads this map: a project theme is a theme the
 * picker can serve, and a theme the picker cannot name is a theme the app
 * renders but nobody can choose.
 */
export const themeDocuments: Readonly<Record<string, unknown>> = SERVED;

/**
 * A theme's document, or undefined when the name is not one of ours.
 *
 * The lookup is a cast rather than an index signature: the cast is the price
 * of `Object.keys` giving back strings, and the undefined arm is what keeps a
 * name that is not a theme from reading as one.
 */
export function themeDocument(
  name: string,
): Record<string, unknown> | undefined {
  return SERVED[name];
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
 * A theme serves the modes it declares, and each mode is a rendering: the
 * tokens it names again for that mode. A theme that declares no mode has ONE
 * rendering, and that is not a missing half: neobrut has no dark tokens to
 * restate, and console's base IS its dark rendering.
 *
 * So the LABEL says what the reader sees and the MODE says which block the
 * page reads. A mode a theme does not restate falls back to the base, so the
 * rendering is the same picture either way — but the MODE is the mode's own
 * name, because that is the block the page has to read to wear it. The order
 * is the reader's: light first, because a machine that asks for light arrives
 * at the light rendering.
 */
export function renderingsFor(name: string): readonly Rendering[] {
  const doc = themeDocument(name);
  if (doc === undefined) return [];
  const modes = themeModes(doc);
  // A theme that serves BOTH modes has two renderings, and a theme that
  // serves ONE has one: the rendering IS the mode it serves, which for
  // console is dark (console's base is dark, so it has no light rendering to
  // show) and for neobrut is light.
  //
  // Light first, because the light rendering is the one a reader arrives at
  // on a machine that asks for light.
  const served = modes.filter((mode): mode is "light" | "dark" =>
    mode === "light" || mode === "dark"
  );
  if (served.length === 0) return [{ mode: "base", label: "base" }];
  return served.map((mode) => ({ mode, label: mode }));
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
