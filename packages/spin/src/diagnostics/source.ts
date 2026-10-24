/**
 * The project's source: the files the rules read, and the edits that settle
 * what they find.
 *
 * A project is a directory with a claim on it, and its source is the part of
 * it that is written in classes. This module is the operations over that
 * part: the findings the rules have about it, the edits that settle them,
 * and the two facts the corpus holds — the compositions the source repeats,
 * and the class lists that are not in the order the stylesheet writes them.
 *
 * The rules are the diagnostics' own; this module asks them. The files are
 * the project's own; this module asks the project where they are. What
 * leaves here is data: a finding, and the edit that settles it.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { starterThemes } from "../theme/themes/index.ts";
import type { ThemeDocument } from "../theme/index.ts";
import {
  type ClassAttribute,
  classAttributesOf,
  type ClassOrder,
  classOrderOf,
  type Repetition,
  repetitionsOf,
  sheetOrder,
} from "./corpus.ts";
import {
  applyFixes,
  type Diagnostic,
  lintMarkup,
  lintTree,
  parseFile,
} from "./engine.ts";
import { declaredClassesIn } from "./generated.ts";
import { forgetFacts, rootOf } from "./provider.ts";
import { readProjectThemes } from "./project.ts";
import { RULE_NAMES, type RuleName, RULES } from "./rules.ts";
import { DISK, lintFiles, type LintOptions } from "./service.ts";
import { warmVocabulary } from "./generated.ts";

/* ------------------------------------------------------------- the sources -- */

/** The files the lint reads: markup included, for the classes it carries. */
const SOURCE = /\.(?:tsx?|jsx?|mjs|cjs|html?)$/;

/**
 * The directories a walk does not go into.
 *
 * `spin` is the project's own directory: the themes in it are DOCUMENTS —
 * the project's vocabulary, not the source that spends it — so the lint has
 * nothing to say about them.
 */
const SKIPPED = new Set([
  ".git",
  ".output",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
  "spin",
]);

/**
 * The project's own source files.
 *
 * The whole project, walked: the source is wherever the author put it, and
 * a project that keeps it in `src/` and a project that keeps it at the root
 * are both projects.
 */
export async function sourceFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [resolve(root)];
  while (stack.length > 0) {
    const directory = stack.pop() as string;
    let entries: { name: string; isDirectory(): boolean }[];
    try {
      const { readdir } = await import("node:fs/promises");
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
      if (SOURCE.test(entry.name)) out.push(child);
    }
  }
  return out.toSorted();
}

/**
 * The project's vocabulary, warmed against its own source.
 *
 * The classes the preset produces beyond the catalog are the classes THIS
 * project writes, and the rules have to know them before they judge: a
 * class the project writes and the generator can make is not a class the
 * vocabulary has never heard of.
 */
async function warm(files: readonly string[]): Promise<void> {
  const byRoot = new Map<string, string[]>();
  for (const file of files) {
    const root = rootOf(file) ?? "";
    const list = byRoot.get(root) ?? [];
    list.push(file);
    byRoot.set(root, list);
  }
  for (const [root, group] of byRoot) {
    const classes = declaredClassesIn(group);
    if (classes.size === 0) continue;
    await warmVocabulary(root, classes);
    // The facts are read once and kept, and the vocabulary is one of the
    // things they are read from: a project asked about before its own
    // classes were known must be asked again.
    forgetFacts(root);
  }
}

/* ------------------------------------------------------------- the findings -- */

/** One finding, as the studio reads it. */
export interface ProjectFinding {
  /** The file, as the project spells it. */
  readonly file: string;
  /** The line, counted from one. */
  readonly line: number;
  /** The column, counted from one. */
  readonly column: number;
  /** The rule's name, as a configuration writes it. */
  readonly ruleId: string;
  /** The sentence the rule said it in. */
  readonly message: string;
  /** What to do about it, in the rule's own words. */
  readonly remedy: string | null;
  /** How bad it is: the rule's own stance. */
  readonly severity: "error" | "warning";
  /** Whether the rule's edit can be applied mechanically. */
  readonly fixable: boolean;
}

/**
 * The findings one rule has.
 *
 * A group is one rule's findings, and the rule is what groups them: the
 * same rule firing in five files is one problem with five instances, and
 * the way out of it is one kind of edit. Grouping by file instead would
 * answer "where is the mess", which is the second question; the first is
 * "what is wrong".
 */
