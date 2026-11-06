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
import catppuccinPaletteDoc from "./catppuccin.palette.json" with { type: "json" };
import compactSpacingDoc from "./compact.spacing.json" with { type: "json" };
import industrial from "./industrial.json" with { type: "json" };
import material from "./material.json" with { type: "json" };
import neobrut from "./neobrut.json" with { type: "json" };
import silk from "./silk.json" with { type: "json" };
import spin from "./spin.json" with { type: "json" };
import baseReference from "../base/reference.json" with { type: "json" };
import baseRoles from "../base/roles.json" with { type: "json" };
import baseElements from "../base/elements.json" with { type: "json" };
import basePrimitives from "../base/primitives.json" with { type: "json" };
import { expandExtends, mergeThemeDocuments } from "../extends.ts";
import { themeGroups } from "../contract/groups.ts";
import type { ThemeDocument } from "../index.ts";

/**
 * The shared foundation every starter layers over: the reference scales,
 * the role placeholders, the intrinsic element voices, and the primitive
 * defaults with their type aliases. `reference` and `roles` both state
 * `font` and `focus` — the scales beside the role placeholders — so they
 * deep-merge group by group rather than shallow-unioning.
 */
export const baseTheme: ThemeDocument = mergeThemeDocuments(
  mergeThemeDocuments(
    mergeThemeDocuments(
      baseRoles as ThemeDocument,
      baseReference as ThemeDocument,
    ),
    baseElements as ThemeDocument,
  ),
  basePrimitives as ThemeDocument,
);

/** A raw starter document, layered over the foundation it names. */
function starter(doc: unknown): ThemeDocument {
  return expandExtends(doc as ThemeDocument, { base: baseTheme });
}

/**
 * The baseline. Every scale step a component can spend is here, and it is the
 * theme the generated token types are derived from — so a token the baseline
 * does not state is not spendable by anything.
 */
export const silkTheme = starter(silk);

/** A second direction: flat, high-chroma, heavy borders, hard shadows. */
export const neobrutTheme = starter(neobrut);

/** Tonal & pill: indigo-tinted containers, pill controls, and 20px cards. */
export const materialTheme = starter(material);

/** Editorial & print: warm stone paper, Fraunces display serif, and crimson + cobalt inks. */
export const spinTheme = starter(spin);

/** Tactile hardware & neumorphic: anodized aluminum by day, gunmetal by night, dual bevel shadows. */
export const industrialTheme = starter(industrial);

/**
 * The compact density: a tighter spacing ramp with matching card and alert
 * padding, served under `[data-spacing="compact"]`. A facet, not a theme —
 * partial by design, composing over any base theme without touching its ink
 * or type.
 */
export const compactSpacing = compactSpacingDoc as ThemeDocument;

/**
 * Catppuccin Latte by day, Mocha by night, served under
 * `[data-palette="catppuccin"]`. A facet, not a theme — ink and surface only,
 * composing over any base theme without touching its space or type.
 */
export const catppuccinPalette = catppuccinPaletteDoc as ThemeDocument;

/**
 * The themes a consumer can start from, by name.
 *
 * The modes are NOT here: a mode is a `data-mode` attribute on an element that
 * already declares a theme, not a theme of its own. `themeModes()` is how a
 * consumer finds out which modes a starter answers to.
 */
export { supportsDark, themeModes } from "../modes.ts";

export const starterThemes: Record<string, ThemeDocument> = {
  silk: silkTheme,
  material: materialTheme,
  neobrut: neobrutTheme,
  industrial: industrialTheme,
  spin: spinTheme,
};

export type StarterThemeName =
  | "silk"
  | "spin"
  | "material"
  | "neobrut"
  | "industrial";

/**
 * The groups the starters declare, in the order a document reads them.
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
