/**
 * Starter themes — the shipped set.
 *
 * A consumer picks one and customises it; nobody writes a theme from scratch,
 * so these are the product rather than fixtures. They live in `src/` beside the
 * code that reads them.
 *
 * **A theme is not a mode.** `light` and `dark` are not two themes — they are
 * two modes of one, and a theme supports either or both. So there is no theme
 * named `light`: there is a theme named `default` that carries a `dark` group,
 * and the generator scopes that group to `[data-theme="default"][data-mode="dark"]`.
 * Conflating the two produced a starter a consumer could adopt and find had no
 * dark mode at all.
 *
 * Every starter carries both modes. A theme that could only be light is a theme
 * a consumer has to extend before they can ship, which is exactly the work a
 * starter theme exists to save them.
 */
import console_ from "./console.json" with { type: "json" };
import default_ from "./default.json" with { type: "json" };
import neobrut from "./neobrut.json" with { type: "json" };
import widow from "./widow.json" with { type: "json" };
import type { ThemeDocument } from "../index.ts";

/**
 * The default theme. Every scale step a component can spend is here, and it is
 * the theme the generated token types are derived from — so a token the default
 * does not state is not spendable by anything.
 */
export const defaultTheme = default_ as ThemeDocument;

/** A second direction: flat, high-chroma, heavy borders, hard shadows. */
export const neobrutTheme = neobrut as ThemeDocument;

/** A third: a terminal palette, where a field is sunk rather than raised. */
export const consoleTheme = console_ as ThemeDocument;

/** A fourth: the brand. Monochrome with one red thread; a didone speaks. */
export const widowTheme = widow as ThemeDocument;

/**
 * The themes a consumer can start from, by name.
 *
 * The modes are NOT here: a mode is a `data-mode` attribute on an element that
 * already declares a theme, not a theme of its own. `supportedModes` is how a
 * consumer finds out which modes a starter answers to.
 */
export { supportsDark, themeModes } from "../modes.ts";

export const starterThemes = {
  default: defaultTheme,
  neobrut: neobrutTheme,
  console: consoleTheme,
  widow: widowTheme,
} as const;

export type StarterThemeName = keyof typeof starterThemes;

/**
 * The MODES a theme renders in, beyond its own base.
 *
 * The base is not a mode — it is the theme. A theme's base can be any colour at
 * all: console's base IS dark, so calling its base the "light" mode would say
 * a dark theme renders in light, which is the same conflation as a theme named
 * `light` all over again.
 *
 * So what a theme declares is the set of OVERRIDES it carries. A theme with no
 * `dark` group renders one way; a theme with one renders that way and another
 * under `[data-mode="dark"]`. `[]` means "one rendering", not "no dark".
 */