export interface RuleGroup {
  /** The rule's name, as a configuration writes it. */
  readonly ruleId: string;
  /** What the rule says about itself. */
  readonly title: string;
  /** The findings, in the order the files were read. */
  readonly findings: readonly ProjectFinding[];
}

/** What the lints say about a project's source. */
export interface FindingsReport {
  /** The findings, grouped by the rule that said them. */
  readonly groups: readonly RuleGroup[];
  /** The files the lint could not read, or could not parse. */
  readonly unreadable: readonly string[];
  /** How many files the lint read. */
  readonly files: number;
}

/**
 * The lints over a project's own source.
 *
 * The findings carry the rule's own message and the rule's own remedy, and
 * the file they are in is the project's own spelling of it — a path a
 * developer reads does not carry the machine's filesystem layout.
 */
export async function lintSource(
  root: string,
  options: LintOptions = {},
): Promise<FindingsReport> {
  const files = await sourceFiles(root);
  await warm(files);
  const report = await lintFiles(files, DISK, options);
  const findings = report.findings.map((finding) =>
    projectFinding(finding, root)
  );
  return {
    groups: groupsOf(findings),
    unreadable: report.unreadable.map((file) => relative(root, file)),
    files: files.length,
  };
}

/** One finding, as the project spells it. */
function projectFinding(finding: Diagnostic, root: string): ProjectFinding {
  return {
    file: relative(root, finding.file),
    line: finding.line,
    column: finding.column,
    ruleId: finding.ruleId,
    message: finding.message,
    remedy: finding.remedy ?? null,
    severity: finding.severity,
    fixable: finding.fix !== undefined,
  };
}

/**
 * The findings, grouped by the rule that said them.
 *
 * The rules' own order breaks a tie: the biggest group first, and the
 * rules as the plugin declares them after that.
 */
function groupsOf(findings: readonly ProjectFinding[]): RuleGroup[] {
  const byRule = new Map<string, ProjectFinding[]>();
  for (const finding of findings) {
    const list = byRule.get(finding.ruleId) ?? [];
    list.push(finding);
    byRule.set(finding.ruleId, list);
  }
  const groups: RuleGroup[] = [];
  for (const [ruleId, list] of byRule) {
    groups.push({
      ruleId,
      title: titleOf(ruleId),
      findings: list,
    });
  }
  return groups.toSorted((a, b) =>
    b.findings.length - a.findings.length ||
    orderOfRule(a.ruleId) - orderOfRule(b.ruleId)
  );
}

/**
 * What the rule says about itself.
 *
 * The rule's own description: the group is the rule, and the rule's words
 * are what it says it is for.
 */
function titleOf(ruleId: string): string {
  const name = ruleId.slice("spin/".length) as RuleName;
  const rule = RULES[name];
  if (rule === undefined) return ruleId;
  return rule.meta.docs.description;
}

/** Where a rule sits in the plugin's own order. */
function orderOfRule(ruleId: string): number {
  const at = RULE_NAMES.indexOf(ruleId.slice("spin/".length) as never);
  return at === -1 ? RULE_NAMES.length : at;
}

/* ----------------------------------------------------------------- the fix -- */

/** Which finding a fix is about. */
export interface FixIdentity {
  /** The rule's name, as a configuration writes it. */
  readonly ruleId: string;
  /** The line the finding was on. */
  readonly line: number;
  /** The column the finding was on. */
  readonly column: number;
}

/** What a fix did. */
export interface FixOutcome {
  /** Whether the file changed. */
  readonly applied: boolean;
  /** Why it did not, when it did not. */
  readonly error: string | null;
  /** The file the fix landed in, as the project spells it. */
  readonly file: string | null;
  /** The file's text after the fix. */
  readonly text: string | null;
}

/**
 * Applies one finding's edit to the file it is in.
 *
 * The finding is looked up again before the edit is applied: a fix is
 * decided against the text as it stands, and the text may have moved since
 * the finding was reported. So the file is read, the rules are run over it
 * again, and the edit that settles THIS finding is the one that lands.
 *
 * A finding the rule cannot fix by hand says so, and nothing is written:
 * the author decides what the class should have been.
 */
