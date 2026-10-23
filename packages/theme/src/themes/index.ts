/**
 * Starter themes — the shipped set.
 *
 * A consumer picks one and customises it; nobody writes a theme from scratch,
 * so these are the product rather than fixtures. They live in `src/` beside the
 * code that reads them.
 *
 * **A theme is not a mode.** `light` and `dark` are not two themes — they are
 * two modes of one, and a theme serves either or both. So there is no theme
 * named `light`: there is a theme named `silk` that serves a dark mode, and
 * the generator scopes that mode to `[data-theme="silk"][data-mode="dark"]`.
 * Conflating the two produced a starter a consumer could adopt and find had
 * no dark mode at all.
 *
 * A theme serves the modes it declares at its root, and it overrides only
 * what differs: a theme that serves dark without a single dark override is a
 * complete theme, because the mode it serves falls back to the base values.
 * That is console's case exactly — a terminal palette whose base is already
 * dark, serving dark and restating nothing.
 */
import console_ from "./console.json" with { type: "json" };
import neobrut from "./neobrut.json" with { type: "json" };
import silk from "./silk.json" with { type: "json" };
import spin from "./spin.json" with { type: "json" };
import synthwave from "./synthwave.json" with { type: "json" };
import { themeGroups } from "../contract/groups.ts";
import type { ThemeDocument } from "../index.ts";

/**
 * The baseline. Every scale step a component can spend is here, and it is the
 * theme the generated token types are derived from — so a token the baseline
 * does not state is not spendable by anything.
 */
export const silkTheme = silk as ThemeDocument;

/** A second direction: flat, high-chroma, heavy borders, hard shadows. */
export const neobrutTheme = neobrut as ThemeDocument;

/** A third: a terminal palette, where a field is sunk rather than raised. */
export const consoleTheme = console_ as ThemeDocument;

/** The brand: monochrome with one red thread; a didone speaks. */
export const spinTheme = spin as ThemeDocument;

/** Dark glass and lit figures by night; lavender lamp by day. */
export const synthwaveTheme = synthwave as ThemeDocument;

/**
 * The themes a consumer can start from, by name.
 *
 * The modes are NOT here: a mode is a `data-mode` attribute on an element that
 * already declares a theme, not a theme of its own. `themeModes()` is how a
 * consumer finds out which modes a starter answers to.
 */
export { supportsDark, themeModes } from "../modes.ts";

export const starterThemes = {
  silk: silkTheme,
  neobrut: neobrutTheme,
  console: consoleTheme,
  synthwave: synthwaveTheme,
  spin: spinTheme,
} as const;

export type StarterThemeName = keyof typeof starterThemes;

/**
 * The groups the shipped starters declare, in the order a document reads them.
 *
 * The starters are the product, so their groups are the system's vocabulary:
 * the scales a theme spends, the machinery it states, and the per-element
 * groups where one element is styled on its own. The list is emitted rather
 * than written down, so the house skill's checklist and the schema page
 * cannot disagree about what a theme contains.
 */
export function starterGroups(): readonly string[] {
  return themeGroups(Object.values(starterThemes));
}

/**
 * The MODES a theme renders in.
 *
 * The base is not a mode — it is the theme. A theme's base can be any colour at
 * all: console's base IS dark, so calling its base the "light" mode would say
 * a dark theme renders in light, which is the same conflation as a theme named
 * `light` all over again.
 *
 * So what a theme declares is the set of modes it SERVES, at its root. A
 * theme that serves one mode renders that mode; a theme that serves two
 * renders the second under `[data-mode="dark"]`, and the tokens it does not
 * override there fall back to the base values. `[]` means "one rendering",
 * not "no dark".
 */
