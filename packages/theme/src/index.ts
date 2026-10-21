/**
 * @spin/theme — DTCG JSON in, token trees out.
 *
 * The pipeline is parse, resolve, validate, and CSS variable emission — four
 * independent stages, and you can enter it at any of them. Finished elements
 * live in the preset's rules, which spend these trees; nothing here knows
 * components exist.
 *
 * A token's name is derived from its path, once. `themeRef` builds the object
 * uno resolves against, with `var(--color-primary)` as the value of
 * `color.primary`, and `generateCss` emits that same name into the stylesheet.
 * Nothing downstream spells a custom property by hand, so a rename cannot leave
 * a rule pointing at nothing.
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
export { validateTheme } from "./contract/validate-theme.ts";
export type {
  ThemeReport,
  ValidateThemeOptions,
} from "./contract/validate-theme.ts";
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
export {
  ELEMENT_ROLES,
  elementFallback,
  elementPaths,
  elementRole,
} from "./contract/elements.ts";
export type { ElementDeclaration } from "./contract/elements.ts";
export { spinThemeJsonSchema, validateLegibility } from "./contract/schema.ts";
export {
  LOOP_DURATION,
  LOOP_FALLBACK,
  STROBE_FLOOR_MS,
} from "./contract/motion.ts";
export type { LegibilityFloor, RoleDeclaration } from "./contract/roles.ts";

// Authoring: changing and creating themes.
export { scaffoldTheme } from "./authoring/scaffold.ts";
export {
  removeToken,
  renameToken,
  setToken,
  treeToJson,
} from "./authoring/mutate.ts";
export type {
  MutationError,
  MutationErrorCode,
  MutationResult,
} from "./authoring/mutate.ts";

// Stage 4: generate.
export {
  generateCss,
  generateThemeCss,
  generateTypes,
} from "./pipeline/generate.ts";

// The uno theme: names derived from paths, values as references.
export { themeKey, themeRef } from "./uno-ref.ts";
export type { ThemeRef } from "./uno-ref.ts";

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
} from "./pipeline/color.ts";

// Colour authoring — the toolbox for composing new colours.
export { generateScale, invertColor, mixColors } from "./authoring/color.ts";

export {
  MODES,
  supportsDark,
  themeModes,
  treeInMode,
  valuesInMode,
} from "./modes.ts";
export type { Mode } from "./modes.ts";