export function applyFix(
  root: string,
  file: string,
  identity: FixIdentity,
): FixOutcome {
  const path = inside(root, file);
  if (path === undefined) {
    return {
      applied: false,
      error: `"${file}" is not in the project.`,
      file: null,
      text: null,
    };
  }
  let code: string;
  try {
    code = readFileSync(path, "utf8");
  } catch {
    return {
      applied: false,
      error: `Could not read "${file}".`,
      file: null,
      text: null,
    };
  }
  const found = findingsIn(path, code).find((finding) =>
    finding.ruleId === identity.ruleId && finding.line === identity.line &&
    finding.column === identity.column
  );
  if (found === undefined) {
    return {
      applied: false,
      error: `That finding is not in "${file}" any more.`,
      file: null,
      text: null,
    };
  }
  if (found.fix === undefined) {
    return {
      applied: false,
      error: "This finding has no mechanical fix.",
      file: null,
      text: null,
    };
  }
  const patched = applyFixes(code, [found.fix]).code;
  try {
    writeFileSync(path, patched, "utf8");
  } catch (error) {
    return {
      applied: false,
      error: error instanceof Error ? error.message : String(error),
      file: null,
      text: null,
    };
  }
  return {
    applied: true,
    error: null,
    file: relative(root, path),
    text: patched,
  };
}

/** The findings in one file's text. */
function findingsIn(file: string, code: string): Diagnostic[] {
  // Markup is walked through the component syntax, not the module parser:
  // an `.html` file is a fragment the module parser cannot read, so it is
  // never handed to it.
  if (file.endsWith(".html") || file.endsWith(".htm")) {
    return lintMarkup(file, code, {
      rules: RULE_NAMES,
      semantic: { strictness: "strict", semanticTags: "native" },
    });
  }
  try {
    return lintTree(file, parseFile(code, file), {
      rules: RULE_NAMES,
      semantic: { strictness: "strict", semanticTags: "native" },
    });
  } catch {
    return [];
  }
}

/* --------------------------------------------------------------- the corpus -- */

/** The class lists of one file that are not in the sheet's order. */
export interface ClassOrderFile {
  /** The file, as the project spells it. */
  readonly file: string;
  /** The class lists that are not in order. */
  readonly attributes: readonly ClassOrder[];
}

/** What the corpus holds about a project's source. */
export interface CorpusReport {
  /** The compositions the source repeats. */
  readonly repetition: readonly Repetition[];
  /** The files whose class lists are not in the sheet's order. */
  readonly order: readonly ClassOrderFile[];
}

/**
 * The corpus facts: what the source repeats, and what is not in order.
 *
 * Neither is a lint rule, and neither is a fault: a composition the author
 * writes thirty times is a composition the project may declare, and a class
 * list in the wrong order is a list that reads backwards. They are facts
 * about the project, and they are reported as facts.
 */
export async function corpus(root: string): Promise<CorpusReport> {
  const files = await sourceFiles(root);
  await warm(files);
  const attributes = attributesOf(files);
  const classes = [...new Set(attributes.flatMap((a) => [...a.classes]))];
  const order = await orderOf(root, classes);
  const outOfOrder = classOrderOf(attributes, order);
  const byFile = new Map<string, ClassOrder[]>();
  for (const entry of outOfOrder) {
    const list = byFile.get(entry.file) ?? [];
    list.push(entry);
    byFile.set(entry.file, list);
  }
  return {
    repetition: repetitionsOf(attributes).map((repetition) => ({
      ...repetition,
      files: repetition.files.map((file) => relative(root, file)),
    })),
    order: [...byFile.entries()].map(([file, list]) => ({
      file: relative(root, file),
      attributes: list.map((entry) => ({
        ...entry,
        file: relative(root, entry.file),
      })),
    })),
  };
}

/**
 * The order the sheet writes the project's classes in.
 *
 * The project's own themes first — a theme that declares a colour the
 * starters do not have declares a utility too — and the starters when the
 * project's own themes are ones the preset will not accept: an incomplete
 * theme is a theme being edited, and the order of the classes that ARE
 * there does not depend on it.
 */
async function orderOf(
  root: string,
  classes: readonly string[],
): Promise<ReadonlyMap<string, number>> {
  const themes = { ...starterThemes, ...readProjectThemes(root) };
  const own = await sheetOrder(
    classes,
    themes as Record<string, ThemeDocument>,
  );
  if (own.size > 0) return own;
  return await sheetOrder(classes, { ...starterThemes });
}

