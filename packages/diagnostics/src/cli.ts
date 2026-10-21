/**
 * The standalone CLI.
 *
 * The checks, without a linter: a project runs them over its own source
 * and reads the findings, with nothing installed but spin. The rules are
 * the very objects the oxlint plugin and the ESLint plugin ship, so what
 * the CLI says and what a linter says are the same decisions — and
 * `tests/frontends.test.ts` holds the three to that.
 *
 * The parser is the one thing the CLI needs that a linter brings with it:
 * a tree to walk. It reads TypeScript and JavaScript, JSX included, and
 * hands over the same ESTree shape ESLint's own parser produces — which is
 * why the CLI's findings land on the same lines and columns a linter's do.
 */

import { join } from "node:path";
import { parseForESLint } from "@typescript-eslint/parser";
import type { SemanticOptions, SemanticTags, Strictness } from "./core.ts";
import {
  type GateContext,
  type GateNode,
  renderMessage,
  type RuleName,
  RULES,
} from "./rules.ts";
import { walk, type WalkNode } from "./walk.ts";

/** What the CLI was asked to do. */
export interface CliOptions {
  /** The paths to read. */
  readonly paths: readonly string[];
  /** How the findings are printed. */
  readonly format: "text" | "json";
  /** The dial the semantic rule reads. */
  readonly semantic: SemanticOptions;
  /** The rules to run. */
  readonly rules: readonly RuleName[];
  /** Whether the CLI was asked to apply the edits the findings carry. */
  readonly fix: boolean;
  /** Whether the CLI was asked what it does. */
  readonly help: boolean;
}

/**
 * A text edit, as the CLI carries it.
 *
 * The range is in the source's own offsets, which is the shape the core
 * decided it in and the shape every linter's fixer speaks.
 */
export interface CliFix {
  readonly range: readonly [number, number];
  readonly text: string;
}

/** What the CLI found. */
export interface CliFinding {
  /** The file the finding is in. */
  readonly file: string;
  /** The line, counted from one. */
  readonly line: number;
  /** The column, counted from one — the convention every linter prints. */
  readonly column: number;
  /** The rule's name, as a configuration writes it. */
  readonly ruleId: string;
  /** The message id the rule reported under. */
  readonly messageId: string;
  /** The sentence the message id stands for. */
  readonly message: string;
  /**
   * The severity.
   *
   * The rule's own: a problem is an error, and a suggestion is a warning.
   * An advisory does not fail a run — the wrong element cannot be banned.
   */
  readonly severity: "error" | "warning";
  /** The edit that settles the finding, when it has one. */
  readonly fix?: CliFix;
}

/** A usage the CLI cannot make sense of. */
export class CliUsageError extends Error {}

/* ------------------------------------------------------------ the options -- */

const STRICTNESS: readonly Strictness[] = ["strict", "balanced", "lenient"];
const SEMANTIC_TAGS: readonly SemanticTags[] = [
  "all",
  "native",
  "spin",
  "none",
];

const FORMATS = ["text", "json"] as const;

const USAGE = `spin lint — the checks, without a linter.

Usage:
  spin-lint [options] <path...>

Options:
  --format <text|json>     how the findings are printed (default: text)
  --strictness <dial>      strict | balanced | lenient (default: strict)
  --semantic-tags <which>  all | native | spin | none (default: all)
  --rule <name>            run only this rule (repeatable)
  --fix                    apply the edits the findings carry
  -h, --help               this text

Paths may be files or directories. The files read are the JavaScript and
TypeScript ones: .js, .jsx, .mjs, .cjs, .ts, .tsx.

Exit codes:
  0  nothing to report, or only warnings
  1  an error to report
  2  the CLI could not read what it was asked to read`;

/**
 * Read the command line.
 *
 * The dials are the semantic rule's own, under the names the rule's schema
 * gives them: `--strictness balanced` is `{ strictness: "balanced" }`.
 */
