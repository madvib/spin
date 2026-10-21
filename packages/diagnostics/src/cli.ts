/**
 * The CLI: a client of the service.
 *
 * The rules are decided in the core, and the service owns the operations
 * over them. The CLI is a client: it reads the command line, asks the
 * service, and prints what came back. It decides nothing about what is
 * wrong with the code — that is the service's answer, and the editor's
 * answer, and they are the same answer.
 *
 * The two commands are the two operations:
 *
 *   spin lint [path] [--fix] [--format json]   the rules, over a path
 *   spin check [url]                           the rendered checks
 *
 * The parser is the one thing the CLI needs that a linter brings with it:
 * a tree to walk. It reads TypeScript and JavaScript, JSX included, and
 * hands over the same ESTree shape ESLint's own parser produces — which is
 * why the findings land on the same lines and columns a linter's do.
 */

import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CheckConfig } from "./check.ts";
import type {
  SemanticOptions,
  SemanticTags,
  Strictness,
  TextEdit,
} from "./core.ts";
import { applyFixes, type Diagnostic } from "./engine.ts";
import { type RuleName, RULES } from "./rules.ts";
import { check, lint } from "./service.ts";
import { workspaceHarness } from "./workspace.ts";

/** A usage the CLI cannot make sense of. */
export class CliUsageError extends Error {}

/* ------------------------------------------------------------ the options -- */

/** The dials the semantic rules read. */
const STRICTNESS: readonly Strictness[] = ["strict", "balanced", "lenient"];
const SEMANTIC_TAGS: readonly SemanticTags[] = [
  "all",
  "native",
  "spin",
  "none",
];
const FORMATS = ["text", "json"] as const;

/** How the findings are printed. */
export type Format = (typeof FORMATS)[number];

/** What the CLI was asked to do: the rules, over a path. */
export interface LintCommand {
  readonly kind: "lint";
  /** The paths to read. */
  readonly paths: readonly string[];
  /** How the findings are printed. */
  readonly format: Format;
  /** The dials the semantic rules read. */
  readonly semantic: SemanticOptions;
  /** The rules to run. */
  readonly rules: readonly RuleName[];
  /** Whether the edits the findings carry were asked for. */
  readonly fix: boolean;
}

/** What the CLI was asked to do: the rendered checks, over a running app. */
export interface CheckCommand {
  readonly kind: "check";
  /** The app under test. */
  readonly url?: string;
  /** How the findings are printed. */
  readonly format: Format;
  /** The module the app's check configuration is written in. */
  readonly config: string;
  /** The harness to call, when the workspace's own is not the one. */
  readonly harness?: string;
  /** The options the harness's own runner takes. */
  readonly argv: readonly string[];
}

/** What the CLI was asked to do. */
export type Command = LintCommand | CheckCommand | HelpCommand;

/** What the CLI was asked to do when it was asked what it does. */
export interface HelpCommand {
  readonly kind: "help";
}

