import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { dirname, join } from "node:path";
import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import {
  checkClosedVocabulary,
  checkNoHandwrittenTokens,
  checkNoRedundantClass,
  checkNoUnpairedInk,
  checkPreferElement,
  checkPreferThemeValue,
  type ClassFacts,
  type ClassToken,
  type Facts,
  type Finding,
  type LiteralFacts,
  type SemanticOptions,
} from "../src/core.ts";
import { applyFixes, type Diagnostic } from "../src/engine.ts";
import { run } from "@spinjs/spin/cli";
import eslintPlugin from "../src/eslint.ts";
import { engineAnswers } from "@spinjs/preset";
import { starterThemes } from "@spinjs/theme/themes";
import { factsForFile } from "../src/provider.ts";
import { readProjectThemes } from "../src/project.ts";
import { rootOf } from "../src/provider.ts";
import { renderMessage, type RuleName, RULES } from "../src/rules.ts";
import { lint } from "../src/service.ts";

/**
 * The front ends, and the core, have to say the same thing.
 *
 * The core decides; oxlint, ESLint, the CLI and the service deliver. If a
 * delivery differs from the decision, the difference is a bug in the
 * delivery — and a bug that only shows up in one linter is the worst kind,
 * because the project moves on and the gate that was supposed to hold it
 * did not.
 *
 * So this runs one fixture through all five and holds them to each other:
 * the same rules, the same message ids, the same sentences, the same lines
 * and columns — and the same EDITS, because a rule that can drop a class
 * has to drop it the same way wherever it is delivered. The expectation is
 * built from the core's own checks over facts read off the fixture's text —
 * not from a snapshot — so a change in the rules moves both sides at once
 * and only a disagreement shows.
 */

/** The fixture: a class attribute on each kind of element the rules read. */
const FIXTURE = `export function App() {
  return (
    <div className="flex gap-2">
      <button className="bg-primary p-4">Save</button>
      <h2 className="text-xl">A heading</h2>
      <span className="text-3xl">big</span>
      <span className="not-a-class">plain</span>
      <em style="color: var(--color-text)" />
      <i className={\`var(--color-text)\`} />
    </div>
  );
}
`;

/** The plugin oxlint loads. */
const PLUGIN = new URL("../src/index.ts", import.meta.url).pathname;

/** The package, whose import map the oxlint plugin is resolved against. */
const PACKAGE = new URL("../", import.meta.url).pathname;

/** The dials the semantic rules read. */
const STRICT: SemanticOptions = { strictness: "strict", semanticTags: "all" };
const BALANCED: SemanticOptions = {
  strictness: "balanced",
  semanticTags: "all",
};

/** One finding, as every front end reports it. */
interface Canonical {
  /** The rule's name, without the plugin's. */
  rule: string;
  /** The message id the rule reported under. */
  messageId: string;
  /** The sentence the message id stands for. */
  message: string;
  /** The line, counted from one. */
  line: number;
  /** The column, counted from one. */
  column: number;
}

/** The findings, in the order a reader would read them. */
function ordered(findings: Canonical[]): Canonical[] {
  return findings.toSorted((a, b) =>
    a.line - b.line || a.column - b.column ||
    a.rule.localeCompare(b.rule) ||
    a.messageId.localeCompare(b.messageId)
  );
}

/* ------------------------------------------------------------ the fixture -- */

/** One element of the fixture, read off its text. */
interface Element {
  tag: string;
  classes: string[];
  /** Whether the class list is a string literal (fixable) or a template. */
  literal: boolean;
  line: number;
  column: number;
  /** Where the class list starts in the source. */
  valueStart: number;
}
/**
 * The elements the fixture declares, read off its text.
 *
 * Read from the text rather than from a parse tree, so the expectation is
 * built independently of the adapters under test. The offsets are read the
 * same way: the class list starts after the quote that opens it, and each
 * class sits where the text says it sits.
 */
