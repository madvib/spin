/**
 * The service: the diagnostics, as operations.
 *
 * A module owns its facts, so it owns the operations over them. This is
 * the front door of the package: two operations — the rules over a path,
 * and the rendered checks over a running app — and the answers they give.
 *
 * Neither operation writes. A finding carries the edit that settles it,
 * and applying that edit belongs to whoever holds the file: the editor's
 * fixer, the CLI's writer, the studio's panel. So what leaves this module
 * is data, all the way out.
 */

import type { Dirent, Stats } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { DEFAULT_SEMANTIC_OPTIONS, type SemanticOptions } from "./core.ts";
import {
  candidatesIn,
  warmVocabulary,
} from "./generated.ts";
import { forgetFacts, judgedRoot, themesRootOf } from "./provider.ts";
import { readProjectShortcuts } from "./shortcuts.ts";
import {
  type Diagnostic,
  lintMarkup,
  lintTree,
  parseFile,
  type RuleRun,
} from "./engine.ts";
import type { RenderedFinding, RenderedHarness } from "./check.ts";
import { RULE_NAMES, type RuleName } from "./rules.ts";
import type { EngineAnswers } from "./engine-types.ts";
import { themeGates } from "@spinjs/theme";

/* -------------------------------------------------------------- the view -- */

/**
 * A document a caller holds: the text on screen, not the text on disk.
 *
 * The studio's findings panel reports on what the editor holds; the
 * editor's linter reports on what is saved. So the lint can be handed the
 * text: the disk is read for the files the caller did not stage, and the
 * staged text is read for the ones it did.
 */
export interface StagedDocument {
  /** The file the text belongs to. */
  readonly path: string;
  /** The text the caller holds. */
  readonly text: string;
}

/**
 * What is being linted.
 *
 * The disk by default; a staged document when the caller holds the text
 * it wants read. The two are the same operation over different bytes —
 * the rules, the facts, the decisions — so a finding means the same thing
 * whichever the caller asked for.
 */
export type LintView =
  | { readonly kind: "disk" }
  | { readonly kind: "staged"; readonly documents: readonly StagedDocument[] };

/** The view that reads the disk. */
export const DISK: LintView = { kind: "disk" };

/* ------------------------------------------------------------ the options -- */

/** The dials the rules read. */
export interface LintOptions {
  /** The rules to run. */
  readonly rules?: readonly RuleName[];
  /** The dials the semantic rules read. */
  readonly semantic?: SemanticOptions;
  /** What the style engine answers. Defaults to the fallback: the checks abstain. */
  readonly answers?: EngineAnswers;
}

/* ------------------------------------------------------------- the report -- */

/** What the rules found. */
export interface LintReport {
  /** The findings, in the order the files were read. */
  readonly findings: readonly Diagnostic[];
  /** The files the lint could not read, or could not parse. */
  readonly unreadable: readonly string[];
  /** The paths the lint could not walk at all. */
  readonly missing: readonly string[];
}

/** What the rendered checks found. */
export interface CheckReport {
  /** The findings, in the order they were found. */
  readonly findings: readonly RenderedFinding[];
  /** The checks that found something. */
  readonly failed: readonly string[];
  /** The harness's verdict: 0 when the run passed. */
  readonly code: number;
}

/* ------------------------------------------------------------ the lint -- */

/** The files the CLI reads: the sources, and the markup beside them. */
const SOURCE = /\.(?:tsx?|jsx?|mjs|cjs|vue|svelte|astro|html?)$/;

/** The directories a scan does not walk into. */
const SKIPPED = new Set([
  ".git",
  ".output",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "public",
]);

/**
 * The files under a path.
 *
 * A path that names a file is that file; a path that names a directory is
 * everything under it the lint can read.
 */
