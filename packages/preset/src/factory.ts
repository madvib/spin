/**
 * The preset's assembly, with wind4 as an internal switch.
 *
 * `createSpinFactory` is not a package export. The product always layers
 * wind4; the false branch exists so tests can ask which utilities spin owns
 * without re-deriving ownership from rule sources.
 */

import { definePreset } from "@unocss/core";
import type { Preset, UserShortcuts, Variant } from "@unocss/core";
import type { Theme } from "@spinjs/theme/theme-types";
import transformerDirectives from "@unocss/transformer-directives";
import transformerVariantGroup from "@unocss/transformer-variant-group";
import { judgeComposedTree, parseTokens } from "@spinjs/theme";
import type { ThemeDocument, TokenTree } from "@spinjs/theme";
import { opacitySteps, themeRef, type ThemeRef } from "./utils/theme-ref.ts";
import { primitiveContracts } from "./rules/primitives/manifest.ts";
import { buildPreflights } from "./preflights.ts";
import { spinRules } from "./rules/index.ts";
import { transitionDurations } from "./rules/transitions.ts";
import {
  classObjectExtractor,
  elementExtractor,
  typeExtractor,
  variantExtractor,
} from "./extractors.ts";
import { wind4Layers, wind4Theme } from "./wind4.ts";
import { orGroup } from "./utils/factories.ts";
import { styleNames, type SpinRule } from "./utils/lookup.ts";
import { breakpointEdges, spinVariants } from "./variants/index.ts";

/** Options for {@link spinPreset}. */
export interface SpinPresetOptions {
  /**
   * A single theme document, emitted as the `light` theme. No default:
   * composition decides completeness — pass `{ theme }` or `{ themes }`.
   * Without either, the factory throws naming the missing theme.
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
   * Named palette facet documents, each emitted under its own
   * `[data-palette]` selector after every `[data-theme]` block. Partial by
   * design: a palette carries ink and surface, never a full theme, so it is
   * parsed but never completeness-checked.
   */
  palettes?: Record<string, ThemeDocument>;
  /**
   * Named spacing facet documents, each emitted under its own
   * `[data-spacing]` selector after the palettes. Partial and
   * mode-invariant by design: parsed, never completeness-checked.
   */
  spacings?: Record<string, ThemeDocument>;
  /**
   * Primitive components to include, by name. Omitted means all of them, which
   * is what a consumer almost always wants: the primitives are what make
   * `<button>` a finished control instead of a raw element.
   *
   * Pass `false` for a utility-only build, or a list to opt in per component.
   * `false` drops the toggleable custom elements but keeps the base: reset
   * (tokenless, unconditional) and type (`h1`–`h6`, `p`, lists, quotations,
   * code) still ship, matching `documentDefaults`.
   */
  primitives?: string[] | boolean;
  /**
   * The project's own compositions — Uno's `shortcuts` option, unchanged.
   *
   * A composition is a named bundle of utilities: one class that stands for
   * a set the app repeats. Spin ships none of its own — the compositions an
   * app repeats are the app's decision, so they live in the app's build
   * configuration (`spin.vite({ shortcuts: { ... } })`; the install page
   * shows the worked example) — and the VALUES still come from the theme: a
   * composition that spends `gap-4` spends the theme's spacing step, so a
   * theme that prefers roomier sections sets it once and every composition
   * follows.
  */
  readonly shortcuts?: UserShortcuts;
  /**
   * Resolve the composed documents before parsing — the dev-server overlay
   * hook. The plugin passes `resolveThemes`; direct preset consumers get
   * their documents unchanged.
   */
  readonly resolveDocuments?: (
    documents: Record<string, ThemeDocument>,
  ) => Record<string, ThemeDocument>;
}

/** A theme the factory takes, or the error naming the missing one. */
function composedDocuments(options: SpinPresetOptions): Record<string, ThemeDocument> {
  if (options.themes !== undefined) return options.themes;
  if (options.theme !== undefined) return { light: options.theme };
  throw new Error("spinPreset: no theme — pass { theme } or { themes }");
}

/** A composed tree the build judges complete, or the refusal naming it. */
function judgeComposed(name: string, tree: TokenTree): void {
  const issues = judgeComposedTree(tree);
  if (issues.length > 0) {
    const details = issues.join("; ");
    throw new Error(`spinPreset: theme "${name}" is incomplete: ${details}`);
  }
}