function elementsOf(source: string): Element[] {
  const out: Element[] = [];
  let at = 0;
  source.split("\n").forEach((line, index) => {
    const start = at;
    at += line.length + 1;
    const quoted =
      /<([a-z][a-z0-9]*)([^<>]*?\s)(class(?:Name)?="([^"]*)")/.exec(line);
    // A template literal names the same classes the adapters read from the
    // expression — without it the core expects nothing where every front end
    // reports the unknown class.
    const template =
      /<([a-z][a-z0-9]*)([^<>]*?\s)(class(?:Name)?=\{`([^`]*)`\})/.exec(line);
    const match = quoted ?? template;
    if (match === null) return;
    const attribute = match[3] as string;
    const name = attribute.slice(0, attribute.indexOf("="));
    const literal = quoted !== null;
    out.push({
      tag: match[1] as string,
      classes: (match[4] as string).split(/\s+/).filter(Boolean),
      literal,
      line: index + 1,
      // Where the attribute starts, which is where a linter reports it.
      column: (match.index ?? 0) + 1 + (match[1] as string).length +
        (match[2] as string).length,
      // Where the class list starts: after the name, the `=` and the quote —
      // or the `={` and the backtick for a template.
      valueStart: start + (match.index ?? 0) + 1 + (match[1] as string).length +
        (match[2] as string).length + name.length + (literal ? 2 : 3),
    });
  });
  return out;
}

/** One string the fixture holds in a markup position. */
interface Literal {
  text: string;
  line: number;
  column: number;
}

/**
 * The strings the fixture holds in markup positions, read off its text.
 *
 * Read from the text rather than from a parse tree, so the expectation is
 * built independently of the adapters under test. A markup attribute holds
 * its value in a quote or in a backtick, and the finding lands on that
 * quote — which is where the string the rule read starts.
 */
function markupStringsOf(source: string): Literal[] {
  const out: Literal[] = [];
  source.split("\n").forEach((line, index) => {
    const quoted = /(?:class|className|style)="([^"]*)"/g;
    let match = quoted.exec(line);
    while (match !== null) {
      out.push({
        text: match[1] as string,
        line: index + 1,
        column: match.index + match[0].indexOf('"'),
      });
      match = quoted.exec(line);
    }
    const template = /(?:class|className|style)=\{`([^`]*)`\}/g;
    match = template.exec(line);
    while (match !== null) {
      out.push({
        text: match[1] as string,
        line: index + 1,
        column: match.index + match[0].indexOf("`"),
      });
      match = template.exec(line);
    }
  });
  return out;
}

/* --------------------------------------------------------------- the core -- */

/** The checks the core makes, by the rule that makes them. */
const CHECKS: readonly {
  rule: RuleName;
  check: (facts: Facts, node: ClassFacts) => Finding[];
}[] = [
  {
    rule: "no-redundant-class",
    check: (facts, node) => checkNoRedundantClass(facts, node, STRICT),
  },
  {
    rule: "prefer-theme-value",
    check: (facts, node) => checkPreferThemeValue(facts, node, STRICT),
  },
  {
    rule: "prefer-element",
    check: (facts, node) => checkPreferElement(facts, node, STRICT),
  },
  {
    rule: "closed-vocabulary",
    check: (facts, node) => checkClosedVocabulary(facts, node),
  },
  {
    rule: "no-unpaired-ink",
    check: (facts, node) => checkNoUnpairedInk(facts, node),
  },
];

/** A finding, as the core's own words and position. */
function canonical(
  rule: RuleName,
  finding: Finding,
  position: { line: number; column: number },
): Canonical {
  return {
    rule,
    messageId: finding.messageId,
    message: renderMessage(RULES[rule].meta, finding),
    line: position.line,
    // The core counts columns from zero; every linter counts them from one.
    column: position.column + 1,
  };
}

/**
 * The findings the core makes about the fixture.
 *
 * The facts are the ones the front ends read — the same provider, the same
 * project — so the only thing being compared is the decision.
 */
function coreFindings(file: string, semantic: SemanticOptions): Canonical[] {
  const root = rootOf(file) ?? "";
  const facts = factsForFile(file, engineAnswers([...Object.values(starterThemes), ...Object.values(readProjectThemes(root))]));
  const out: Canonical[] = [];
  for (const element of elementsOf(FIXTURE)) {
    const node: ClassFacts = {
      tag: element.tag,
      classes: element.classes,
      position: { line: element.line, column: element.column },
    };
    for (const { rule, check } of CHECKS) {
      const findings = rule === "no-redundant-class"
        ? checkNoRedundantClass(facts, node, semantic)
        : rule === "prefer-theme-value"
        ? checkPreferThemeValue(facts, node, semantic)
        : rule === "prefer-element"
        ? checkPreferElement(facts, node, semantic)
        : check(facts, node);
      for (const finding of findings) {
        out.push(canonical(rule, finding, node.position));
      }
    }
  }
  for (const literal of markupStringsOf(FIXTURE)) {
    const node: LiteralFacts = {
      text: literal.text,
      position: { line: literal.line, column: literal.column },
    };
    for (const finding of checkNoHandwrittenTokens(facts, node)) {
      out.push(canonical("no-handwritten-tokens", finding, node.position));
    }
  }
  return ordered(out);
}

/* ----------------------------------------------------------------- fixes -- */

/** One edit, as the core decided it. */
interface Edit {
  readonly range: readonly [number, number];
  readonly text: string;
}

/**
 * The edits the core offers, over the fixture.
 *
 * Read from the same facts the front ends read, so the edits are the
 * decision rather than a copy of it.
 */
function coreEdits(file: string): Edit[] {
  const root = rootOf(file) ?? "";
  const facts = factsForFile(file, engineAnswers([...Object.values(starterThemes), ...Object.values(readProjectThemes(root))]));
  const out: Edit[] = [];
  for (const element of elementsOf(FIXTURE)) {
    const node: ClassFacts = {
      tag: element.tag,
      classes: element.classes,
      tokens: tokensOf(element),
      position: { line: element.line, column: element.column },
    };
    for (const finding of checkNoRedundantClass(facts, node, STRICT)) {
      if (finding.fix !== undefined) out.push(finding.fix);
    }
    for (const finding of checkClosedVocabulary(facts, node)) {
      if (finding.fix !== undefined) out.push(finding.fix);
    }
  }
  return out;
}

/**
 * Where each class of an element sits, read off the fixture's text.
 *
 * The same facts the adapters read: the class's own text in the source,
 * and whether a space sits against it.
 */
function tokensOf(element: Element): ClassToken[] {
  // A template literal carries no literal the fixer can rewrite: the adapters
  // report the finding without an edit, and so does the core.
  if (!element.literal) return [];
  const value = element.classes.join(" ");
  const out: ClassToken[] = [];
  let at = 0;
  for (const name of element.classes) {
    const from = value.indexOf(name, at);
    out.push({
      name,
      range: [
        element.valueStart + from,
        element.valueStart + from + name.length,
      ],
      spaceBefore: from > 0,
      spaceAfter: from + name.length < value.length,
    });
    at = from + name.length;
  }
  return out;
}

/** The fixture with the core's edits applied. */
function patched(file: string): string {
  return applyFixes(
    FIXTURE,
    coreEdits(file) as {
      range: [number, number];
      text: string;
    }[],
  ).code;
}

/* ---------------------------------------------------------------- eslint -- */

/** The rules, as an ESLint configuration writes them. */
function eslintConfig(semantic: SemanticOptions): Linter.Config {
  return {
    files: ["**/*.tsx"],
    languageOptions: { parser: tsParser },
    plugins: { spin: eslintPlugin },
    rules: {
      "spin/no-redundant-class": ["error", semantic],
      "spin/prefer-theme-value": ["error", semantic],
      "spin/prefer-element": ["error", semantic],
      "spin/closed-vocabulary": "error",
      "spin/no-handwritten-tokens": "error",
      "spin/no-unpaired-ink": "error",
    },
  };
}

/** The findings ESLint reports. */
function eslintFindings(
  file: string,
  semantic: SemanticOptions,
): Canonical[] {
  // ESLint reads a flat configuration against the files under its working
  // directory, so the linter is pointed at the fixture's own.
  const linter = new Linter({ configType: "flat", cwd: dirname(file) });
  const messages = linter.verify(FIXTURE, eslintConfig(semantic), file);
  return ordered(
    messages.map((message) => ({
      rule: (message.ruleId ?? "").replace("spin/", ""),
      messageId: message.messageId ?? "",
      message: message.message,
      line: message.line,
      column: message.column,
    })),
  );
}

/** The fixture as ESLint's fixer leaves it, in a single pass. */
function eslintFixed(file: string): string {
  // verifyAndFix runs up to ten passes: a replacement one rule writes is
  // re-linted, and a second rule's fix can fire on it, converging past the
  // core's single-pass decision. The comparison is fix delivery, not
  // convergence, so one pass of the reported fixes is applied.
  const linter = new Linter({ configType: "flat", cwd: dirname(file) });
  const messages = linter.verify(FIXTURE, eslintConfig(STRICT), file);
  const fixes = messages.flatMap((message) =>
    message.fix === undefined ? [] : [message.fix]
  );
  return applyFixes(FIXTURE, fixes).code;
}

/* ----------------------------------------------------------------- oxlint -- */

/** The rules, as an oxlint configuration writes them. */
function oxlintConfig(semantic: SemanticOptions) {
  return {
    jsPlugins: [PLUGIN],
    rules: {
      "spin/no-redundant-class": ["error", semantic],
      "spin/prefer-theme-value": ["error", semantic],
      "spin/prefer-element": ["error", semantic],
      "spin/closed-vocabulary": "error",
      "spin/no-handwritten-tokens": "error",
      "spin/no-unpaired-ink": "error",
    },
  };
}

/**
 * The findings oxlint reports.
 *
 * oxlint is run for real: the plugin is loaded by the linter, over the
 * fixture, and its diagnostics are read back. Nothing here reaches into the
 * plugin's internals — what comes out is what a project would see.
 */
async function oxlintFindings(
  file: string,
  semantic: SemanticOptions,
): Promise<Canonical[]> {
  const config = `${file}.oxlintrc.json`;
  await writeFile(config, JSON.stringify(oxlintConfig(semantic)));
  const proc = Bun.spawn(["bunx", "oxlint@1.85.0", "--config", config, "--format=json", file], {
    cwd: PACKAGE,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).arrayBuffer(),
    new Response(proc.stderr).arrayBuffer(),
    proc.exited,
  ]);
  // oxlint exits 1 when it has something to report; anything else is a
  // failure of the run itself.
  if (code > 1) {
    throw new Error(
      `oxlint exited with ${code}: ${new TextDecoder().decode(stderr)}`,
    );
  }
  const text = new TextDecoder().decode(stdout);
  const report = JSON.parse(text.slice(text.indexOf("{"))) as {
    diagnostics: {
      message: string;
      code: string;
      labels: { span: { line: number; column: number } }[];
    }[];
  };
  const out: Canonical[] = [];
  for (const diagnostic of report.diagnostics) {
    if (!diagnostic.code.startsWith("spin(")) continue;
    const span = diagnostic.labels[0]?.span;
    if (span === undefined) continue;
    out.push({
      rule: diagnostic.code.slice("spin(".length, -1),
      // oxlint reports the rule and the sentence; the message id is the
      // rule's own, and the sentence names it.
      messageId: "",
      message: diagnostic.message,
      line: span.line,
      column: span.column,
    });
  }
  return ordered(out);
}

