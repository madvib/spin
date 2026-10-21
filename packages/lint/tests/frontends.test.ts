import { assertEquals } from "@std/assert";
import { dirname } from "node:path";
import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import {
  checkClosedVocabulary,
  checkNoHandwrittenTokens,
  checkNoRawColors,
  checkNoUnpairedInk,
  checkNoUtilitiesOnSemantic,
  type ClassFacts,
  type Facts,
  type Finding,
  type LiteralFacts,
  type SemanticOptions,
} from "../src/core.ts";
import { type CliFinding, lint } from "../src/cli.ts";
import eslintPlugin from "../src/eslint.ts";
import { factsForFile } from "../src/provider.ts";
import { renderMessage, type RuleName, RULES } from "../src/rules.ts";

/**
 * The three front ends, and the core, have to say the same thing.
 *
 * The core decides; oxlint, ESLint and the CLI deliver. If a delivery
 * differs from the decision, the difference is a bug in the delivery — and
 * a bug that only shows up in one linter is the worst kind, because the
 * project moves on and the gate that was supposed to hold it did not.
 *
 * So this runs one fixture through all four and holds them to each other:
 * the same rules, the same message ids, the same sentences, the same lines
 * and columns. The expectation is built from the core's own checks over
 * facts read off the fixture's text — not from a snapshot — so a change in
 * the rules moves both sides at once and only a disagreement shows.
 */

