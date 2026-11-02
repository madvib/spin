/**
 * @spinjs/preset — the closed UnoCSS vocabulary over `@spinjs/theme`.
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

import type { Preset } from "@unocss/core";
import { createSpinFactory, type SpinPresetOptions } from "./factory.ts";

export type { SpinPresetOptions };

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
} from "../plugin/session.ts";
export { toUnoTheme, type UnoTheme } from "./uno.ts";
export { spinShortcuts } from "./shortcuts.ts";
export { requiredRolesFor, scaffold, scaffoldDocument } from "./roles.ts";
export { presetContract, presetRouter } from "./contract.ts";
export { overlayContract, overlayRouter } from "./overlay.ts";
export {
  type CatalogGroupId,
  claimedGroups,
  type Sample,
  SAMPLES,
  type Section,
  sectionFor,
  SECTIONS,
  utilitiesFor,
} from "./organization.ts";
export {
  type Axis,
  buildScale,
  type BuiltScale,
  EDGE_AXES,
  EDGES,
  type Scale,
  scaleClass,
  type ScaleSource,
  type Shape,
} from "./reference/build.ts";
export type { Step } from "./reference/scale.ts";
export {
  type ComponentExamples,
  componentExamples,
  examplesFor,
} from "./rules/primitives/examples-index.ts";
export type {
  ClassDoc,
  ClassDocKind,
  FixtureExample,
} from "./rules/primitives/example.ts";

export type { ThemeDocument } from "../theme/index.ts";

// The component contract and the views over it. They live beside the rules,
// because a description of a rule belongs next to the rule — and the manifest
// they read is DERIVED from those rules, so it cannot disagree with them.
export type {
  ComponentToken,
  PrimitiveComponent,
  PrimitiveContract,
} from "./rules/primitives/manifest.ts";
export {
  claimedElements,
  paintedElements,
  primitiveCategories,
  primitiveComponents,
  primitiveContracts,
  primitiveElements,
  primitiveReadsByGroup,
  primitiveVariants,
} from "./rules/primitives/manifest.ts";
export type {
  PrimitiveCategory,
  PrimitiveElement,
} from "./rules/primitives/categories.ts";
/**
 * The decisions an element's look is made of, and the property each one is
 * read from.
 *
 * The vocabulary belongs to the primitives: the manifest's scope table is
 * written in these words, and a consumer that reads the manifest has to be
 * able to say which decision a CSS property belongs to without keeping a
 * second list of its own.
 */
export { type PaintKey, paintKeyOf } from "./rules/primitives/scope.ts";

const factory = createSpinFactory(true);

/**
 * The spin preset. Token utilities resolve against the theme tree and emit
 * CSS variables; anything not in the tree matches no rule and emits nothing.
 */
export function spinPreset(options?: SpinPresetOptions): Preset {
  return factory(options) as unknown as Preset;
}

export default spinPreset;
