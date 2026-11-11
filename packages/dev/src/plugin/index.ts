/**
 * The bundler surface: the composed plugin over the build stages.
 *
 * The stages themselves live in `@spinjs/build`; this index is the
 * composer's, naming the plugin and re-exporting the stages it stands on.
 */
export {
  SPIN_COMPONENTS_ID,
  type SpinComponentsOptions,
  spinComponentsStage,
  tagForProjectFile,
} from "@spinjs/build";
export {
  candidatesInFile,
  checkStrictClasses,
  type DeadClass,
  deadClasses,
  formatStrictClassesError,
  nearestSuggestion,
  suggestFor,
  type StrictClassesInput,
} from "@spinjs/build";
export {
  type ContentMap,
  type ContentOptions,
  expandBraces,
  globFiles,
  isIncluded,
  joinContent,
  scanContent,
} from "@spinjs/build";
export {
  analyzeCrossTheme,
  type CrossThemeGap,
  type CrossThemeReport,
  crossThemeJson,
  CROSS_THEME_DEFINITION,
  formatCrossThemeText,
} from "@spinjs/build";
export { spin, type SpinPluginOptions } from "./plugin.ts";
export type { DevServer } from "./plugin.ts";