/** The fixture: a class attribute on each kind of element the rules read. */
const FIXTURE = `export function App() {
  return (
    <div className="flex gap-2">
      <button className="bg-primary p-4">Save</button>
      <p className="text-sm text-text-muted bg-accent">A paragraph</p>
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

/** The dials the semantic rule reads. */
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
  line: number;
  column: number;
}

/**
 * The elements the fixture declares, read off its text.
 *
 * Read from the text rather than from a parse tree, so the expectation is
 * built independently of the adapters under test.
 */
function elementsOf(source: string): Element[] {
  const out: Element[] = [];
  source.split("\n").forEach((line, index) => {
    const match = /<([a-z][a-z0-9]*)([^<>]*?\s)(class(?:Name)?="([^"]*)")/.exec(
      line,
    );
    if (match === null) return;
    out.push({
      tag: match[1] as string,
      classes: (match[4] as string).split(/\s+/).filter(Boolean),
      line: index + 1,
      // Where the attribute starts, which is where a linter reports it.
      column: (match.index ?? 0) + 1 + (match[1] as string).length +
        (match[2] as string).length,
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
    rule: "no-utilities-on-semantic",
    check: (facts, node) => checkNoUtilitiesOnSemantic(facts, node, STRICT),
  },
  {
    rule: "closed-vocabulary",
    check: (facts, node) => checkClosedVocabulary(facts, node),
  },
  {
    rule: "no-raw-colors",
    check: (facts, node) => checkNoRawColors(facts, node),
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
  const facts = factsForFile(file);
  const out: Canonical[] = [];
  for (const element of elementsOf(FIXTURE)) {
    const node: ClassFacts = {
      tag: element.tag,
      classes: element.classes,
      position: { line: element.line, column: element.column },
    };
    for (const { rule, check } of CHECKS) {
      const findings = rule === "no-utilities-on-semantic"
        ? checkNoUtilitiesOnSemantic(facts, node, semantic)
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

/* ---------------------------------------------------------------- eslint -- */

/** The rules, as an ESLint configuration writes them. */
function eslintConfig(semantic: SemanticOptions): Linter.Config {
  return {
    files: ["**/*.tsx"],
    languageOptions: { parser: tsParser },
    plugins: { spin: eslintPlugin },
    rules: {
      "spin/no-utilities-on-semantic": ["error", semantic],
      "spin/closed-vocabulary": "error",
      "spin/no-raw-colors": "error",
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

/* ----------------------------------------------------------------- oxlint -- */

/** The rules, as an oxlint configuration writes them. */
function oxlintConfig(semantic: SemanticOptions) {
  return {
    jsPlugins: [PLUGIN],
    rules: {
      "spin/no-utilities-on-semantic": ["error", semantic],
      "spin/closed-vocabulary": "error",
      "spin/no-raw-colors": "error",
      "spin/no-handwritten-tokens": "error",
      "spin/no-unpaired-ink": "error",
    },
  };
}

/**
 * The findings oxlint reports.
 *
 * oxlint is run for real: the plugin is loaded by the linter, over the
 * fixture, and its diagnostics are read back. Nothing here reaches into
 * the plugin's internals — what comes out is what a project would see.
 */
async function oxlintFindings(
  file: string,
  semantic: SemanticOptions,
): Promise<Canonical[]> {
  const config = `${file}.oxlintrc.json`;
  await Deno.writeTextFile(config, JSON.stringify(oxlintConfig(semantic)));
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      "npm:oxlint@1.85.0",
      "--config",
      config,
      "--format=json",
      file,
    ],
    cwd: PACKAGE,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await command.output();
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

/* ------------------------------------------------------------------- cli -- */

/** The findings the CLI reports. */
function cliFindings(
  file: string,
  semantic: SemanticOptions,
): Canonical[] {
  const { findings } = lint([file], {
    paths: [file],
    format: "text",
    semantic,
    rules: Object.keys(RULES) as RuleName[],
    help: false,
  });
  return ordered(findings.map((finding: CliFinding) => ({
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
  const directory = await Deno.makeTempDir();
  const file = `${directory}/app.tsx`;
  await Deno.writeTextFile(file, FIXTURE);
  return file;
}

Deno.test("oxlint, ESLint and the CLI report what the core decided", async () => {
  const file = await fixture();
  try {
    const core = coreFindings(file, STRICT);
    const oxlint = await oxlintFindings(file, STRICT);
    const eslint = eslintFindings(file, STRICT);
    const cli = cliFindings(file, STRICT);

    // oxlint reports the rule and the sentence; the other three report the
    // message id as well. The sentences carry the ids, so the sentences are
    // what the four are held to.
    const sentences = (findings: Canonical[]) =>
      findings.map((finding) => ({
        rule: finding.rule,
        message: finding.message,
        line: finding.line,
        column: finding.column,
      }));

    assertEquals(sentences(oxlint), sentences(core));
    assertEquals(sentences(eslint), sentences(core));
    assertEquals(sentences(cli), sentences(core));
  } finally {
    await Deno.remove(file, { recursive: true });
  }
});

Deno.test("the three front ends report the same message ids", async () => {
  const file = await fixture();
  try {
    const core = coreFindings(file, STRICT);
    const eslint = eslintFindings(file, STRICT);
    const cli = cliFindings(file, STRICT);
    const ids = (findings: Canonical[]) =>
      findings.map((finding) => ({
        rule: finding.rule,
        messageId: finding.messageId,
        line: finding.line,
        column: finding.column,
      }));
    assertEquals(ids(eslint), ids(core));
    assertEquals(ids(cli), ids(core));
  } finally {
    await Deno.remove(file, { recursive: true });
  }
});

Deno.test("the dials reach every front end", async () => {
  const file = await fixture();
  try {
    // `balanced` reads a type size as a decision about content rather than
    // about the element's own look: the paragraph's `text-sm` is free, and
    // the button's `bg-primary` is not.
    const core = coreFindings(file, BALANCED);
    const oxlint = await oxlintFindings(file, BALANCED);
    const eslint = eslintFindings(file, BALANCED);
    const cli = cliFindings(file, BALANCED);
    const sentences = (findings: Canonical[]) =>
      findings.map((finding) => ({
        rule: finding.rule,
        message: finding.message,
        line: finding.line,
        column: finding.column,
      }));
    assertEquals(sentences(oxlint), sentences(core));
    assertEquals(sentences(eslint), sentences(core));
    assertEquals(sentences(cli), sentences(core));
  } finally {
    await Deno.remove(file, { recursive: true });
  }
});
