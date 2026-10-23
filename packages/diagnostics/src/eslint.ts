/**
 * The ESLint plugin.
 *
 * The same five rules the oxlint plugin ships, under the same names, with
 * the same message ids, the same message text and the same options — read
 * the ESLint way, from `context.options`. A project that moves from oxlint
 * to ESLint changes its configuration and nothing else: the rules are the
 * same objects, not a second implementation that has to be kept in step.
 *
 * The plugin is a flat-config plugin: it is handed to `plugins`, and its
 * rules are named `spin/<rule>`, exactly as oxlint names them.
 *
 * The types are written out rather than imported from ESLint, so the
 * package carries no dependency on a linter it does not run — a consumer
 * who uses ESLint has ESLint's types already, and one who does not should
 * not have to install them to read a rule. The shapes below are what
 * ESLint's own types accept, and `tests/eslint.test.ts` holds the plugin
 * to that: it is run by the real ESLint, and the types are checked against
 * it.
 */

import {
  type GateNode,
  type GateRule,
  type GateSchema,
  RULE_NAMES,
  RULES,
} from "./rules.ts";

/**
 * The shape ESLint's flat config reads a rule in.
 *
 * The node and the context are `unknown` on purpose. ESLint's own types
 * name ESTree's node union, and spin's rules are written against the
 * little of it they read; `unknown` is what keeps this assignable to
 * ESLint's `RuleModule` without importing them.
 */
export interface EslintRule {
  readonly meta: {
    /**
     * What the rule is: a problem, or a suggestion.
     *
     * ESLint's own words, and the lint's own distinction: an override of a
     * decision the system made is a problem, and the wrong element is a
     * suggestion.
     */
    readonly type: "problem" | "suggestion";
    /** Whether the rule offers edits. ESLint refuses them without it. */
    readonly fixable?: "code";
    readonly docs: { readonly description: string };
    readonly schema: GateSchema[];
    readonly messages: Record<string, string>;
  };
  create(context: unknown): Record<string, (node: unknown) => void>;
}

/**
 * The shape ESLint's flat config reads a plugin in.
 *
 * `configs` holds flat config objects — the array form, which is what a
 * flat configuration spreads.
 */
export interface EslintPlugin {
  readonly meta: { readonly name: string; readonly version: string };
  readonly rules: Record<string, EslintRule>;
  configs: Record<string, EslintConfig[]>;
}

/** A flat config object, as far as the plugin's own preset needs one. */
export interface EslintConfig {
  readonly name?: string;
  readonly files?: string[];
  readonly plugins?: Record<string, EslintPlugin>;
  readonly rules?: Record<string, "error" | "warn" | "off">;
}

/**
 * The rules, in ESLint's shape.
 *
 * The one cast in this file is the boundary between the two worlds: the
 * rules are written against spin's own view of a node, and ESLint's types
 * describe ESTree's. What the rules do with a node — read a name, read a
 * value, read a position — is a subset of what ESLint's nodes offer, so
 * the cast holds; the test that runs the real ESLint over a fixture is
 * what proves it.
 */
export const rules = RULES as unknown as Record<string, EslintRule>;

/** Every rule's name, in the order the plugin declares them. */
export const ruleNames = RULE_NAMES;

/**
 * The plugin.
 *
 * `configs.recommended` is the preset: the rules, as errors, over the files
 * the rules can read — except the advisory one, which is a warning: the
 * wrong element cannot be banned, so it does not fail a run. A configuration
 * that wants a different set writes the rules out by name instead.
 */
export const plugin: EslintPlugin = {
  meta: { name: "spin", version: "0.1.0" },
  rules,
  configs: {},
};

plugin.configs.recommended = [
  {
    name: "spin/recommended",
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
    plugins: { spin: plugin },
    rules: {
      "spin/no-redundant-class": "error",
      "spin/prefer-theme-value": "error",
      "spin/prefer-element": "warn",
      "spin/closed-vocabulary": "error",
      "spin/no-handwritten-tokens": "error",
      "spin/no-unpaired-ink": "error",
    },
  },
];

/** The node shape the rules read, for a consumer writing their own. */
export type { GateNode, GateRule, GateSchema };

export default plugin;
