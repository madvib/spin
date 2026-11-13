import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { type ESLint, Linter } from "eslint";
import eslintPlugin, { plugin, rules } from "../src/eslint.ts";
import { RULES } from "../src/rules.ts";
import htmlParser from "@html-eslint/parser";
import * as tsParser from "@typescript-eslint/parser";
import * as vueParser from "vue-eslint-parser";
import * as svelteParser from "svelte-eslint-parser";

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
  // delivers them: as the rule's first option. TYPE-b: the style fights the
  // button's size the way the raw step did.
  const code = `<button className="type-body bg-primary" />`;
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
    "the theme sets the size of `<button>`; `type-body` fights it. Use the theme's value.",
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
  deepStrictEqual(result.output, `<span />`);
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

test("the preset covers templates as well as scripts", () => {
  // A configuration that spreads the preset lints its templates too: the
  // rules read class attributes however the parser spells them.
  const files = plugin.configs.recommended[0]?.files ?? [];
  for (const pattern of ["**/*.html", "**/*.vue", "**/*.svelte"]) {
    deepStrictEqual(files.includes(pattern), true);
  }
});

/**
 * The plugin, under every parser a project parses its templates with.
 *
 * The rules read structure, not parsers: a class attribute is a class
 * attribute whether JSX, vue, svelte, or html names it. Each parser below
 * walks the same two elements — a button fighting its fill, a span wearing
 * nothing — and each one reports the same two findings.
 */

/** A configuration that reads templates with the project's own parser. */
function parserConfig(
  pattern: string,
  parser: unknown,
  rules: Linter.Config["rules"],
): Linter.Config {
  return {
    files: [pattern],
    languageOptions: { parser: parser as Linter.Parser },
    plugins: { spin: typed },
    rules,
  };
}

const TEMPLATE_RULES: Linter.Config["rules"] = {
  "spin/prefer-theme-value": "error",
  "spin/closed-vocabulary": "error",
};

test("tsx, html, vue, and svelte report the same two findings", () => {
  const cases: readonly {
    readonly filename: string;
    readonly parser: unknown;
    readonly code: string;
  }[] = [
    {
      filename: "app.tsx",
      parser: tsParser,
      code: `export const App = () => <>
        <button className="bg-primary">Save</button>
        <span className="unknown-cls">plain</span>
      </>;`,
    },
    {
      filename: "app.html",
      parser: htmlParser,
      code: `<button class="bg-primary">Save</button><span class="unknown-cls">plain</span>`,
    },
    {
      filename: "app.vue",
      parser: vueParser,
      code: `<template><button class="bg-primary">Save</button><span class="unknown-cls">plain</span></template>`,
    },
    {
      filename: "app.svelte",
      parser: svelteParser,
      code: `<button class="bg-primary">Save</button><span class="unknown-cls">plain</span>`,
    },
  ];
  for (const { filename, parser, code } of cases) {
    const messages: Linter.LintMessage[] = linter().verify(
      code,
      parserConfig(`**/*.${filename.slice(filename.lastIndexOf(".") + 1)}`, parser, TEMPLATE_RULES),
      filename,
    );
    deepStrictEqual(
      messages.map((message) => [message.ruleId, message.messageId]),
      [
        ["spin/prefer-theme-value", "override"],
        ["spin/closed-vocabulary", "unknown"],
      ],
    );
  }
});

test("bound classes report what they name, not the binding", () => {
  const vue = linter().verify(
    `<template><span :class="{ 'unknown-cls': isOn }">plain</span></template>`,
    parserConfig("**/*.vue", vueParser, TEMPLATE_RULES),
    "app.vue",
  );
  deepStrictEqual(
    vue.map((message) => [message.ruleId, message.messageId]),
    [["spin/closed-vocabulary", "unknown"]],
  );
  deepStrictEqual(vue[0]?.message.includes("`unknown-cls`"), true);
  const svelte = linter().verify(
    `<span class:unknown-cls={isOn}>plain</span>`,
    parserConfig("**/*.svelte", svelteParser, TEMPLATE_RULES),
    "app.svelte",
  );
  deepStrictEqual(
    svelte.map((message) => [message.ruleId, message.messageId]),
    [["spin/closed-vocabulary", "unknown"]],
  );
  deepStrictEqual(svelte[0]?.message.includes("`unknown-cls`"), true);
});

test("the fixer's edits land inside foreign class lists", () => {
  const cases: readonly {
    readonly filename: string;
    readonly pattern: string;
    readonly parser: unknown;
    readonly code: string;
    readonly fixed: string;
  }[] = [
    {
      filename: "app.html",
      pattern: "**/*.html",
      parser: htmlParser,
      code: `<span class="flex unknown-cls gap-2">x</span>`,
      fixed: `<span class="flex gap-2">x</span>`,
    },
    {
      filename: "app.vue",
      pattern: "**/*.vue",
      parser: vueParser,
      code: `<template><span class="flex unknown-cls gap-2">x</span></template>`,
      fixed: `<template><span class="flex gap-2">x</span></template>`,
    },
    {
      filename: "app.svelte",
      pattern: "**/*.svelte",
      parser: svelteParser,
      code: `<span class="flex unknown-cls gap-2">x</span>`,
      fixed: `<span class="flex gap-2">x</span>`,
    },
  ];
  for (const { filename, pattern, parser, code, fixed } of cases) {
    const result: Linter.FixReport = linter().verifyAndFix(
      code,
      parserConfig(pattern, parser, TEMPLATE_RULES),
      filename,
    );
    deepStrictEqual(result.output, fixed);
    deepStrictEqual(result.messages, []);
  }
});
