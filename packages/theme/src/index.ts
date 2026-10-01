/**
 * @spin/theme — DTCG JSON in, token trees out.
 *
 * The pipeline is parse, resolve, validate, and CSS variable emission — four
 * independent stages, and you can enter it at any of them. Finished elements
 * live in `@spin/primitives`, which consumes these trees; nothing here knows
 * components exist.
 *
 * CSS custom properties are the entire runtime API. Nothing here emits
 * JavaScript, and nothing here inlines a resolved value into a stylesheet: a
 * `{color.primary}` alias is emitted as `var(--color-primary)` so switching
 * themes is a selector swap rather than a rebuild.
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
export {
  BASE_ROLES,
  requiredPaths,
  spinThemeJsonSchema,
  themeSchema,
  validateLegibility,
} from "./contract/schema.ts";
export type { LegibilityFloor, RoleDeclaration } from "./contract/roles.ts";

// Stage 4: generate.
export {
  generateCss,
  generateThemeCss,
  generateTypes,
} from "./pipeline/generate.ts";

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
