/**
 * The build stages: everything a bundler run needs that is not the preset.
 *
 * The components stage, the strict gate over worn classes, the content
 * scan, and the cross-theme report. The plugin composes these; the LSP
 * reads the gate's suggestion half; nobody reaches past this index.
 */
export {
  SPIN_COMPONENTS_ID,
  type SpinComponentsOptions,
  spinComponentsStage,
  tagForProjectFile,
} from "./components-compiler.ts";
export {
  candidatesInFile,
  checkStrictClasses,
  type DeadClass,
  deadClasses,
  formatStrictClassesError,
  nearestSuggestion,
  suggestFor,
  type StrictClassesInput,
} from "./strict-classes.ts";
export {
  type ContentMap,
  type ContentOptions,
  expandBraces,
  globFiles,
  isIncluded,
  joinContent,
  scanContent,
} from "./content.ts";
export {
  analyzeCrossTheme,
  type CrossThemeGap,
  type CrossThemeReport,
  crossThemeJson,
  CROSS_THEME_DEFINITION,
  formatCrossThemeText,
} from "./cross-theme.ts";