export function createSpinFactory(
  layerWind4: boolean,
): (options?: SpinPresetOptions) => Preset<Theme> {
  const factory = definePreset<SpinPresetOptions, Theme>(
    (options: SpinPresetOptions = {}) => {
      if ("classless" in options) {
        throw new Error(
          "spinPreset: `classless` was removed — primitives always claim their bare tags. Narrow with `primitives: [...]` instead.",
        );
      }
      const enabled: string[] | undefined = Array.isArray(options.primitives)
        ? options.primitives
        : options.primitives === false
        ? []
        : undefined;
      const documents = (options.resolveDocuments ?? ((d) => d))(composedDocuments(options));
      const trees: Record<string, TokenTree> = {};
      for (const [name, doc] of Object.entries(documents)) {
        const parsed = parseTokens(doc);
        if (!parsed.ok) {
          throw new Error(
            `spinPreset: theme "${name}" is invalid: ${parsed.error}`,
          );
        }
        judgeComposed(name, parsed.tree);
        trees[name] = parsed.tree;
      }
      // Facets are partial by design — ink or space over a base theme — so a
      // facet parses but is never completeness-checked. A facet that does not
      // parse still fails the build: a half-written facet is a build input
      // like any other token document.
      const paletteTrees: Record<string, TokenTree> = {};
      const paletteDocuments: Record<string, ThemeDocument> = {};
      for (const [name, doc] of Object.entries(options.palettes ?? {})) {
        const parsed = parseTokens(doc);
        if (!parsed.ok) {
          throw new Error(
            `spinPreset: palette "${name}" is invalid: ${parsed.error}`,
          );
        }
        paletteTrees[name] = parsed.tree;
        paletteDocuments[name] = doc;
      }
      const spacingTrees: Record<string, TokenTree> = {};
      for (const [name, doc] of Object.entries(options.spacings ?? {})) {
        const parsed = parseTokens(doc);
        if (!parsed.ok) {
          throw new Error(
            `spinPreset: spacing "${name}" is invalid: ${parsed.error}`,
          );
        }
        spacingTrees[name] = parsed.tree;
      }
      // The uno theme is the only name table, and the names ARE the custom
      // properties: one flat map, every token. A rule reads `spacing-4` and
      // gets the reference; there is no exposure decision to make, so there
      // is no row to forget. wind4's nested vocabulary is spread on top of the
      // same object — see `wind4Theme` for why that seam and only that seam
      // exists.
      const componentRoots = enabled ?? Object.keys(primitiveContracts);
      const merged = Object.values(trees).reduce<TokenTree>((all, t) => [...all, ...t], []);
      const vars = themeRef(merged);
      const steps = opacitySteps(vars);
      const theme = { ...vars, ...wind4Theme(vars) } as unknown as ThemeRef;
      // Breakpoint VALUES, resolved: a media query cannot read a custom
      // property, so the variant needs the literal width the theme declared.
      const edges = breakpointEdges(Object.values(trees));
      const wind4 = layerWind4
        ? wind4Layers()
        : { rules: [], variants: [] };

      return {
        name: "spin",
        theme: theme as unknown as Theme,
        variants: [...spinVariants({ breakpoints: edges }), ...(wind4.variants as Variant<Theme>[])],
        // The project's own compositions, and only those. Spin ships no
        // shortcuts of its own: a class the project's config declares is a
        // class the project produces, and uno's `shortcuts` option is how
        // the project declares them.
        shortcuts: { ...options.shortcuts },
        // The element extractor turns `<button>` into the token `button`, so a
        // classless primitive is styled by its tag. It ships with the preset
        // because a classless primitive needs it; it never touches classes.
        extractors: [
          classObjectExtractor,
          elementExtractor,
          typeExtractor,
          variantExtractor,
        ],
        // Ours first. Uno keeps the first rule that MATCHES a token, and dynamic
        // rules are `unshift`ed onto the match list as they register — so
        // among dynamic rules the LAST registered is tried first. Ours first
        // makes ours the fallback wind4 is tried behind, which is the point: a
        // token we own resolves against our theme, and one we do not own falls
        // through.
        rules: [
          ...spinRules(componentRoots, steps),
          // wind4's rules read `theme` through their own nested vocabulary —
          // `wind4Theme` above — so their `object` theme parameter is the seam
          // working, not a type to unify.
          ...(wind4.rules as unknown as SpinRule[]),
        ],
        preflights: buildPreflights(
          { trees, documents, paletteTrees, paletteDocuments, spacingTrees },
        ),
        transformers: [transformerDirectives(), transformerVariantGroup()],
        // State variant precedence: UnoCSS sorts same-rule utilities by
        // `util.sort` before falling back to selector localeCompare (which
        // sorted `.aria-*` before `.data-*`, `.focus:*`, and `.hover:*`).
        postprocess: [
          (util) => {
            if ((util.layer ?? "default") !== "default") return;
            const s = util.selector;
            if (/:disabled\b|\[aria-disabled\b|\[data-disabled\b/.test(s)) {
              util.sort = 60;
              util.noMerge = true;
            } else if (/\[aria-(selected|pressed|checked|current|expanded)=/.test(s)) {
              util.sort = 50;
              util.noMerge = true;
            } else if (/:active\b|\[data-active\b/.test(s)) {
              util.sort = 40;
              util.noMerge = true;
            } else if (/\[data-/.test(s)) {
              util.sort = 30;
              util.noMerge = true;
            } else if (/:focus(?:-visible|-within)?\b/.test(s)) {
              util.sort = 20;
              util.noMerge = true;
            } else if (/:hover\b/.test(s)) {
              util.sort = 10;
              util.noMerge = true;
            }
          },
        ],
        // Declared order: reset (-100) → theme vars + body (-90) → primitives
        // (-50) → utilities (default 0). Without this, unregistered layer
        // names fall to 0 and localeCompare re-sorts, so primitives CSS lands
        // after utilities and `.secondary` can override `bg-primary` at equal
        // specificity. Components come first so utilities win ties. The reset
        // is named here too: a layer with no order is not a layer that sorts
        // first, it is a layer that sorts last.
        layers: { reset: -100, theme: -90, primitives: -50 },
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
            // No `text-$fontSize` / `font-$fontFamily` templates — the
            // raw utilities are gone, and completion offers named styles.
            "type-$fontStyle",
            "rounded-$radius",
            "shadow-$shadow",
          ],
          shorthands: {
            colors: orGroup(theme, "color"),
            spacing: orGroup(theme, "spacing"),
            opacity: orGroup(theme, "opacity"),
            // `tracking`/`leading` shorthands gone with the rules.
            breakpoint: orGroup(theme, "breakpoint"),
            zIndex: orGroup(theme, "z-index"),
            motionDuration: "(" + transitionDurations(theme).join("|") + ")",
            fontStyle: styleNames(theme),
            radius: orGroup(theme, "radius"),
            shadow: orGroup(theme, "shadow"),
          },
        },
      };
    },
  );
  return (options?: SpinPresetOptions) => factory(options);
}
