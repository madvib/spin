/**
 * Spin diagnostics — the domain of what is wrong with this code.
 *
 * Two halves. The lints read the source: rules that ask whether authored
 * markup stays inside the system — a class the theme cannot produce, a
 * decision the theme already made, an ink the palette does not pair. The
 * rendered checks read the page: contrast in every state, geometry, a
 * console with something thrown into it. Both answer the same question —
 * what is wrong here, and how do I fix it — and both are delivered as
 * findings with the edit that settles them.
 *
 * This file is the oxlint adapter: the plugin oxlint loads, and the
 * package's entry point. The decisions live in `./core.ts` and know
 * nothing about a linter; the rules themselves live in `./rules.ts`, and
 * the same objects are what the ESLint plugin, the CLI and the service
 * run — so the four front ends cannot drift apart. The service lives in
 * `./service.ts`, and it is the same core underneath.
 *
 * What each rule needs to know about the vocabulary comes from
 * `@spin/theme` and `@spin/preset` rather than being duplicated here, so a
 * rename cannot leave the gate enforcing a vocabulary that no longer
 * exists.
 */

import { RULES } from "./rules.ts";

export * from "./core.ts";
export { factsFor, projectFacts } from "./facts.ts";
export { findProjectRoot, readProjectThemes } from "./project.ts";
export { factsForFile, rootOf } from "./provider.ts";
export {
  findConfigRoot,
  noShortcuts,
  readProjectShortcuts,
  type ShortcutDeclaration,
} from "./shortcuts.ts";
export { decisionOf, type Tier, TIER_BY_GROUP, tierInPlace } from "./tiers.ts";
export {
  type Decision,
  isSpacing,
  isTypography,
  sameValue,
  TYPOGRAPHY,
} from "./properties.ts";
export { type Surfaces, surfacesFor } from "./surface.ts";
export {
  type GateContext,
  type GateFix,
  type GateMeta,
  type GateNode,
  type GateRule,
  type GateSchema,
  renderMessage,
  RULE_NAMES,
  type RuleName,
  RULES,
} from "./rules.ts";
export {
  applyFixes,
  type Diagnostic,
  lintTree,
  parseFile,
  type RuleRun,
} from "./engine.ts";
export {
  check,
  DISK,
  filesUnder,
  lint,
  lintFiles,
  type LintOptions,
  type LintReport,
  type LintView,
  type StagedDocument,
} from "./service.ts";
export {
  type ClassAttribute,
  classAttributesOf,
  type ClassOrder,
  classOrderOf,
  orderedClasses,
  type Repetition,
  repetitionsOf,
  sheetOrder,
  suggestShortcutName,
} from "./corpus.ts";
export {
  applyFix,
  applyOrder,
  type ClassOrderFile,
  corpus,
  type CorpusReport,
  declareShortcut,
  type FindingsReport,
  type FixIdentity,
  type FixOutcome,
  lintSource,
  type ProjectFinding,
  type RuleGroup,
  type ShortcutOutcome,
  sourceFiles,
} from "./source.ts";
export {
  type CheckConfig,
  type CheckName,
  type CheckRoute,
  type FrameState,
  type GeometryClaim,
  type PageAdapter,
  type RenderedFinding,
  type RenderedHarness,
  type RenderedRun,
  type SubjectState,
} from "./check.ts";
export {
  findHarness,
  workspaceHarness,
  type WorkspaceHarnessOptions,
} from "./workspace.ts";

/**
 * The plugin, as oxlint's JavaScript plugin API reads it.
 *
 * The rules are named `spin/<rule>` in a configuration. The ESLint plugin
 * in `./eslint.ts` is the same rules under the same names; only the shape
 * around them differs.
 */
export default {
  meta: { name: "spin" },
  rules: RULES,
};
