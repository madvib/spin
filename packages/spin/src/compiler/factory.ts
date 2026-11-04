/**
 * The preset's assembly, with wind4 as an internal switch.
 *
 * `createSpinFactory` is not a package export. The product always layers
 * wind4; the false branch exists so tests can ask which utilities spin owns
 * without re-deriving ownership from rule sources.
 */

import { definePreset } from "@unocss/core";
import type { Preset, UserShortcuts } from "@unocss/core";
import transformerDirectives from "@unocss/transformer-directives";
import transformerVariantGroup from "@unocss/transformer-variant-group";
import {
  parseTokens,
  themeRef,
  validateLegibility,
  validateTokens,
} from "../theme/index.ts";
import type { ThemeDocument, ThemeRef, TokenTree } from "../theme/index.ts";
import { primitiveContracts } from "./rules/primitives/manifest.ts";
import { requiredRolesFor, scaffoldDocument } from "./roles.ts";
import { resolveThemes } from "../plugin/session.ts";
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
import { breakpointEdges, spinVariants } from "./variants/index.ts";

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

export function createSpinFactory(
  layerWind4: boolean,
): (options?: SpinPresetOptions) => Preset {
  const factory = definePreset(
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
      const documents = resolveThemes(
        options.themes ?? { light: options.theme ?? defaultDocument() },
      );
      const trees: Record<string, TokenTree> = {};
      for (const [name, doc] of Object.entries(documents)) {
        const parsed = parseTokens(doc);
        if (!parsed.ok) {
          throw new Error(
            `spinPreset: theme "${name}" is invalid: ${parsed.error}`,
          );
        }
        assertComplete(name, parsed.tree, requiredRolesFor());
        trees[name] = parsed.tree;
      }
      // The uno theme is the only name table, and the names ARE the custom
      // properties: one flat map, every token. A rule reads `spacing-4` and
      // gets the reference; there is no exposure decision to make, so there
      // is no row to forget. wind4's nested vocabulary is spread on top of the
      // same object — see `wind4Theme` for why that seam and only that seam
      // exists.
      const componentRoots = enabled ?? Object.keys(primitiveContracts);
      const vars = themeRef(
        Object.values(trees).reduce<TokenTree>((all, t) => [...all, ...t], []),
      );
      const theme = { ...vars, ...wind4Theme(vars) } as unknown as ThemeRef;
      // Breakpoint VALUES, resolved: a media query cannot read a custom
      // property, so the variant needs the literal width the theme declared.
      const edges = breakpointEdges(Object.values(trees));
      const wind4 = layerWind4
        ? wind4Layers()
        : { rules: [], variants: [] };

      return {
        name: "spin",
        theme,
        variants: [...spinVariants({ breakpoints: edges }), ...wind4.variants],
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
          ...spinRules(componentRoots),
          ...wind4.rules,
        ],
        preflights: buildPreflights(
          { trees, documents },
        ),
        transformers: [transformerDirectives(), transformerVariantGroup()],
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
            "text-$fontSize",
            "font-$fontFamily",
            "rounded-$radius",
            "shadow-$shadow",
          ],
          shorthands: {
            colors: orGroup(theme, "color"),
            spacing: orGroup(theme, "spacing"),
            opacity: orGroup(theme, "opacity"),
            letterSpacing: orGroup(theme, "font-letter-spacing"),
            breakpoint: orGroup(theme, "breakpoint"),
            zIndex: orGroup(theme, "z-index"),
            motionDuration: "(" + transitionDurations(theme).join("|") + ")",
            motionEasing: orGroup(theme, "motion-easing"),
            fontSize: orGroup(theme, "font-size"),
            fontFamily: orGroup(theme, "font-family"),
            fontWeight: orGroup(theme, "font-weight"),
            radius: orGroup(theme, "radius"),
            shadow: orGroup(theme, "shadow"),
          },
        },
      };
    },
  );
  return (options?: SpinPresetOptions) => factory(options) as unknown as Preset;
}
