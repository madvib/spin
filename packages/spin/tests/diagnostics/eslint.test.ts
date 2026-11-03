import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { type ESLint, Linter } from "eslint";
import eslintPlugin, { plugin, rules } from "../../src/diagnostics/eslint.ts";
import { RULES } from "../../src/diagnostics/rules.ts";

/**
 * The plugin, as ESLint takes it.
 *
 * The plugin is a flat-config plugin: it goes into `plugins`, its rules
 * are named `spin/<rule>`, and its options are the rule's own — read the
 * ESLint way, from `context.options`. The rules are the very objects the
 * oxlint plugin ships, so the two linters cannot drift apart.
 */

/** The plugin, in ESLint's own types. A flat configuration takes it as it is. */
const typed: ESLint.Plugin = eslintPlugin;

/** The linter, in flat-config mode. */
function linter(): Linter {
  return new Linter({ configType: "flat" });
}

/** A configuration that reads JSX with ESLint's own parser. */
function config(
  rules: Linter.Config["rules"],
): Linter.Config {
  return {
    files: ["**/*.jsx"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { spin: typed },
    rules,
  };
}

test("the plugin carries the rules the oxlint plugin carries", () => {
  // One set of rules, two front ends: the names are the rules' public
  // vocabulary, and both linters answer to them.
  deepStrictEqual(Object.keys(rules), Object.keys(RULES));
  deepStrictEqual(Object.keys(typed.rules ?? {}), Object.keys(RULES));
});

test("a flat configuration takes the plugin and it reports", () => {
  // ESLint's own parser, ESLint's own flat config: the plugin is not
  // waiting for a particular parser to be useful.
  const messages = linter().verify(
    `<span className="not-a-class" />`,
    config({ "spin/closed-vocabulary": "error" }),
    "app.jsx",
  );
  deepStrictEqual(messages.map((message) => message.ruleId), [
    "spin/closed-vocabulary",
  ]);
  deepStrictEqual(messages.map((message) => message.messageId), ["unknown"]);
});

test("the dial reaches the rule through the linter's options", () => {
  // `strict` reads a type size as the element's own decision; `balanced`
  // reads it as a decision about content. The options travel the way ESLint
  // delivers them: as the rule's first option.
  const code = `<button className="text-sm bg-primary" />`;
  const strict = linter().verify(
    code,
    config({
      "spin/prefer-theme-value": ["error", { strictness: "strict" }],
    }),
    "app.jsx",
  );
  const balanced = linter().verify(
    code,
    config({
      "spin/prefer-theme-value": ["error", { strictness: "balanced" }],
    }),
    "app.jsx",
  );
  deepStrictEqual(strict.map((message) => message.message), [
    "the theme sets the size of `<button>`; `text-sm` fights it. Use the theme's value.",
    "`<button>` sets its own fill; `bg-primary` fights it. Use a variant (`bare`, `contrast`, …) or the theme's value.",
  ]);
  deepStrictEqual(balanced.map((message) => message.message), [
    "`<button>` sets its own fill; `bg-primary` fights it. Use a variant (`bare`, `contrast`, …) or the theme's value.",
  ]);
});

test("the plugin's edits are applied by ESLint's fixer", () => {
  // The rule offers the edit; ESLint's fixer applies it. The class the
  // theme cannot produce styles nothing, so dropping it changes nothing.
  const code = `<span className="not-a-class" />`;
  const result = linter().verifyAndFix(
    code,
    config({ "spin/closed-vocabulary": "error" }),
    "app.jsx",
  );
  deepStrictEqual(result.output, `<span className="" />`);
  deepStrictEqual(result.messages, []);
});

test("the recommended preset is a flat configuration", () => {
  // The preset is what a configuration spreads: the plugin and the five
  // rules, over the files the rules can read. The parser is the project's
  // own — ESLint's presets never choose one — so the configuration under
  // test brings its own.
  const messages = linter().verify(
    `<span className="not-a-class" />`,
    [
      {
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      },
      ...plugin.configs.recommended,
    ],
    "app.jsx",
  );
  deepStrictEqual(messages.map((message) => message.ruleId), [
    "spin/closed-vocabulary",
  ]);
});

test("the preset bans the override and only advises the wrong element", () => {
  // The stance, as a configuration reads it: a one-off override of a
  // decision the system made is an error, and the wrong element is a
  // warning — it cannot be banned.
  const rules = plugin.configs.recommended[0]?.rules;
  deepStrictEqual(rules?.["spin/prefer-theme-value"], "error");
  deepStrictEqual(rules?.["spin/prefer-element"], "warn");
});