export async function filesUnder(path: string): Promise<string[]> {
  const out: string[] = [];
  let stats: Stats;
  try {
    stats = await stat(path);
  } catch {
    return out;
  }
  if (stats.isFile()) return [path];
  if (!stats.isDirectory()) return out;
  const stack = [path];
  while (stack.length > 0) {
    const directory = stack.pop() as string;
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const child = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED.has(entry.name)) stack.push(child);
        continue;
      }
      if (SOURCE.test(entry.name)) {
        // An `index.html` is a document shell, not a component: the walk
        // leaves it out, while a path that names it directly is still read.
        if (entry.name === "index.html") continue;
        out.push(child);
        continue;
      }
      // A theme layer beside the sources: a brand's `tokens.json` or the
      // global `reference.json`. Anything else the shape does not serve is
      // not linted here — facets are validated on load, and stray files
      // owe nothing. A `.json` file handed over directly is already
      // included: a path that names a file is that file.
      if (
        entry.name.endsWith(".json") &&
        (entry.name === "tokens.json" || entry.name === "reference.json") &&
        (basename(directory) === "spin" || basename(dirname(directory)) === "spin")
      ) {
        out.push(child);
      }
    }
  }
  return out;
}

/**
 * The staged text for a file, when the caller holds any.
 *
 * The paths are compared as they resolve, so a caller may hand a path
 * absolute or relative and be understood either way.
 */
function stagedText(view: LintView, file: string): string | undefined {
  if (view.kind !== "staged") return undefined;
  const wanted = resolve(file);
  for (const document of view.documents) {
    if (resolve(document.path) === wanted) return document.text;
  }
  return undefined;
}

/** The text of a file, or undefined when it cannot be read. */
async function readText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * The rules over a path.
 *
 * The path is a file or a directory; the files read are the JavaScript
 * and the TypeScript ones. A file that cannot be read, or cannot be
 * parsed, is reported as such and does not stop the run.
 *
 * The `view` says what is being linted: the disk by default, or the text
 * a caller holds. A caller that stages a document gets the findings for
 * what it holds — the studio's panel reads the editor's unsaved text,
 * while the editor's linter reads what is on disk.
 */
export async function lint(
  path: string,
  view: LintView = DISK,
  options: LintOptions = {},
): Promise<LintReport> {
  const files = await filesUnder(path);
  const missing: string[] = [];
  if (files.length === 0) {
    // Nothing was read: either the path is not there, or it holds no
    // source at all. The two are told apart by the path itself.
    if (!await exists(path)) missing.push(path);
  }
  const report = await lintFiles(files, view, options);
  return { ...report, missing: [...report.missing, ...missing] };
}

/**
 * The rules over a set of files.
 *
 * The files are given rather than walked: a caller that knows which files
 * the project holds — the source, and not the documents beside it — asks
 * about those files.
 */
/**
 * What the style engine answers for the files being linted.
 *
 * The service is orchestration: it knows the files, so it fills the
 * engine's answers from the project they belong to. The checks consume
 * them; they never ask for them.
 */
async function serviceAnswers(files: readonly string[]): Promise<EngineAnswers> {
  const { engineAnswers } = await import("@spinjs/preset");
  const { designLanguages } = await import("@spinjs/theme");
  const { readProjectThemesAt } = await import("./project.ts");
  const first = files[0];
  const themes = first === undefined ? {} : readProjectThemesAt(themesRootOf(first));
  return engineAnswers([
    ...Object.values(designLanguages),
    ...Object.values(themes),
  ]);
}

/**
 * The vocabulary of the files' own projects, before they are judged.
 *
 * Grouped by project root: each project is judged by the classes its own
 * source declares, not by some other tree's. Shortcut expansions ride
 * along: a project that writes only `my-stack` still produces the
 * utilities it expands to. A project asked about before its classes
 * were known forgets its facts, so the next read takes the warmed
 * vocabulary.
 */
async function warmFiles(files: readonly string[]): Promise<void> {
  const byRoot = new Map<string, string[]>();
  for (const file of files) {
    const root = judgedRoot(file);
    const list = byRoot.get(root) ?? [];
    list.push(file);
    byRoot.set(root, list);
  }
  for (const [root, group] of byRoot) {
    const classes = await candidatesIn(group);
    const themesRoot = themesRootOf(group[0] as string);
    for (
      const parts of Object.values(readProjectShortcuts(themesRoot).shortcuts)
    ) {
      for (const part of parts) classes.add(part);
    }
    if (classes.size === 0) continue;
    await warmVocabulary(root, classes);
    forgetFacts(root);
  }
}

