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
import { spinShortcuts } from "./shortcuts.ts";
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
   */
  primitives?: string[] | boolean;
  /**
   * Whether a primitive may claim a bare element, or only a classed one.
   *
   * The primitives are classless by default: `<button>` is a button, and a
   * `<table>` is styled without a class. That is the whole premise, and it is
   * what makes the surface pleasant to write.
   *
   * It is also a strong claim on someone else's markup. A consumer with a
   * document they do not control — a CMS, a third-party embed, a codebase
   * mid-migration — cannot afford every `<table>` in the page being restyled
   * by their build tool. Setting `classless: false` makes each primitive claim
   * only its own class: `class="button"`, `class="table"`. The components are
   * still available and still shaken; they simply ask to be named.
   *
   * This is the escape hatch for a primitive's opinions, and it is one option
   * rather than a class per component — a consumer opts out of the classless
   * claim once, not once per opinion they disagree with.
   */
  classless?: boolean;
  /**
   * The project's own shortcuts — Uno's `shortcuts` option, unchanged.
   *
   * A shortcut is a named composition: one class that stands for a set of
   * utilities. Spin does not forbid a project from composing its own
   * vocabulary — the layout an app repeats is the app's decision, not the
   * framework's — and the VALUES still come from the theme: a shortcut that
   * spends `gap-4` spends the theme's spacing step, so a theme that prefers
   * roomier sections sets it once and every shortcut follows.
   *
   * The product's own compositions — `stack`, `row`, `split`, `panel`,
   * `overline` and their steps — ship with the preset. A project's shortcuts
   * are layered on top, so a name can be specialised but never has to be
   * restated.
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
        // The product's own compositions, and the project's on top. The
        // standard ones — `stack`, `row`, `split`, `panel`, `overline` — are
        // the preset's vocabulary, so every app that draws a page reads the
        // same set whether or not its config names them. A project's own ride
        // the preset too, so everything that wires spin carries them.
        shortcuts: { ...spinShortcuts, ...options.shortcuts },
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
          ...spinRules(componentRoots, {
            classless: options.classless !== false,
          }),
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