/**
 * The fixture as oxlint's fixer leaves it.
 *
 * oxlint is run for real, over a copy of the fixture, with its own fix
 * flag: what comes back is the file the project would have.
 */
async function oxlintFixed(file: string): Promise<string> {
  const config = `${file}.oxlintrc.json`;
  await writeFile(config, JSON.stringify(oxlintConfig(STRICT)));
  const command = Bun.spawn(["bunx", "oxlint@1.85.0", "--config", config, "--fix", file], {
    cwd: PACKAGE,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stderr, code] = await Promise.all([
    new Response(command.stderr).arrayBuffer(),
    command.exited,
  ]);
  if (code > 1) {
    throw new Error(
      `oxlint exited with ${code}: ${new TextDecoder().decode(stderr)}`,
    );
  }
  return await readFile(file, "utf8");
}

/* ------------------------------------------------------------------- cli -- */

/** The findings the CLI reports. */
async function cliFindings(
  file: string,
  semantic: SemanticOptions,
): Promise<Canonical[]> {
  // The CLI is driven the way a project drives it: the command line, and
  // the answer it prints. The JSON format is the machine's answer.
  const lines: string[] = [];
  await run(
    ["lint", "--format", "json", "--strictness", semantic.strictness, file],
    (line) => lines.push(line),
  );
  const report = JSON.parse(lines.join("\n")) as { findings: Diagnostic[] };
  return ordered(report.findings.map((finding) => ({
    rule: finding.ruleId.replace("spin/", ""),
    messageId: finding.messageId,
    message: finding.message,
    line: finding.line,
    column: finding.column,
  })));
}

/* --------------------------------------------------------------- service -- */

/** The findings the service reports. */
async function serviceFindings(
  file: string,
  semantic: SemanticOptions,
): Promise<Canonical[]> {
  const { findings } = await lint(file, undefined, {
    rules: Object.keys(RULES) as RuleName[],
    semantic,
  });
  return ordered(findings.map((finding) => ({
    rule: finding.ruleId.replace("spin/", ""),
    messageId: finding.messageId,
    message: finding.message,
    line: finding.line,
    column: finding.column,
  })));
}

/* --------------------------------------------------------------- the tests -- */

/** A fixture on disk, with the oxlint configuration beside it. */
async function fixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  const file = `${directory}/app.tsx`;
  await writeFile(file, FIXTURE);
  return file;
}