export function parseArgs(argv: readonly string[]): CliOptions {
  const paths: string[] = [];
  const rules: RuleName[] = [];
  let format: CliOptions["format"] = "text";
  let strictness: Strictness = "strict";
  let semanticTags: SemanticTags = "all";
  let fix = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] as string;
    const next = (): string => {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new CliUsageError(`${argument} needs a value.`);
      }
      index += 1;
      return value;
    };
    switch (argument) {
      case "-h":
      case "--help":
        help = true;
        break;
      case "--format": {
        const value = next();
        if (!FORMATS.includes(value as "text" | "json")) {
          throw new CliUsageError(
            `--format takes ${FORMATS.join(" or ")}, not "${value}".`,
          );
        }
        format = value as "text" | "json";
        break;
      }
      case "--strictness": {
        const value = next();
        if (!STRICTNESS.includes(value as Strictness)) {
          throw new CliUsageError(
            `--strictness takes ${STRICTNESS.join(", ")}, not "${value}".`,
          );
        }
        strictness = value as Strictness;
        break;
      }
      case "--semantic-tags": {
        const value = next();
        if (!SEMANTIC_TAGS.includes(value as SemanticTags)) {
          throw new CliUsageError(
            `--semantic-tags takes ${
              SEMANTIC_TAGS.join(", ")
            }, not "${value}".`,
          );
        }
        semanticTags = value as SemanticTags;
        break;
      }
      case "--rule": {
        const value = next();
        const name = value.startsWith("spin/") ? value.slice(5) : value;
        if (!(name in RULES)) {
          throw new CliUsageError(
            `--rule takes a rule of this plugin, not "${value}".`,
          );
        }
        rules.push(name as RuleName);
        break;
      }
      case "--fix":
        fix = true;
        break;
      default:
        if (argument.startsWith("-")) {
          throw new CliUsageError(`Unknown option "${argument}".`);
        }
        paths.push(argument);
    }
  }

  if (help) {
    return {
      paths,
      format,
      semantic: { strictness, semanticTags },
      rules: [],
      fix,
      help,
    };
  }
  if (paths.length === 0) {
    throw new CliUsageError("Nothing to read: name a file or a directory.");
  }
  return {
    paths,
    format,
    semantic: { strictness, semanticTags },
    rules: rules.length > 0
      ? [...new Set(rules)]
      : (Object.keys(RULES) as RuleName[]),
    fix,
    help,
  };
}

/* ------------------------------------------------------------- the files -- */

/** The files the CLI reads. */
const SOURCE = /\.(?:tsx?|jsx?|mjs|cjs)$/;

/** The directories a scan does not walk into. */
const SKIPPED = new Set([
  ".git",
  ".deno",
  ".output",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
]);

/**
 * The files under a path.
 *
 * A path that names a file is that file; a path that names a directory is
 * everything under it that the CLI can read.
 */
