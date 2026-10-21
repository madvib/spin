/**
 * Spin lint — the enforcement layer.
 *
 * These are lints, not tests. A test asserts the library behaves; a lint
 * asserts that *authored code* stays inside the system. The distinction
 * matters: `packages/theme/tests` asks "does the button work", and this asks
 * "is anyone allowed to write this".
 *
 * This file is the oxlint adapter: the plugin oxlint loads, and the
 * package's entry point. The decisions live in `./core.ts` and know nothing
 * about a linter; the rules themselves live in `./rules.ts`, and the same
 * objects are what the ESLint plugin and the CLI run — so the three front
 * ends cannot drift apart.
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