test("oxlint, ESLint, the CLI and the service report what the core decided", async () => {
  const file = await fixture();
  try {
    const core = coreFindings(file, STRICT);
    const oxlint = await oxlintFindings(file, STRICT);
    const eslint = eslintFindings(file, STRICT);
    const cli = await cliFindings(file, STRICT);
    const service = await serviceFindings(file, STRICT);

    // oxlint reports the rule and the sentence; the other four report the
    // message id as well. The sentences carry the ids, so the sentences are
    // what the five are held to.
    const sentences = (findings: Canonical[]) =>
      findings.map((finding) => ({
        rule: finding.rule,
        message: finding.message,
        line: finding.line,
        column: finding.column,
      }));

    deepStrictEqual(sentences(oxlint), sentences(core));
    deepStrictEqual(sentences(eslint), sentences(core));
    deepStrictEqual(sentences(cli), sentences(core));
    deepStrictEqual(sentences(service), sentences(core));
  } finally {
    await rm(file, { recursive: true });
  }
});

test("the front ends report the same message ids", async () => {
  const file = await fixture();
  try {
    const core = coreFindings(file, STRICT);
    const eslint = eslintFindings(file, STRICT);
    const cli = await cliFindings(file, STRICT);
    const service = await serviceFindings(file, STRICT);
    const ids = (findings: Canonical[]) =>
      findings.map((finding) => ({
        rule: finding.rule,
        messageId: finding.messageId,
        line: finding.line,
        column: finding.column,
      }));
    deepStrictEqual(ids(eslint), ids(core));
    deepStrictEqual(ids(cli), ids(core));
    deepStrictEqual(ids(service), ids(core));
  } finally {
    await rm(file, { recursive: true });
  }
});