export function collectFiles(paths: readonly string[]): string[] {
  const out: string[] = [];
  for (const path of paths) {
    let stats: Deno.FileInfo;
    try {
      stats = Deno.statSync(path);
    } catch {
      throw new CliUsageError(`Cannot read "${path}".`);
    }
    if (stats.isFile) {
      out.push(path);
      continue;
    }
    if (!stats.isDirectory) continue;
    const stack = [path];
    while (stack.length > 0) {
      const directory = stack.pop() as string;
      let entries: Deno.DirEntry[];
      try {
        entries = Array.from(Deno.readDirSync(directory));
      } catch {
        continue;
      }
      for (const entry of entries) {
        const child = join(directory, entry.name);
        if (entry.isDirectory) {
          if (!SKIPPED.has(entry.name)) stack.push(child);
          continue;
        }
        if (SOURCE.test(entry.name)) out.push(child);
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------- the rules -- */

/**
 * The tree of a file, as the rules read it.
 *
 * The parser is the one thing the CLI needs that a linter brings with it.
 * It reads TypeScript and JavaScript, JSX included, and hands over the
 * same ESTree shape ESLint's own parser produces — which is why the CLI's
 * findings land on the lines and columns a linter's do.
 */
export function parseFile(code: string, filename: string): WalkNode {
  const parsed = parseForESLint(code, { filePath: filename });
  return parsed.ast as unknown as WalkNode;
}

/**
 * The findings in one file.
 *
 * The rules run exactly as a linter runs them: each is given its own
 * context, with the file's name and the dials, and each reports what the
 * core decided.
 */
export function lintFile(
  filename: string,
  code: string,
  options: CliOptions,
): CliFinding[] {
  return lintTree(filename, parseFile(code, filename), options);
}

/** The findings in one tree. */
export function lintTree(
  filename: string,
  ast: WalkNode,
  options: CliOptions,
): CliFinding[] {
  const findings: CliFinding[] = [];
  const visitors = new Map<string, ((node: GateNode) => void)[]>();

  for (const name of options.rules) {
    const rule = RULES[name];
    const context: GateContext = {
      filename,
      options: [options.semantic],
      report(descriptor) {
        // The rule offers its edit as a fixer would: the CLI asks it for the
        // pair, exactly as ESLint and oxlint do.
        const fix = descriptor.fix?.();
        findings.push({
          file: filename,
          line: descriptor.node.loc?.start.line ?? 0,
          column: (descriptor.node.loc?.start.column ?? 0) + 1,
          ruleId: `spin/${name}`,
          messageId: descriptor.messageId,
          message: renderMessage(rule.meta, {
            messageId: descriptor.messageId,
            data: descriptor.data ?? {},
            position: {
              line: descriptor.node.loc?.start.line ?? 0,
              column: descriptor.node.loc?.start.column ?? 0,
            },
          }),
          severity: rule.meta.type === "problem" ? "error" : "warning",
          ...(fix === undefined ? {} : { fix }),
        });
      },
    };
    for (const [type, visitor] of Object.entries(rule.create(context))) {
      const list = visitors.get(type) ?? [];
      list.push(visitor);
      visitors.set(type, list);
    }
  }

  walk(ast, (node) => {
    for (const visitor of visitors.get(node.type) ?? []) visitor(node);
  });
  return findings;
}

/**
 * The findings over a set of files.
 *
 * A file the CLI cannot read — a file that is not there, a file that does
 * not parse — is reported as such and does not stop the run. A rule that
 * throws is a different thing: that is a bug, and it stops the run.
 */
export function lint(
  files: readonly string[],
  options: CliOptions,
): { findings: CliFinding[]; unreadable: string[] } {
  const findings: CliFinding[] = [];
  const unreadable: string[] = [];
  for (const file of files) {
    let code: string;
    try {
      code = Deno.readTextFileSync(file);
    } catch {
      unreadable.push(file);
      continue;
    }
    let ast: WalkNode;
    try {
      ast = parseFile(code, file);
    } catch {
      unreadable.push(file);
      continue;
    }
    findings.push(...lintTree(file, ast, options));
  }
  return { findings, unreadable };
}

/* -------------------------------------------------------------- the report -- */

/**
 * The edits of a set of findings, applied to a source.
 *
 * The edits are applied from the end of the file backwards, so an edit's
 * offsets stay true as the text before them changes — and two edits that
 * overlap are not both applied: the first one wins, and the second is left
 * for the next run, because applying both would change the text neither one
 * was decided against.
 */
export function applyFixes(
  code: string,
  fixes: readonly CliFix[],
): { code: string; applied: number } {
  const sorted = [...fixes].toSorted((a, b) => a.range[0] - b.range[0]);
  let out = "";
  let cursor = 0;
  let applied = 0;
  for (const fix of sorted) {
    if (fix.range[0] < cursor) continue;
    out += code.slice(cursor, fix.range[0]) + fix.text;
    cursor = fix.range[1];
    applied += 1;
  }
  return { code: out + code.slice(cursor), applied };
}

/** The findings, as text. */
export function formatText(findings: readonly CliFinding[]): string {
  const lines: string[] = [];
  let file = "";
  for (const finding of findings) {
    if (finding.file !== file) {
      file = finding.file;
      lines.push(file);
    }
    lines.push(
      `  ${finding.line}:${finding.column}  ${finding.ruleId}  ${finding.message}`,
    );
  }
  if (findings.length > 0) {
    lines.push("");
    lines.push(
      `${findings.length} finding${findings.length === 1 ? "" : "s"}`,
    );
  }
  return lines.join("\n");
}

/** The findings, as JSON. */
export function formatJson(findings: readonly CliFinding[]): string {
  const files = new Set(findings.map((finding) => finding.file));
  return JSON.stringify(
    {
      version: 1,
      findings,
      summary: { findings: findings.length, files: files.size },
    },
    null,
    2,
  );
}

/* ------------------------------------------------------------------ the run -- */

/**
 * Run the CLI.
 *
 * The exit code is what a script reads: 0 when there is nothing to report,
 * 1 when there is an error, 2 when the CLI could not read what it was asked
 * to read. A warning is reported and does not fail the run: an advisory is
 * another way of doing it, not a mistake.
 */
export function run(
  argv: readonly string[],
  write: (line: string) => void = (line) => console.log(line),
  warn: (line: string) => void = (line) => console.error(line),
): number {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error));
    write(USAGE);
    return 2;
  }
  if (options.help) {
    write(USAGE);
    return 0;
  }

  let files: string[];
  try {
    files = collectFiles(options.paths);
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error));
    return 2;
  }

  const { findings, unreadable } = lint(files, options);
  for (const file of unreadable) {
    warn(`Could not read "${file}".`);
  }
  const remaining = options.fix ? fix(files, options, warn) : findings;
  write(
    options.format === "json" ? formatJson(remaining) : formatText(remaining),
  );
  if (unreadable.length > 0) return 2;
  return remaining.some((finding) => finding.severity === "error") ? 1 : 0;
}