export async function lintFiles(
  files: readonly string[],
  view: LintView = DISK,
  options: LintOptions = {},
): Promise<LintReport> {
  // The vocabulary is the files' own before they are judged: a class a
  // file declares and the generator can make is not unknown. Warming here
  // (not at import) keeps the cost on the lint that needs it.
  await warmFiles(files);
  const run: RuleRun = {
    rules: options.rules ?? RULE_NAMES,
    semantic: options.semantic ?? DEFAULT_SEMANTIC_OPTIONS,
    answers: options.answers ?? (await serviceAnswers(files)),
  };
  const findings: Diagnostic[] = [];
  const unreadable: string[] = [];
  const missing: string[] = [];

  for (const file of files) {
    const code = stagedText(view, file) ?? await readText(file);
    if (code === undefined) {
      unreadable.push(file);
      continue;
    }
    // A theme document is judged by the battery, gate by gate: each gate's
    // issues land as their own findings, located at the token they name. A
    // brand layer is a fragment — the brand's own voice over its language —
    // so it owes soundness, never the parent's declarations: the required
    // set is empty inside a brand directory, the full contract elsewhere.
    if (file.endsWith(".json")) {
      const required = isBrandLayer(file) ? [] : undefined;
      findings.push(...lintTheme(file, code, required));
      continue;
    }
    // Markup is walked through the component syntax, not the module parser:
    // an `.html` file is a fragment the module parser cannot read, so it is
    // never handed to it.
    if (/\.(?:html?|vue|svelte|astro)$/.test(file)) {
      findings.push(...(await lintMarkup(file, code, run)));
      continue;
    }
    let ast;
    try {
      ast = parseFile(code, file);
    } catch {
      unreadable.push(file);
      continue;
    }
    findings.push(...lintTree(file, ast, run, code));
  }

  return { findings, unreadable, missing };
}

/**
 * Whether a theme file is a brand layer rather than a composed document.
 *
 * A brand directory holds the brand's own voice in `tokens.json`, and the
 * themes directory holds the global `reference.json` beside the brands —
 * each a fragment over the design language the brand names. Anything else
 * is a composed document, and owes the full contract.
 */
function isBrandLayer(file: string): boolean {
  const segments = file.split("/");
  const name = segments[segments.length - 1] as string;
  return name === "tokens.json" || name === "reference.json";
}

/**
 * The battery over one theme document, as findings.
 *
 * One finding per issue per gate, so the rule that said it is the finding's
 * own name: `spin/theme-scales` reads as the gate that failed. The required
 * set is the caller's: composed documents owe the full contract (absent),
 * brand layers owe nothing (`[]`).
 */
function lintTheme(
  file: string,
  code: string,
  required?: readonly string[],
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const report = themeGates(
    code,
    required !== undefined ? { required } : {},
  );
  for (const gateResult of report.gates) {
    for (const issue of gateResult.issues) {
      const at = locateIssue(code, issue.path);
      out.push({
        file,
        line: at.line,
        column: at.column,
        ruleId: `spin/theme-${gateResult.gate}`,
        messageId: gateResult.gate,
        message: issue.path ? `${issue.path}: ${issue.message}` : issue.message,
        severity: "error",
      });
    }
  }
  return out;
}

/**
 * The line and column of an issue's path in the document, counted from one.
 *
 * The last segment names the token, so that is what is located: the line
 * carrying `"step":` and the column it starts on. Absent (a parse error,
 * a document-level complaint), the finding sits at the start of the file.
 */
function locateIssue(
  code: string,
  path: string,
): { line: number; column: number } {
  if (!path) return { line: 1, column: 1 };
  const last = path.split(".").at(-1) as string;
  const lines = code.split("\n");
  for (let at = 0; at < lines.length; at++) {
    const line = lines[at] as string;
    const column = line.indexOf(`"${last}"`);
    if (column !== -1) return { line: at + 1, column: column + 1 };
  }
  return { line: 1, column: 1 };
}

/** Whether a path is there. */
async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------ the check -- */

/**
 * The rendered checks, over a running app.
 *
 * The checks are the harness's: it is what knows how to ask a browser
 * what it painted, and it holds the app's own facts. So the harness is
 * handed in and called — the service never looks at a page itself,
 * because a second set of eyes would be a second set of answers.
 */
export async function check(
  url: string,
  harness: RenderedHarness,
): Promise<CheckReport> {
  const run = await harness.run(url);
  const failed: string[] = [];
  for (const finding of run.findings) {
    if (!failed.includes(finding.check)) failed.push(finding.check);
  }
  return { findings: run.findings, failed, code: run.code };
}
