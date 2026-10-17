/**
 * @spin/preset — the closed UnoCSS vocabulary over `@spin/theme`.
 *
 * Allowlist by construction: only utilities defined here exist. Anything else
 * generates no CSS. Token-driven rules resolve their names against the token
 * tree and emit token references, so values flow from the theme and are
 * never hardcoded here. Finite Uno theme extensions resolve verbatim.
 *
 * Icons are not part of this preset. `@unocss/preset-icons` is an optional
 * peer — a consumer composes it alongside, `presets: [presetIcons(),
 * spinPreset()]`, which is the idiomatic arrangement — and this preset's
 * own icon rules only size and place the glyph (`icon-sm`, `icon-md`,
 * `icon-lg`, and the button's `.button-icon` slot), spending the theme's
 * `icon` group. The dependency is never imported here, so a consumer that
 * uses no icon class pays nothing for it.
 *
 * Rules live in `rules/`, one family per file, concatenated in priority order
 * by `rules/index.ts`. Variants live in `variants/`, preflights in
 * `preflights.ts`, the published theme view in `theme.ts`, the utility
 * vocabulary in `utils/vocabulary.ts` with its assembly in
 * `utils/declarations.ts`, and rule factories in `utils/factories.ts`.
 */

/**
 * Cascade contract. The primitives layer sits beneath the utilities layer,
 * so a class always beats a variant — `class="button"` wins over any variant
 * that targets the same element. Variant vs variant is source-order: the
 * last one in the cascade wins, and a conflict is an author error, silent.
 * Utility vs utility is source-order: the last utility in the stylesheet
 * wins, which is CSS-correct. No merge utility (twMerge/cn) is applied;
 * layers decide.
 */

import { definePreset } from "@unocss/core";
import type { Preset } from "@unocss/core";
import transformerDirectives from "@unocss/transformer-directives";
import { parseTokens, validateLegibility, validateTokens } from "@spin/theme";
import { primitiveContracts } from "./rules/primitives/manifest.ts";
import { requiredRolesFor, scaffoldDocument } from "./roles.ts";
import { hasOverlay, resolveThemes } from "./session.ts";
import type { ThemeDocument, TokenTree } from "@spin/theme";
import { buildPreflights } from "./preflights.ts";
import { spinRules } from "./rules/index.ts";
import { spinShortcuts } from "./shortcuts.ts";
import {
  elementExtractor,
  typeExtractor,
  variantExtractor,
} from "./extractors.ts";
import { themeRef } from "@spin/theme";
import { wind4Layers, type Wind4Options } from "./wind4.ts";
import { orGroup } from "./utils/factories.ts";
import { breakpointEdges, spinVariants } from "./variants/index.ts";
export { describeCatalog } from "./catalog.ts";
export type { CatalogSection } from "./catalog.ts";
export {
  clearOverlay,
  hasOverlay,
  noteDiskDocument,
  noteDiskDocuments,
  overlayDirty,
  overlayThemes,
  resolveThemes,
  setOverlay,
} from "./session.ts";
export { toUnoTheme, type UnoTheme } from "./uno.ts";
export { requiredRolesFor, scaffold, scaffoldDocument } from "./roles.ts";
export { presetContract, presetRouter } from "./contract.ts";
export { overlayContract, overlayRouter } from "./overlay.ts";
export {
  type Wind4Exclusion,
  wind4Exclusions,
  type Wind4Layers,
  wind4Layers,
  type Wind4Options,
} from "./wind4.ts";

export type { ThemeDocument } from "@spin/theme";

// The component contract and the views over it. They live beside the rules,
// because a description of a rule belongs next to the rule — and the manifest
// they read is DERIVED from those rules, so it cannot disagree with them.
export type {
  CharacterToken,
  PrimitiveComponent,
  PrimitiveContract,
} from "./rules/primitives/manifest.ts";
export {
  claimedElements,
  paintedElements,
  primitiveComponents,
  primitiveContracts,
  primitiveReadsByGroup,
  primitiveVariants,
} from "./rules/primitives/manifest.ts";

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
   * Whether to layer `@unocss/preset-wind4` beneath our rules.
   *
   * Ours go first, so a token we define resolves against our theme and a token
   * we do not define falls through to wind4. wind4 contributes rules and
   * variants only — never a preflight.
   *
   * Pass `false` for a spin-only build, or an options object to configure the
   * layer. `dark: false` also drops wind4's `dark:` variant, which would
   * otherwise scope itself to a class a spin document never carries.
   */
  wind4?: boolean | Wind4Options;
}

/**
 * wind4 as a layer beneath ours, when asked for.
 *
 * `undefined` and `true` both mean the composed state we want. The module
 * takes wind4's RULES and VARIANTS and nothing else — in particular none of
 * its preflights, whose theme block re-emits our token references as
 * self-referential variables (`--spacing-2: var(--spacing-2)`) and so silently
 * zeroes every component that spends the scale. See `wind4.ts`.
 */
function wind4Layer(option: boolean | Wind4Options | undefined) {
  if (option === false) return { rules: [], variants: [] };
  return wind4Layers(typeof option === "object" ? option : {});
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
    // Breakpoint VALUES, resolved: a media query cannot read a custom
    // property, so the variant needs the literal width the theme declared.
    const edges = breakpointEdges(Object.values(trees));
    const wind4 = wind4Layer(options.wind4);

    return {
      name: "spin",
      theme,
      variants: [...spinVariants({ breakpoints: edges }), ...wind4.variants],
      // The element extractor turns `<button>` into the token `button`, so a
      // classless primitive is styled by its tag. It ships with the preset
      // because a classless primitive needs it; it never touches classes.
      extractors: [elementExtractor, typeExtractor, variantExtractor],
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
          opacity: orGroup(theme, "opacity"),
          letterSpacing: orGroup(theme, "letterSpacing"),
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