/**
 * Apply the edits the findings carry, and read the files again.
 *
 * Two edits can touch the same text — a class and its neighbour both leaving
 * — and only one of them can be applied at a time. So the files are read
 * again after the edits, and the next pass settles what the first could
 * not. The loop ends when a pass changes nothing.
 */
function fix(
  files: readonly string[],
  options: CliOptions,
  warn: (line: string) => void,
): CliFinding[] {
  let findings = lint(files, options).findings;
  for (let pass = 0; pass < 10; pass += 1) {
    const changed = writeFixes(findings, warn);
    if (!changed) break;
    findings = lint(files, options).findings;
  }
  return findings;
}

/**
 * Apply the edits the findings carry, and write the files back.
 *
 * The findings that were applied are gone: the file no longer says what
 * they said. The ones that could not be applied — two edits over the same
 * text — stay, because the file still says what they said.
 */
function writeFixes(
  findings: readonly CliFinding[],
  warn: (line: string) => void,
): boolean {
  const byFile = new Map<string, CliFinding[]>();
  for (const finding of findings) {
    if (finding.fix === undefined) continue;
    const list = byFile.get(finding.file) ?? [];
    list.push(finding);
    byFile.set(finding.file, list);
  }
  let changed = false;
  for (const [file, list] of byFile) {
    let code: string;
    try {
      code = Deno.readTextFileSync(file);
    } catch {
      warn(`Could not read "${file}".`);
      continue;
    }
    const { code: patched, applied } = applyFixes(
      code,
      list.map((finding) => finding.fix as CliFix),
    );
    if (applied === 0) continue;
    try {
      Deno.writeTextFileSync(file, patched);
    } catch (error) {
      warn(error instanceof Error ? error.message : String(error));
      continue;
    }
    changed = true;
  }
  return changed;
}

if (import.meta.main) {
  Deno.exit(run(Deno.args));
}