const USAGE = `spin — the diagnostics, without a linter.

Usage:
  spin lint [options] <path...>
  spin check [options] [url]

Commands:
  lint    the rules, over a path
  check   the rendered checks, over a running app

Options for lint:
  --format <text|json>     how the findings are printed (default: text)
  --strictness <dial>      strict | balanced | lenient (default: strict)
  --semantic-tags <which>  all | native | spin | none (default: all)
  --rule <name>            run only this rule (repeatable)
  --fix                    apply the edits the findings carry
  -h, --help               this text

Options for check:
  --format <text|json>     how the findings are printed (default: text)
  --config <module>        the app's check configuration (required)
  --harness <module>       the harness to call (default: the workspace's)
  --route <substring>      only routes whose hash contains this (repeatable)
  --themes a,b,c           themes to render (default: the app's own)
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
export function parseArgs(argv: readonly string[]): Command {
  // A `--` is the end of the options: everything after it is the command,
  // whatever it is called. `deno task lint:cli -- lint src/` is one way to
  // say it.
  const [command, ...rest] = argv[0] === "--" ? argv.slice(1) : argv;
  if (command === undefined) {
    throw new CliUsageError("Name a command: lint, or check.");
  }
  if (command === "-h" || command === "--help") return { kind: "help" };
  if (command === "lint") return parseLint(rest);
  if (command === "check") return parseCheck(rest);
  throw new CliUsageError(`Unknown command "${command}".`);
}

/** The rules, over a path. */
function parseLint(argv: readonly string[]): Command {
  const paths: string[] = [];
  const rules: RuleName[] = [];
  let format: Format = "text";
  let strictness: Strictness = "strict";
  let semanticTags: SemanticTags = "all";
  let fix = false;
  let help = false;

  for (const argument of read(argv)) {
    switch (argument.name) {
      case "help":
        help = true;
        break;
      case "format": {
        const value = argument.value as string;
        if (!FORMATS.includes(value as Format)) {
          throw new CliUsageError(
            `--format takes ${FORMATS.join(" or ")}, not "${value}".`,
          );
        }
        format = value as Format;
        break;
      }
      case "strictness": {
        const value = argument.value as string;
        if (!STRICTNESS.includes(value as Strictness)) {
          throw new CliUsageError(
            `--strictness takes ${STRICTNESS.join(", ")}, not "${value}".`,
          );
        }
        strictness = value as Strictness;
        break;
      }
      case "semantic-tags": {
        const value = argument.value as string;
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
      case "rule": {
        const value = argument.value as string;
        const name = value.startsWith("spin/") ? value.slice(5) : value;
        if (!(name in RULES)) {
          throw new CliUsageError(
            `--rule takes a rule of this plugin, not "${value}".`,
          );
        }
        rules.push(name as RuleName);
        break;
      }
      case "fix":
        fix = true;
        break;
      default:
        if (argument.option) {
          throw new CliUsageError(`Unknown option "${argument.raw}".`);
        }
        paths.push(argument.name);
    }
  }

  if (help) {
    return { kind: "help" };
  }
  if (paths.length === 0) {
    throw new CliUsageError("Nothing to read: name a file or a directory.");
  }
  return {
    kind: "lint",
    paths,
    format,
    semantic: { strictness, semanticTags },
    rules: rules.length > 0
      ? [...new Set(rules)]
      : (Object.keys(RULES) as RuleName[]),
    fix,
  };
}

/** The rendered checks, over a running app. */
function parseCheck(argv: readonly string[]): Command {
  let format: Format = "text";
  let config: string | undefined;
  let harness: string | undefined;
  let url: string | undefined;
  const passed: string[] = [];

  for (const argument of read(argv)) {
    switch (argument.name) {
      case "help":
        return { kind: "help" };
      case "format": {
        const value = argument.value as string;
        if (!FORMATS.includes(value as Format)) {
          throw new CliUsageError(
            `--format takes ${FORMATS.join(" or ")}, not "${value}".`,
          );
        }
        format = value as Format;
        break;
      }
      case "config":
        config = argument.value as string;
        break;
      case "harness":
        harness = argument.value as string;
        break;
      default: {
        // The harness's own options are the runner's to read: the routes to
        // walk, the themes to render. So they are passed through, as they
        // were written.
        if (!argument.option) {
          url ??= argument.name;
          break;
        }
        passed.push(argument.raw);
        if (argument.value !== undefined) passed.push(argument.value);
      }
    }
  }

  if (config === undefined) {
    throw new CliUsageError(
      "The rendered checks need the app's own facts: name its check " +
        "configuration with --config <module>.",
    );
  }
  return { kind: "check", url, format, config, harness, argv: passed };
}

/**
 * The arguments, as name and value.
 *
 * An option that takes a value takes the next argument; one that does not
 * is named on its own. A `--name=value` is the same as a `--name value`.
 */
function read(argv: readonly string[]): Argument[] {
  const out: Argument[] = [];
  const takesValue = new Set([
    "format",
    "strictness",
    "semantic-tags",
    "rule",
    "config",
    "harness",
    // The harness's own options: the runner reads them, but the values
    // they carry are theirs, not the command's.
    "route",
    "themes",
    "modes",
    "out",
    "baseline",
    "write-baseline",
    "chrome",
    "viewport",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] as string;
    if (argument === "--") {
      // The end of the options: what follows is what the command is given.
      for (const rest of argv.slice(index + 1)) {
        out.push({ name: rest, option: false, raw: rest });
      }
      break;
    }
    if (!argument.startsWith("-")) {
      out.push({ name: argument, option: false, raw: argument });
      continue;
    }
    const equals = argument.indexOf("=");
    if (equals >= 0) {
      const name = argument.slice(2, equals);
      out.push({
        name,
        value: argument.slice(equals + 1),
        option: true,
        raw: argument,
      });
      continue;
    }
    const name = argument.replace(/^--?/, "");
    if (!takesValue.has(name)) {
      out.push({ name, option: true, raw: argument });
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined) {
      throw new CliUsageError(`${argument} needs a value.`);
    }
    index += 1;
    out.push({ name, value, option: true, raw: argument });
  }
  return out;
}

/** One argument, as the command line wrote it. */
interface Argument {
  /** The name, without the dashes. */
  readonly name: string;
  /** The value, when the option takes one. */
  readonly value?: string;
  /** Whether it was written as an option. */
  readonly option: boolean;
  /** The text as it was written. */
  readonly raw: string;
}

/* -------------------------------------------------------------- the report -- */

/** The findings, as text. */
export function formatText(findings: readonly Diagnostic[]): string {
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
export function formatJson(findings: readonly Diagnostic[]): string {
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
 * 1 when there is an error, 2 when the CLI could not read what it was
 * asked to read. A warning is reported and does not fail the run: an
 * advisory is another way of doing it, not a mistake.
 */
export async function run(
  argv: readonly string[],
  write: (line: string) => void = (line) => console.log(line),
  warn: (line: string) => void = (line) => console.error(line),
): Promise<number> {
  let command: Command;
  try {
    command = parseArgs(argv);
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error));
    write(USAGE);
    return 2;
  }
  return command.kind === "help"
    ? (write(USAGE), 0)
    : command.kind === "lint"
    ? await runLint(command, write, warn)
    : await runCheck(command, write, warn);
}

/** The rules, over a path. */
async function runLint(
  command: LintCommand,
  write: (line: string) => void,
  warn: (line: string) => void,
): Promise<number> {
  const options = {
    rules: command.rules,
    semantic: command.semantic,
  };
  let report = await lintAll(command.paths, options);
  for (const path of report.missing) warn(`Cannot read "${path}".`);
  for (const file of report.unreadable) warn(`Could not read "${file}".`);

  if (command.fix) {
    report = await fix(command.paths, options, warn);
  }
  write(
    command.format === "json"
      ? formatJson(report.findings)
      : formatText(report.findings),
  );
  if (report.missing.length > 0 || report.unreadable.length > 0) return 2;
  return report.findings.some((finding) => finding.severity === "error")
    ? 1
    : 0;
}

/** The rules, over every path, and the reports they give. */
async function lintAll(
  paths: readonly string[],
  options: { rules: readonly RuleName[]; semantic: SemanticOptions },
) {
  const findings: Diagnostic[] = [];
  const unreadable: string[] = [];
  const missing: string[] = [];
  for (const path of paths) {
    const report = await lint(path, undefined, options);
    findings.push(...report.findings);
    unreadable.push(...report.unreadable);
    missing.push(...report.missing);
  }
  return { findings, unreadable, missing };
}

/**
 * Apply the edits the findings carry, and read the files again.
 *
 * Two edits can touch the same text — a class and its neighbour both
 * leaving — and only one of them can be applied at a time. So the files
 * are read again after the edits, and the next pass settles what the first
 * could not. The loop ends when a pass changes nothing.
 */
async function fix(
  paths: readonly string[],
  options: { rules: readonly RuleName[]; semantic: SemanticOptions },
  warn: (line: string) => void,
): Promise<Awaited<ReturnType<typeof lintAll>>> {
  let report = await lintAll(paths, options);
  for (let pass = 0; pass < 10; pass += 1) {
    if (!writeFixes(report.findings, warn)) break;
    report = await lintAll(paths, options);
  }
  return report;
}

/**
 * Apply the edits the findings carry, and write the files back.
 *
 * The findings that were applied are gone: the file no longer says what
 * they said. The ones that could not be applied — two edits over the same
 * text — stay, because the file still says what they said.
 */
function writeFixes(
  findings: readonly Diagnostic[],
  warn: (line: string) => void,
): boolean {
  const byFile = new Map<string, Diagnostic[]>();
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
      code = readFileSync(file, "utf8");
    } catch {
      warn(`Could not read "${file}".`);
      continue;
    }
    const { code: patched, applied } = applyFixes(
      code,
      list.map((finding) => finding.fix as TextEdit),
    );
    if (applied === 0) continue;
    try {
      writeFileSync(file, patched);
    } catch (error) {
      warn(error instanceof Error ? error.message : String(error));
      continue;
    }
    changed = true;
  }
  return changed;
}

/** The rendered checks, over a running app. */
async function runCheck(
  command: CheckCommand,
  write: (line: string) => void,
  warn: (line: string) => void,
): Promise<number> {
  let config: CheckConfig;
  try {
    config = await loadConfig(command.config);
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error));
    return 2;
  }
  const harness = workspaceHarness(config, {
    ...(command.harness === undefined ? {} : { harness: command.harness }),
    argv: command.argv,
  });
  let report: Awaited<ReturnType<typeof check>>;
  try {
    report = await check(command.url ?? config.defaultUrl, harness);
  } catch (error) {
    // The harness says what it could not do: the app is not there, the
    // browser would not start, the theme it was given is not one it knows.
    warn(error instanceof Error ? error.message : String(error));
    return 2;
  }
  write(
    command.format === "json"
      ? formatCheckJson(report.findings)
      : formatCheckText(report.findings),
  );
  // The harness's verdict is the run's verdict: 0 when it passed, 1 when
  // it found something, 2 when it could not run at all.
  return report.code === 0 ? 0 : report.code === 1 ? 1 : 2;
}

/** The app's check configuration, as the module hands it over. */
async function loadConfig(path: string): Promise<CheckConfig> {
  const module = await import(
    pathToFileURL(resolve(path)).href
  ) as {
    default?: CheckConfig;
    config?: CheckConfig;
  };
  const config = module.config ?? module.default;
  if (config === undefined) {
    throw new Error(`${path} exports no check configuration.`);
  }
  return config;
}

/** The rendered findings, as text. */
function formatCheckText(
  findings: readonly {
    route: string;
    theme: string;
    mode: string;
    check: string;
    subject: string;
    detail: string;
    state: string;
  }[],
): string {
  const lines: string[] = [];
  for (const finding of findings) {
    lines.push(
      `${finding.route} · ${finding.theme}/${finding.mode} — ${finding.subject}` +
        (finding.state === "rest" ? "" : ` (${finding.state})`),
    );
    lines.push(`      ${finding.detail}`);
  }
  if (findings.length > 0) {
    lines.push("");
    lines.push(
      `${findings.length} finding${findings.length === 1 ? "" : "s"}`,
    );
  }
  return lines.join("\n");
}

/** The rendered findings, as JSON. */
function formatCheckJson(
  findings: readonly { check: string }[],
): string {
  const checks = new Set(findings.map((finding) => finding.check));
  return JSON.stringify(
    {
      version: 1,
      findings,
      summary: { findings: findings.length, checks: checks.size },
    },
    null,
    2,
  );
}

/* ------------------------------------------------------------------ the run -- */

/**
 * Whether this module is the one that was run.
 *
 * `import.meta.main` is the answer on Deno, on Bun, and on the Node
 * versions that have it; the command line is the answer everywhere else,
 * and a bin installed by npm is run through a link — so the two paths are
 * compared as they resolve.
 */
function invokedDirectly(): boolean {
  const meta = import.meta as { main?: boolean };
  if (meta.main === true) return true;
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return sameFile(entry, fileURLToPath(import.meta.url));
}

/** Whether two paths are the same file. */
function sameFile(left: string, right: string): boolean {
  try {
    return realpathSync(left) === realpathSync(right);
  } catch {
    return resolve(left) === resolve(right);
  }
}

if (invokedDirectly()) {
  process.exit(await run(process.argv.slice(2)));
}
