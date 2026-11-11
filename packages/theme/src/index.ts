/**
 * @spinjs/theme — DTCG JSON in, token trees out.
 *
 * The pipeline is parse, resolve, validate, and CSS variable emission — four
 * independent stages, and you can enter it at any of them. Finished elements
 * live in the preset's rules, which spend these trees; nothing here knows
 * components exist.
 *
 * A token's name is derived from its path, once. The preset's uno binding
 * builds the object uno resolves against, with `var(--color-primary)` as the
 * value of `color.primary`, and `generateCss` emits that same name into the
 * stylesheet. Nothing downstream spells a custom property by hand, so a
 * rename cannot leave a rule pointing at nothing.
 */

// Types — the closed vocabulary and the shapes every stage speaks.
export type {
  CssOptions,
  ParseResult,
  ResolvedTokenTree,
  TokenGroup,
  TokenLeaf,
  TokenNode,
  TokenTree,
  TokenType,
  ValidateOptions,
  ValidationIssue,
  ValidationReport,
} from "./pipeline/types.ts";
export { TOKEN_TYPES } from "./pipeline/types.ts";
export type { ThemeDocument } from "./pipeline/types.ts";

// Stage 1: parse.
export { isTokenType, parseDocument, parseTokens } from "./pipeline/parse.ts";
export type { DocumentResult } from "./pipeline/parse.ts";

// Stage 2: resolve.
export {
  aliasTarget,
  cssVarName,
  detectCycles,
  indexTree,
  isAliasValue,
  lookupNode,
  resolveAliases,
  type TokenIndex,
} from "./pipeline/resolve.ts";

// Stage 3: validate.
export {
  everyTokenTypeIsDecided,
  validateTokens,
} from "./pipeline/validate.ts";
export { validatePaletteFacet, validateSpacingFacet, validateTheme } from "./contract/validate-theme.ts";
export type {
  ThemeReport,
  ValidateThemeOptions,
} from "./contract/validate-theme.ts";
export { compose } from "./compose.ts";
export { expandExtends, mergeThemeDocuments } from "./extends.ts";
export type { Composition, CompositionIssue } from "./compose.ts";
export { GATES, themeGate, themeGates } from "./contract/battery.ts";
export type {
  BatteryOptions,
  BatteryReport,
  GateName,
  GateResult,
} from "./contract/battery.ts";
export {
  BASE_ROLES,
  inkTokens,
  legibilityFloors,
  requiredPaths,
  themeSchema,
} from "./contract/roles.ts";
export { contractGroups, themeGroups } from "./contract/groups.ts";
export { ELEMENT_ROLES, elementPaths } from "./contract/elements.ts";
export type { ElementDeclaration } from "./contract/elements.ts";
export { ownedStyleFields, ownedStyleNames } from "./contract/typography.ts";
export type { NamedStyleField } from "./contract/typography.ts";
export { spinThemeJsonSchema, validateLegibility } from "./contract/schema.ts";
export { judgeComposedTree } from "./contract/composed.ts";
export {
  LOOP_DURATION,
  LOOP_FALLBACK,
  LOOP_STEP,
  STROBE_FLOOR_MS,
} from "./contract/motion.ts";
export type { LegibilityFloor, RoleDeclaration } from "./contract/roles.ts";

// Authoring: changing themes.
export {
  removeToken,
  renameToken,
  setToken,
  treeToJson,
} from "./authoring/mutate.ts";
export type { MutationError, MutationResult } from "./authoring/mutate.ts";
export { MUTATION_ERROR_CODES } from "./contract/errors.ts";
export type { MutationErrorCode } from "./contract/errors.ts";

// Stage 4: generate.
export {
  generateCss,
  generateThemeCss,
  generateTypes,
} from "./pipeline/generate.ts";

// Generated token types: the nested `Theme` rules read, the `ThemeType`
// typography tuples and `ThemeBorder` border tuples spend, and the flat
// `ThemeTokens` map with its path and custom-property unions. Re-exported
// here so Uno, StyleX, Flutter and Studio import them from
// `@spinjs/dev/theme` rather than reaching into the generated file.
export type {
  Theme,
  ThemeBorder,
  ThemeCssVar,
  ThemeTokenPath,
  ThemeTokens,
  ThemeType,
} from "./theme-types.d.ts";

// The uno theme: names derived from paths, values as references.
export { resolveTheme, type ResolvedTheme } from "./resolve-theme.ts";

// Procedures: the typed interface, owned by the module that implements it.
export { themeContract } from "./contract/contract.ts";
export { themeRouter } from "./contract/procedures.ts";

// Colour reading and contrast — what validation depends on.
export {
  contrastRatio,
  CSS_WIDE_COLORS,
  formatHex,
  isColor,
  parseColor,
  relativeLuminance,
  type Rgb,
  toHex,
} from "./pipeline/color.ts";

// Colour authoring — the toolbox for composing new colours.
export { generateScale, invertColor, mixColors } from "./authoring/color.ts";

// Brand authoring: the init flow's pure half — palette seeding, type
// suggestions, and sparse-write computation. Reads and writes live in
// `@spinjs/project`.
export { seedPalette, sparseLayer, suggestionFaces, typeSuggestions } from "./brand/index.ts";
export type { PaletteSeed, SeededPalette, TypeSuggestion } from "./brand/index.ts";

export {
  MODES,
  supportsDark,
  themeModes,
  treeInMode,
  valuesInMode,
} from "./modes.ts";
export type { Mode } from "./modes.ts";

export {
  baseDocument,
  designLanguageGroups,
  type DesignLanguageName,
  designLanguages,
  editorialLanguage,
  glassmorphicLanguage,
  isDesignLanguage,
  materialLanguage,
  minimalLanguage,
  neobrutalistLanguage,
  neumorphicLanguage,
} from "./languages/index.ts";
export {
  catppuccinPalette,
  compactSpacing,
  demoPalettes,
  demoSpacings,
  spaciousSpacing,
  terracottaPalette,
} from "./facets/index.ts";