/** The class attributes of a set of files. */
function attributesOf(
  files: readonly string[],
): ClassAttribute[] {
  const out: ClassAttribute[] = [];
  for (const file of files) {
    let code: string;
    try {
      code = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    try {
      out.push(...classAttributesOf(file, code));
    } catch {
      // A file that does not parse carries no class list to report.
    }
  }
  return out;
}

/**
 * Writes a file's class lists in the order the sheet writes them.
 *
 * The whole file is written at once: the lists are independent, and a file
 * rewritten list by list would be rewritten many times over.
 */
export async function applyOrder(
  root: string,
  file: string,
): Promise<FixOutcome> {
  const path = inside(root, file);
  if (path === undefined) {
    return {
      applied: false,
      error: `"${file}" is not in the project.`,
      file: null,
      text: null,
    };
  }
  let code: string;
  try {
    code = readFileSync(path, "utf8");
  } catch {
    return {
      applied: false,
      error: `Could not read "${file}".`,
      file: null,
      text: null,
    };
  }
  const attributes = (() => {
    try {
      return classAttributesOf(path, code);
    } catch {
      return [];
    }
  })();
  const classes = [...new Set(attributes.flatMap((a) => [...a.classes]))];
  const order = await orderOf(root, classes);
  const outOfOrder = classOrderOf(attributes, order);
  if (outOfOrder.length === 0) {
    return {
      applied: false,
      error: "The file's class lists are already in order.",
      file: relative(root, path),
      text: code,
    };
  }
  // The edits are applied from the end of the file backwards, so an edit's
  // offsets stay true as the text before them changes.
  const edits = outOfOrder.map((entry) => {
    const attribute = attributes.find((candidate) =>
      candidate.line === entry.line && candidate.column === entry.column
    );
    const range = attribute?.range ?? [0, 0];
    return { range, text: entry.ordered.join(" ") };
  });
  const patched = applyFixes(code, edits).code;
  try {
    writeFileSync(path, patched, "utf8");
  } catch (error) {
    return {
      applied: false,
      error: error instanceof Error ? error.message : String(error),
      file: null,
      text: null,
    };
  }
  return {
    applied: true,
    error: null,
    file: relative(root, path),
    text: patched,
  };
}

/* -------------------------------------------------------------- the shortcut -- */

/** What a shortcut declaration did. */
export interface ShortcutOutcome {
  /** The name the shortcut was declared under. */
  readonly name: string;
  /** Why it was not declared, when it was not. */
  readonly error: string | null;
  /** The file the declaration was written into. */
  readonly file: string | null;
}

/**
 * Declares a shortcut in the project's own build configuration.
 *
 * A shortcut is a class the project composes, and a project's compositions
 * live in its configuration: the file where the project says what its
 * stylesheet is made of. So the declaration goes there, and the lint reads
 * it from the same place — a class the project declared is a class the
 * project produces, and the closed vocabulary knows it from then on.
 */
export async function declareShortcut(
  root: string,
  name: string,
  classes: readonly string[],
): Promise<ShortcutOutcome> {
  const config = await configFile(root);
  if (config === undefined) {
    return {
      name,
      error:
        "The project declares no build configuration, so there is nowhere to declare a shortcut.",
      file: null,
    };
  }
  let text: string;
  try {
    text = readFileSync(config, "utf8");
  } catch {
    return { name, error: `Could not read "${config}".`, file: null };
  }
  const patched = withShortcut(text, name, classes);
  if (patched.kind === "nowhere") {
    return {
      name,
      error:
        "The project's configuration declares no shortcuts, and does not wire spin in a place this can add one. Declare the shortcut by hand.",
      file: relative(root, config),
    };
  }
  if (patched.kind === "unreadable") {
    return {
      name,
      error:
        "The project's configuration declares its shortcuts somewhere this cannot read. Add the shortcut by hand.",
      file: relative(root, config),
    };
  }
  try {
    writeFileSync(config, patched.text, "utf8");
  } catch (error) {
    return {
      name,
      error: error instanceof Error ? error.message : String(error),
      file: null,
    };
  }
  return { name, error: null, file: relative(root, config) };
}

/**
 * The project's build configuration, when it has one.
 *
 * The project owns where its configuration lives, so it is asked: the file
 * names are the project's, and the nearest one above the root is the
 * project's own.
 */
async function configFile(root: string): Promise<string | undefined> {
  const { CONFIG_FILES } = await import("../project/index.ts");
  let directory = resolve(root);
  for (;;) {
    for (const name of CONFIG_FILES) {
      const candidate = join(directory, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = resolve(directory, "..");
    if (parent === directory) return undefined;
    directory = parent;
  }
}

/**
 * What a declaration in a configuration's text came to.
 *
 * - **declared** — the text with the shortcut in it.
 * - **unreadable** — the project declares shortcuts somewhere this cannot
 *   place one.
 * - **nowhere** — the project declares none, and wires spin in no place
 *   this can add one.
 */
export type ShortcutDeclaration =
  | { readonly kind: "declared"; readonly text: string }
  | { readonly kind: "unreadable" }
  | { readonly kind: "nowhere" };

/**
 * The text with one more shortcut declared in it.
 *
 * A configuration that declares its shortcuts in an object literal gets
 * the declaration inside that literal; one that does not declare them at
 * all gets the property inside the call that wires spin in. A declaration
 * this cannot place — a table imported from another module — is left
 * alone, and the caller says so rather than writing something the project
 * cannot read.
 */
export function withShortcut(
  text: string,
  name: string,
  classes: readonly string[],
): ShortcutDeclaration {
  const literal = shortcutLiteral(text);
  if (literal !== undefined) {
    const at = literal.end - 1;
    const indent = indentationAt(text, literal.start);
    const declaration = `  "${name}": "${classes.join(" ")}",\n`.replace(
      /^ {2}/,
      indent,
    );
    return {
      kind: "declared",
      text: text.slice(0, at) + declaration + text.slice(at),
    };
  }
  if (/\bshortcuts\s*:/.test(text)) {
    // The project declares shortcuts, but not where this can put one.
    return { kind: "unreadable" };
  }
  const call = text.indexOf("spin.vite(");
  if (call === -1) return { kind: "nowhere" };
  const open = text.indexOf("{", call);
  if (open === -1) return { kind: "nowhere" };
  const indent = indentationAt(text, open);
  const property = `${indent}shortcuts: {\n${indent}  "${name}": "${
    classes.join(" ")
  }",\n${indent}},\n`;
  return {
    kind: "declared",
    text: text.slice(0, open + 1) + "\n" + property + text.slice(open + 1),
  };
}

/**
 * The object literal a configuration's shortcuts are declared in.
 *
 * The declaration is either the literal itself or the name of a table the
 * configuration declares: `shortcuts: { … }` and `shortcuts: myTable` are
 * both ways of saying the same thing, and the second is followed to where
 * the table is written.
 */
function shortcutLiteral(
  text: string,
): { start: number; end: number } | undefined {
  const declaration = /\bshortcuts\s*:\s*/.exec(text);
  if (declaration === null) return undefined;
  const after = declaration.index + declaration[0].length;
  const rest = text.slice(after);
  if (rest.startsWith("{")) {
    const end = closingBrace(text, after);
    if (end === undefined) return undefined;
    return { start: after, end };
  }
  const named = /^[A-Za-z_$][\w$]*/.exec(rest);
  if (named === null) return undefined;
  const table = new RegExp(
    `\\b(?:const|let|var)\\s+${named[0]}\\s*(?::[^=]*?)?=\\s*\\{`,
  ).exec(text);
  if (table === null) return undefined;
  const open = text.indexOf("{", table.index);
  const end = closingBrace(text, open);
  if (end === undefined) return undefined;
  return { start: open, end };
}

/** The index of the brace that closes the one at `open`. */
function closingBrace(text: string, open: number): number | undefined {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return undefined;
}

/** The indentation of the line the index sits on. */
function indentationAt(text: string, index: number): string {
  const line = text.slice(0, index).split("\n").pop() ?? "";
  return /^[\t ]*/.exec(line)?.[0] ?? "";
}

/* ------------------------------------------------------------------ inside -- */

/**
 * The path a project's file is at, when it is one of the project's own.
 *
 * A file outside the project is refused: the procedures write to disk, and
 * a path that climbs out of the project is not the project's to write.
 */
function inside(root: string, file: string): string | undefined {
  const base = resolve(root);
  const path = isAbsolute(file) ? resolve(file) : resolve(base, file);
  const rel = relative(base, path);
  if (rel === "" || rel.startsWith(".." + sep) || rel === "..") {
    return undefined;
  }
  return path;
}
