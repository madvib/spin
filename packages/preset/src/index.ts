/**
 * @spin/preset — the closed UnoCSS vocabulary over `@spin/theme`.
 *
 * Allowlist by construction: only utilities defined here exist. Anything else
 * generates no CSS. Token-driven rules resolve their names against the token
 * tree and emit `var(--…)` references, so values flow from the theme and are
 * never hardcoded here. Finite Uno theme extensions resolve verbatim.
 *
 * Rules live in `rules/`, one family per file, concatenated in priority order
 * by `rules/index.ts`. Variants live in `variants/`, preflights in
 * `preflights.ts`, the published theme view in `theme.ts`, the utility
 * vocabulary in `utils/vocabulary.ts` with its assembly in
 * `utils/declarations.ts`, and rule factories in `utils/factories.ts`.
 */

import { definePreset } from "@unocss/core";
import type { Preset } from "@unocss/core";
import transformerDirectives from "@unocss/transformer-directives";
import { parseTokens, validateLegibility, validateTokens } from "@spin/theme";
import { primitiveContracts } from "@spin/primitives";
import { requiredRolesFor, scaffoldDocument } from "./roles.ts";
import type { TokenTree } from "@spin/theme";
import { buildPreflights } from "./preflights.ts";
import { spinRules } from "./rules/index.ts";
import { themeRef } from "@spin/theme";
import { orGroup } from "./utils/factories.ts";
import type { ThemeRef } from "@spin/theme";
import { spinVariants } from "./variants/index.ts";
export { describeCatalog } from "./catalog.ts";
export type { CatalogSection } from "./catalog.ts";
export { toUnoTheme, type UnoTheme } from "./uno.ts";
export {
  allRequiredRoles,
  requiredRolesFor,
  scaffold,
  scaffoldDocument,
} from "./roles.ts";
export { presetContract, presetRouter } from "./contract.ts";

/**
 * A theme document, as authored.
 *
 * `Record<string, unknown>` rather than `unknown` because it rejects the one
 * mistake a caller can actually make: passing a parsed `TokenTree`, which is
 * an array. That compiles cleanly under `unknown` and fails at build time
 * inside a consumer's bundler, which is the worst place to find out. The
 * structural type also accepts anything `JSON.parse` produces, so a theme
 * file costs no cast.
 */
export type ThemeDocument = Record<string, unknown>;

/** Options for {@link spinPreset}. */
export interface SpinPresetOptions {
  /**
   * A single theme document, emitted as the `light` theme. Defaults to the
   * scaffold — every required role, no scales. Enough to build against, never
   * a look.
   *
   * Themes are documents rather than parsed trees because a theme owns more
   * than tokens: `$extensions.spin.fonts` declares what to load, and
   * `parseTokens` keeps tokens and drops extensions. The document is the unit
   * and the tree is derived from it.
   */
  theme?: ThemeDocument;
  /**
   * Named theme documents, each emitted under its own `[data-theme]` selector
   * with a `[data-mode="dark"]` axis for its dark overrides. Takes precedence
   * over `theme`. Rules resolve against the union of all themes.
   */
  themes?: Record<string, ThemeDocument>;
  /**
   * Primitive components to include, by name. Omitted means all of them, which
   * is what a consumer almost always wants: the primitives are what make
   * `<button>` a finished control instead of a raw element.
   *
   * Pass `false` for a utility-only build, or a list to opt in per component.
   */
  primitives?: string[] | boolean;
}

function defaultDocument(): ThemeDocument {
  return scaffoldDocument();
}

function assertComplete(
  name: string,
  tree: TokenTree,
  required: string[],
): void {
  const report = validateTokens(tree, { required: [...required] });
  const issues = [...report.issues, ...validateLegibility(tree)];
  if (issues.length > 0) {
    const details = issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("; ");
    throw new Error(`spinPreset: theme "${name}" is incomplete: ${details}`);
  }
}

const factory = definePreset(
  (options: SpinPresetOptions = {}) => {
    const enabled: string[] | undefined = Array.isArray(options.primitives)
      ? options.primitives
      : options.primitives === false
      ? []
      : undefined;
    const documents = options.themes ?? {
      light: options.theme ?? defaultDocument(),
    };
    const trees: Record<string, TokenTree> = {};
    for (const [name, doc] of Object.entries(documents)) {
      const parsed = parseTokens(doc);
      if (!parsed.ok) {
        throw new Error(
          `spinPreset: theme "${name}" is invalid: ${parsed.error}`,
        );
      }
      assertComplete(
        name,
        parsed.tree,
        requiredRolesFor(enabled ?? Object.keys(primitiveContracts)),
      );
      trees[name] = parsed.tree;
    }
    // The uno theme is the only name table. Values are references, so a rule
    // reads one and returns it: no path to join, no variable to spell.
    // Component roots come from the manifest, so a component's character
    // tokens are reachable as `theme[root][step]` — the same change that
    // enables a component makes its tokens spendable.
    const componentRoots = enabled ?? Object.keys(primitiveContracts);
    const theme = themeRef(
      Object.values(trees).reduce<TokenTree>((all, t) => [...all, ...t], []),
      componentRoots,
    );

    return {
      name: "spin",
      theme,
      variants: spinVariants(),
      rules: spinRules(componentRoots),
      preflights: buildPreflights(
        { trees, documents },
        { primitives: enabled },
      ),
      transformers: [transformerDirectives()],
      // Declared order: reset (-100) → theme vars + body (-90) → primitives
      // (-50) → utilities (default 0). Without this, unregistered layer
      // names fall to 0 and localeCompare re-sorts, so primitives CSS lands
      // after utilities and `.secondary` can override `bg-primary` at equal
      // specificity. Components come first so utilities win ties.
      layers: { theme: -90, primitives: -50 },
      autocomplete: {
        templates: [
          "bg-$colors",
          "border-$colors",
          "p-$spacing",
          "m-$spacing",
          "gap-$spacing",
          "w-$spacing",
          "h-$spacing",
          "inset-$spacing",
          "z-$zIndex",
          "duration-$motionDuration",
          "ease-$motionEasing",
          "text-$fontSize",
          "font-$fontFamily",
          "rounded-$radius",
          "shadow-$shadow",
        ],
        shorthands: {
          colors: orGroup(theme, "colors"),
          spacing: orGroup(theme, "spacing"),
          breakpoint: orGroup(theme, "breakpoint"),
          zIndex: orGroup(theme, "zIndex"),
          motionDuration: orGroup(theme, "motionDuration"),
          motionEasing: orGroup(theme, "motionEasing"),
          fontSize: orGroup(theme, "fontSize"),
          fontFamily: orGroup(theme, "fontFamily"),
          fontWeight: orGroup(theme, "fontWeight"),
          radius: orGroup(theme, "radius"),
          shadow: orGroup(theme, "shadow"),
        },
      },
    };
  },
);

/**
 * The spin preset. Token utilities resolve against the theme tree and emit
 * CSS variables; anything not in the tree matches no rule and emits nothing.
 */
export function spinPreset(options?: SpinPresetOptions): Preset {
  return factory(options) as unknown as Preset;
}

export default spinPreset;