test("the front ends make the same edits", async () => {
  const file = await fixture();
  try {
    // The fixture, with the core's own edits applied: what every front end
    // has to arrive at when it delivers the decision.
    const expected = patched(file);
    const eslint = eslintFixed(file);

    // oxlint writes the file it fixes, so it is given a copy to write to.
    const copy = `${file}.copy.tsx`;
    await writeFile(copy, FIXTURE);
    const oxlint = await oxlintFixed(copy);
    await rm(copy);

    deepStrictEqual(eslint, expected);
    deepStrictEqual(oxlint, expected);
  } finally {
    await rm(file, { recursive: true });
  }
});

test("the service carries the edits the core decided", async () => {
  const file = await fixture();
  try {
    // The service does not write: the finding carries the edit, and the
    // caller applies it. So the edits the service offers are the core's,
    // and applying them settles the fixture the same way.
    const { findings } = await lint(file, undefined, {
      rules: Object.keys(RULES) as RuleName[],
      semantic: STRICT,
    });
    const edits = findings
      .map((finding) => finding.fix)
      .filter((fix): fix is NonNullable<typeof fix> => fix !== undefined);
    deepStrictEqual(
      applyFixes(FIXTURE, edits).code,
      patched(file),
    );
  } finally {
    await rm(file, { recursive: true });
  }
});

test("the dials reach every front end", async () => {
  const file = await fixture();
  try {
    // `balanced` reads a type size as a decision about content rather than
    // about the element's own look: the heading's `text-xl` is free, and
    // the button's `p-4` is not.
    const core = coreFindings(file, BALANCED);
    const oxlint = await oxlintFindings(file, BALANCED);
    const eslint = eslintFindings(file, BALANCED);
    const cli = await cliFindings(file, BALANCED);
    const service = await serviceFindings(file, BALANCED);
    const sentences = (findings: Canonical[]) =>
      findings.map((finding) => ({
        rule: finding.rule,
        message: finding.message,
        line: finding.line,
        column: finding.column,
      }));
    deepStrictEqual(sentences(oxlint), sentences(core));
    deepStrictEqual(sentences(eslint), sentences(core));
    deepStrictEqual(sentences(cli), sentences(core));
    deepStrictEqual(sentences(service), sentences(core));
  } finally {
    await rm(file, { recursive: true });
  }
});
