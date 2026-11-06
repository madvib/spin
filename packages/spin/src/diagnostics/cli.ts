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
import {
  DEFAULT_SEMANTIC_OPTIONS,
  type SemanticOptions,
  type SemanticTags,
  type Strictness,
  type TextEdit,
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

/** What the CLI was asked to do: make a project. */
export interface InitCommand {
  readonly kind: "init";
  /** The root to make the project in. */
  readonly root: string;
  /** The name of the first theme — the file stem it is written under. */
  readonly name: string;
  /** The starter to seed the theme from. */
  readonly starter: string;
  /** The bundler the generated build config wires. */
  readonly bundler?: string;
  readonly themesDir?: string;
  readonly componentsDir?: string;
  readonly prefix?: string;
  /** Vendor the full starter text instead of a sparse `$extends` document. */
  readonly vendor?: boolean;
  /** The daemon to dial, when the procedures live elsewhere. */
  readonly url?: string;
  /** Skip the interactive prompts. */
  readonly yes: boolean;
}

/** What the CLI was asked to do: open the standalone studio. */
export interface StudioCommand {
  readonly kind: "studio";
  /** The project root to serve. */
  readonly root: string;
  /** The port to bind. */
  readonly port?: number;
  /** The address to bind. */
  readonly host?: string;
}

/** What the CLI was asked to do: run the agent server over stdio. */
export interface McpCommand {
  readonly kind: "mcp";
  /** The project root to serve in-process. */
  readonly root?: string;
  /** The daemon to dial, when the procedures live elsewhere. */
  readonly url?: string;
}

/** What the CLI was asked to do: run the language server over stdio. */
export interface LspCommand {
  readonly kind: "lsp";
  /** The project root the server was started in. */
  readonly root?: string;
}

/** What the CLI was asked to do: read the themes. */
export interface ThemeCommand {
  readonly kind: "theme";
  readonly action: "list" | "analyze" | "scaffold";
  /** The theme the action reads, for `analyze`. */
  readonly name?: string;
  /** Whether the scale-key contract was asked for, via `--contract`. */
  readonly contract: boolean;
  /** The shipped set the contract compares: positionals, or `--contract=a,b`. */
  readonly contractThemes?: readonly string[];
  /** Whether the missing scale keys are listed with their neighbors. */
  readonly migrate: boolean;
  /** The project root to read. */
  readonly root?: string;
  /** The daemon to dial, when the procedures live elsewhere. */
  readonly url?: string;
  /** How the answer is printed. */
  readonly format: Format;
}

/** What the CLI was asked to do: read the components. */
export interface ComponentCommand {
  readonly kind: "component";
  readonly action: "list" | "contract" | "copy";
  /** The component the action reads, for `contract` and `copy`. */
  readonly name?: string;
  /** The example to copy, for `copy`. */
  readonly example?: string;
  /** The project root to read and to write the copy into. */
  readonly root?: string;
  /** The daemon to dial, when the procedures live elsewhere. */
  readonly url?: string;
  /** How the answer is printed. */
  readonly format: Format;
}

/** What the CLI was asked to do: the rules, over a path. */
export interface LintCommand {
  readonly kind: "lint";
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
export type Command =
  | LintCommand
  | CheckCommand
  | InitCommand
  | StudioCommand
  | McpCommand
  | LspCommand
  | ThemeCommand
  | ComponentCommand
  | HelpCommand;

/** What the CLI was asked to do when it was asked what it does. */
export interface HelpCommand {
  readonly kind: "help";
}

const USAGE = `spin — the project, the rules, and the checks.

Usage:
  spin init [options]
  spin studio [options]
  spin mcp [options]
  spin lsp [options]
  spin theme <list|analyze|scaffold> [name] [options]
  spin component <list|contract|copy> [name] [example] [options]
  spin lint [options] <path...>
  spin check [options] [url]
  studio      open the standalone theme editor: the API, and the studio beside it
  mcp         run the agent server over stdio
  lsp         run the language server over stdio
  theme       read the themes: list; analyze one document, or the corpus across all
  component   read the components: list, contract, or copy an example
  lint        the rules, over a path
  check       the rendered checks, over a running app

Options for init:
  --name <name>          the first theme's file stem (default: default)
  --starter <starter>    spin | silk | material | neobrut | industrial (default: spin)
  --bundler <bundler>    vite | rspack | webpack | rollup | rolldown | esbuild | bun (default: detected)
  --themes-dir <dir>     themes directory (default: spin)
  --components-dir <dir> components directory (default: lib/components)
  --prefix <prefix>      component prefix (default: derived)
  --root <dir>           the project root (default: the current directory)
  --url <url>            the daemon to dial (default: in-process)
  -y, --yes              skip the interactive prompts
  -h, --help             this text

Options for studio:
  --root <dir>           the project root (default: the current directory)
  --port <n>             the port to bind (default: 7463)
  --host <addr>          the address to bind (default: 127.0.0.1)
  -h, --help             this text

Options for mcp:
  --root <dir>           the project root (default: the current directory)
  --url <url>            the daemon to dial (default: in-process)
  -h, --help             this text

Options for lsp:
  --root <dir>           the project root (default: the current directory)
  -h, --help             this text

Options for theme:
  --root <dir>           the project root (default: the current directory)
  --url <url>            the daemon to dial (default: in-process)
  --format <text|json>   how the answer is printed (default: text)
  --contract[=a,b]       compare the scale keys across the shipped set (default: contractThemes in spin/config.json)
  --migrate              list the missing scale keys with their neighbors (needs --contract)
  -h, --help             this text

Options for component:
  --root <dir>           the project root (default: the current directory)
  --url <url>            the daemon to dial (default: in-process)
  --format <text|json>   how the answer is printed (default: text)
  -h, --help             this text

Options for lint:
  --format <text|json>     how the findings are printed (default: text)
  --strictness <dial>      strict | balanced | lenient (default: strict)
  --semantic-tags <which>  all | native | spin | none (default: native)
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
TypeScript ones (.js, .jsx, .mjs, .cjs, .ts, .tsx) and the component files
beside them (.html, but never an index.html document shell).

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
  // whatever it is called. `bun run lint:cli -- lint src/` is one way to
  // say it.
  const [command, ...rest] = argv[0] === "--" ? argv.slice(1) : argv;
  if (command === undefined) {
    throw new CliUsageError(
      "Name a command: init, studio, mcp, lsp, theme, component, lint, or check.",
    );
  }
  if (command === "-h" || command === "--help" || command === "help") {
    return { kind: "help" };
  }
  if (command === "lint") return parseLint(rest);
  if (command === "check") return parseCheck(rest);
  if (command === "init") return parseInit(rest);
  if (command === "studio") return parseStudio(rest);
  if (command === "mcp") return parseMcp(rest);
  if (command === "lsp") return parseLsp(rest);
  if (command === "theme") return parseTheme(rest);
  if (command === "component") return parseComponent(rest);
  throw new CliUsageError(`Unknown command "${command}".`);
}
/** Make a project: a theme, and a build config that wires spin. */
function parseInit(argv: readonly string[]): Command {
  let root = process.cwd();
  let name: string | undefined;
  let starter: string | undefined;
  let bundler: string | undefined;
  let themesDir: string | undefined;
  let componentsDir: string | undefined;
  let prefix: string | undefined;
  let vendor: boolean | undefined;
  let url: string | undefined;
  let yes = false;

  for (const argument of read(argv)) {
    switch (argument.name) {
      case "help":
        return { kind: "help" };
      case "root":
        root = argument.value as string;
        break;
      case "name":
        name = argument.value as string;
        break;
      case "starter":
        starter = argument.value as string;
        break;
      case "bundler":
        bundler = argument.value as string;
        break;
      case "themes-dir":
        themesDir = argument.value as string;
        break;
      case "components-dir":
        componentsDir = argument.value as string;
        break;
      case "prefix":
        prefix = argument.value as string;
        break;
      case "vendor":
        vendor = true;
        break;
      case "url":
        url = argument.value as string;
        break;
      case "y":
      case "yes":
        yes = true;
        break;
      default:
        throw new CliUsageError(
          argument.option
            ? `Unknown option "${argument.raw}".`
            : `Unexpected argument "${argument.raw}".`,
        );
    }
  }
  return {
    kind: "init",
    root,
    name: name ?? "default",
    starter: starter ?? "spin",
    ...(bundler === undefined ? {} : { bundler }),
    ...(themesDir === undefined ? {} : { themesDir }),
    ...(componentsDir === undefined ? {} : { componentsDir }),
    ...(prefix === undefined ? {} : { prefix }),
    ...(vendor === undefined ? {} : { vendor }),
    ...(url === undefined ? {} : { url }),
    yes,
  };
}

/** Open the standalone studio: the API, and the studio beside it. */
function parseStudio(argv: readonly string[]): Command {
  let root = process.cwd();
  let port: number | undefined;
  let host: string | undefined;

  for (const argument of read(argv)) {
    switch (argument.name) {
      case "help":
        return { kind: "help" };
      case "root":
        root = argument.value as string;
        break;
      case "port": {
        const value = Number(argument.value);
        if (!Number.isInteger(value) || value < 0 || value > 65535) {
          throw new CliUsageError(
            `--port takes a port number, not "${argument.value}".`,
          );
        }
        port = value;
        break;
      }
      case "host":
        host = argument.value as string;
        break;
      default:
        throw new CliUsageError(
          argument.option
            ? `Unknown option "${argument.raw}".`
            : `Unexpected argument "${argument.raw}".`,
        );
    }
  }
  return {
    kind: "studio",
    root,
    ...(port === undefined ? {} : { port }),
    ...(host === undefined ? {} : { host }),
  };
}

/** Run the agent server over stdio. */
function parseMcp(argv: readonly string[]): Command {
  let root: string | undefined;
  let url: string | undefined;

  for (const argument of read(argv)) {
    switch (argument.name) {
      case "help":
        return { kind: "help" };
      case "root":
        root = argument.value as string;
        break;
      case "url":
        url = argument.value as string;
        break;
      default:
        throw new CliUsageError(
          argument.option
            ? `Unknown option "${argument.raw}".`
            : `Unexpected argument "${argument.raw}".`,
        );
    }
  }
  return {
    kind: "mcp",
    ...(root === undefined ? {} : { root }),
    ...(url === undefined ? {} : { url }),
  };
}

/** Run the language server over stdio. */
function parseLsp(argv: readonly string[]): Command {
  let root: string | undefined;

  for (const argument of read(argv)) {
    switch (argument.name) {
      case "help":
        return { kind: "help" };
      case "root":
        root = argument.value as string;
        break;
      default:
        throw new CliUsageError(
          argument.option
            ? `Unknown option "${argument.raw}".`
            : `Unexpected argument "${argument.raw}".`,
        );
    }
  }
  return {
    kind: "lsp",
    ...(root === undefined ? {} : { root }),
  };
}

/** Read the themes: list, analyze, or scaffold one. */
function parseTheme(argv: readonly string[]): Command {
  let action: ThemeCommand["action"] | undefined;
  let name: string | undefined;
  let contract = false;
  let contractThemes: string[] | undefined;
  const positionals: string[] = [];
  let migrate = false;
  let root: string | undefined;
  let url: string | undefined;
  let format: Format = "text";

  for (const argument of read(argv)) {
    switch (argument.name) {
      case "help":
        return { kind: "help" };
      case "root":
        root = argument.value as string;
        break;
      case "url":
        url = argument.value as string;
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
      case "contract": {
        // Bare `--contract` takes the shipped set from the project config;
        // `--contract=a,b` names it on the line.
        contract = true;
        if (argument.value !== undefined) {
          contractThemes ??= [];
          for (const entry of (argument.value as string).split(",")) {
            const theme = entry.trim();
            if (theme !== "" && !contractThemes.includes(theme)) contractThemes.push(theme);
          }
        }
        break;
      }
      case "migrate":
        migrate = true;
        break;
      default:
        if (argument.option) {
          throw new CliUsageError(`Unknown option "${argument.raw}".`);
        }
        if (action === undefined) {
          if (
            argument.name !== "list" && argument.name !== "analyze" &&
            argument.name !== "scaffold"
          ) {
            throw new CliUsageError(
              `theme takes list, analyze, or scaffold — not "${argument.name}".`,
            );
          }
          action = argument.name;
        } else {
          positionals.push(argument.name);
        }
    }
  }
  if (action === undefined) {
    throw new CliUsageError("theme needs an action: list, analyze, or scaffold.");
  }
  if (action === "analyze" && contract) {
    for (const positional of positionals) {
      contractThemes ??= [];
      for (const entry of positional.split(",")) {
        const theme = entry.trim();
        if (theme !== "" && !contractThemes.includes(theme)) contractThemes.push(theme);
      }
    }
  } else if (positionals.length === 1 && name === undefined) {
    name = positionals[0];
  } else if (positionals.length > 0) {
    throw new CliUsageError(
      `Unexpected argument "${positionals.length === 1 ? positionals[0] : positionals[positionals.length - 1]}".`,
    );
  }
  return {
    kind: "theme",
    action,
    ...(name === undefined ? {} : { name }),
    contract,
    ...(contractThemes === undefined || contractThemes.length === 0 ? {} : { contractThemes }),
    migrate,
    ...(root === undefined ? {} : { root }),
    ...(url === undefined ? {} : { url }),
    format,
  };
}

/** Read the components: list, contract, or copy an example. */
function parseComponent(argv: readonly string[]): Command {
  let action: ComponentCommand["action"] | undefined;
  let name: string | undefined;
  let example: string | undefined;
  let root: string | undefined;
  let url: string | undefined;
  let format: Format = "text";

  for (const argument of read(argv)) {
    switch (argument.name) {
      case "help":
        return { kind: "help" };
      case "root":
        root = argument.value as string;
        break;
      case "url":
        url = argument.value as string;
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
      default:
        if (argument.option) {
          throw new CliUsageError(`Unknown option "${argument.raw}".`);
        }
        if (action === undefined) {
          if (
            argument.name !== "list" && argument.name !== "contract" &&
            argument.name !== "copy"
          ) {
            throw new CliUsageError(
              `component takes list, contract, or copy — not "${argument.name}".`,
            );
          }
          action = argument.name;
        } else if (name === undefined) {
          name = argument.name;
        } else if (example === undefined) {
          example = argument.name;
        } else {
          throw new CliUsageError(
            `Unexpected argument "${argument.raw}".`,
          );
        }
    }
  }
  if (action === undefined) {
    throw new CliUsageError(
      "component needs an action: list, contract, or copy.",
    );
  }
  return {
    kind: "component",
    action,
    ...(name === undefined ? {} : { name }),
    ...(example === undefined ? {} : { example }),
    ...(root === undefined ? {} : { root }),
    ...(url === undefined ? {} : { url }),
    format,
  };
}

/** The rules, over a path. */
function parseLint(argv: readonly string[]): Command {
  const paths: string[] = [];
  const rules: RuleName[] = [];
  let format: Format = "text";
  let strictness: Strictness = "strict";
  let semanticTags: SemanticTags = DEFAULT_SEMANTIC_OPTIONS.semanticTags;
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
    "root",
    "url",
    "name",
    "starter",
    "bundler",
    "port",
    "host",
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
  if (command.kind === "help") {
    write(USAGE);
    return 0;
  }
  switch (command.kind) {
    case "lint":
      return await runLint(command, write, warn);
    case "check":
      return await runCheck(command, write, warn);
    case "init":
      return await runInit(command, write, warn);
    case "studio":
      return await runStudio(command, write, warn);
    case "mcp":
      return await runMcp(command, write, warn);
    case "lsp":
      return await runLsp(command, write, warn);
    case "theme":
      return await runTheme(command, write, warn);
    case "component":
      return await runComponent(command, write, warn);
  }
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

/** Make a project: a theme, and a build config that wires spin. */
async function runInit(
  command: InitCommand,
  write: (line: string) => void,
  warn: (line: string) => void,
): Promise<number> {
  const { resolveSpinClient } = await import("../api/index.ts");
  const { detectBundler } = await import("../project/service.ts");
  let { name, starter, bundler } = command;
  // Interactive when a TTY asks: prompt for what the flags did not say.
  const interactive = process.stdin.isTTY && !command.yes;
  if (interactive) {
    const { createInterface } = await import("node:readline/promises");
    const io = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const detected = bundler ?? await detectBundler(command.root);
      if (command.name === "default") {
        const answer = (await io.question(`theme name (default): `)).trim();
        if (answer !== "") name = answer;
      }
      if (command.starter === "spin") {
        const answer = (await io.question(`starter (spin): `)).trim();
        if (answer !== "") starter = answer;
      }
      if (command.bundler === undefined) {
        const answer = (await io.question(`bundler (${detected}): `)).trim();
        bundler = answer === "" ? detected : answer;
      }
    } finally {
      io.close();
    }
  }
  bundler ??= await detectBundler(command.root);
  const client = resolveSpinClient({ root: command.root, url: command.url });
  let result: { error: string | null };
  try {
    result = await client.project.init({
      root: command.root,
      name,
      starter,
      ...(bundler === undefined ? {} : { bundler: bundler as "vite" }),
      ...(command.themesDir === undefined ? {} : { themesDir: command.themesDir }),
      ...(command.componentsDir === undefined ? {} : { componentsDir: command.componentsDir }),
      ...(command.prefix === undefined ? {} : { prefix: command.prefix }),
      ...(command.vendor === undefined ? {} : { vendor: command.vendor }),
    });
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error));
    return 2;
  }
  if (result.error !== null) {
    warn(result.error);
    return 2;
  }
  write(`Initialized spin/${name}/tokens.json (${starter}, ${bundler})`);
  return 0;
}

/** Open the standalone studio: the API, and the studio beside it. */
async function runStudio(
  command: StudioCommand,
  write: (line: string) => void,
  _warn: (line: string) => void,
): Promise<number> {
  const { startDaemon } = await import("../api/daemon.ts");
  const daemon = await startDaemon({
    root: command.root,
    ...(command.port === undefined ? {} : { port: command.port }),
    ...(command.host === undefined ? {} : { hostname: command.host }),
  });
  write(`${daemon.url} — rpc`);
  write(`${new URL("/studio/", daemon.url)} — studio`);
  // The process stays up serving: never resolve while the daemon lives.
  return await new Promise<never>(() => {});
}

/** Run the language server over stdio. */
async function runLsp(
  command: LspCommand,
  _write: (line: string) => void,
  _warn: (line: string) => void,
): Promise<number> {
  const { handleMessage, createState } = await import("../lsp/server.ts");
  const { encodeFrame, readFrames } = await import("../lsp/protocol.ts");
  const state = createState(command.root ?? process.cwd());
  let shutdown = false;
  process.stdin.on("end", () => process.exit(shutdown ? 0 : 1));
  for await (const message of readFrames(process.stdin)) {
    for (const reply of await handleMessage(state, message)) {
      process.stdout.write(encodeFrame(reply));
    }
    if (message.method === "shutdown") shutdown = true;
    if (message.method === "exit") process.exit(shutdown ? 0 : 1);
  }
  return 0;
}

/** Run the agent server over stdio. */
async function runMcp(
  command: McpCommand,
  _write: (line: string) => void,
  _warn: (line: string) => void,
): Promise<number> {
  const { resolveSpinClient } = await import("../api/index.ts");
  const { buildSpinMcpServer } = await import("../mcp/server.ts");
  const { StdioServerTransport } = await import(
    "@modelcontextprotocol/server/stdio"
  );
  const server = buildSpinMcpServer(
    resolveSpinClient({ root: command.root, url: command.url }),
  );
  await server.connect(new StdioServerTransport());
  return 0;
}

/** The cross-theme report: every worn class, under every shipped theme. */
async function runCrossTheme(
  command: ThemeCommand,
  entries: Array<{ name: string; text?: string | null }>,
  write: (line: string) => void,
  warn: (line: string) => void,
): Promise<number> {
  const {
    analyzeCrossTheme,
    crossThemeJson,
    formatCrossThemeText,
  } = await import("./cross-theme.ts");
  const { readConfiguration } = await import("../project/service.ts");
  const root = command.root ?? process.cwd();
  const themes: Record<string, unknown> = {};
  for (const entry of entries) {
    const text = entry.text !== undefined && entry.text !== null
      ? entry.text
      : null;
    if (text === null) {
      warn(`no theme named "${entry.name}" in this project.`);
      return 2;
    }
    try {
      themes[entry.name] = JSON.parse(text);
    } catch {
      warn(`${entry.name}: not a JSON document this run can compare.`);
      return 2;
    }
  }
  let shortcuts: Record<string, readonly string[]> = {};
  try {
    shortcuts = (await readConfiguration(root)).shortcuts;
  } catch {
    // No configuration: no project compositions to judge.
  }
  let report;
  try {
    report = await analyzeCrossTheme({ root, themes, shortcuts });
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error));
    return 2;
  }
  if (command.format === "json") {
    write(JSON.stringify(crossThemeJson(report), null, 2));
  } else {
    for (const line of formatCrossThemeText(report)) write(line);
    if (!report.clean) write(`${report.gaps.length} cross-theme gap${report.gaps.length === 1 ? "" : "s"} — switching themes unstyles these classes.`);
  }
  return report.clean ? 0 : 1;
}

/** The shared-scale key contract: the keys the shipped set owes each other. */
async function runContract(
  command: ThemeCommand,
  entries: Array<{ name: string; text?: string | null }>,
  names: readonly string[],
  write: (line: string) => void,
  warn: (line: string) => void,
): Promise<number> {
  const {
    analyzeContract,
    contractInsertions,
    contractJson,
    formatContractMigrate,
    formatContractText,
  } = await import("./contract-parity.ts");
  const wanted = names.length > 0 ? names : entries.map((entry) => entry.name);
  const themes: Record<string, unknown> = {};
  for (const name of wanted) {
    const entry = entries.find((candidate) => candidate.name === name);
    const text = entry?.text !== undefined && entry?.text !== null
      ? entry.text
      : null;
    if (text === null) {
      warn(`no theme named "${name}" in this project.`);
      return 2;
    }
    try {
      themes[name] = JSON.parse(text);
    } catch {
      warn(`${name}: not a JSON document this run can compare.`);
      return 2;
    }
  }
  const report = analyzeContract({ themes });
  if (command.format === "json") {
    const base = contractJson(report);
    if (!command.migrate) {
      write(JSON.stringify(base, null, 2));
    } else {
      const migrate = contractInsertions({ report, themes }).map(
        (insertion) => ({ ...insertion }),
      );
      write(JSON.stringify({ ...base, migrate }, null, 2));
    }
  } else {
    for (const line of formatContractText(report)) write(line);
    if (command.migrate && !report.clean) {
      for (
        const line of formatContractMigrate(
          contractInsertions({ report, themes }),
        )
      ) write(line);
    }
  }
  return report.clean ? 0 : 1;
}


/** Read the themes: list, analyze, or scaffold one. */
async function runTheme(
  command: ThemeCommand,
  write: (line: string) => void,
  warn: (line: string) => void,
): Promise<number> {
  const { resolveSpinClient } = await import("../api/index.ts");
  const client = resolveSpinClient({ root: command.root, url: command.url });
  const print = (value: unknown): void => {
    write(
      command.format === "json" ? JSON.stringify(value, null, 2) : textOf(value),
    );
  };
  try {
    if (command.action === "list") {
      const listed = await client.project.themes.list({
        ...(command.root === undefined ? {} : { root: command.root }),
      });
      print(listed.map((entry) => entry.name));
      return 0;
    }
    if (command.action === "scaffold") {
      const scaffolded = await client.theme.scaffold({});
      write(scaffolded.text);
      return 0;
    }
    // `--contract` answers the per-pair question: whether the shipped set
    // declares the same scale keys. `--migrate` needs that question asked:
    // without it there is no gap to place.
    if (command.migrate && !command.contract) {
      warn("--migrate lists the contract's missing keys: pass --contract with it.");
      return 2;
    }
    if (command.contract) {
      const listed = await client.project.themes.list({
        ...(command.root === undefined ? {} : { root: command.root }),
      });
      let names = [...(command.contractThemes ?? [])];
      if (names.length === 0) {
        try {
          const { readConfig } = await import("../project/service.ts");
          const root = command.root ?? process.cwd();
          names = [...(await readConfig(root)).config.contractThemes ?? []];
        } catch {
          // No configuration: no shipped set to compare.
        }
      }
      if (names.length === 0) {
        warn("the contract compares a shipped set: name themes with --contract=a,b, or set contractThemes in spin/config.json.");
        return 2;
      }
      return await runContract(command, listed, names, write, warn);
    }
    // A name answers the single-theme question: whether that document
    // validates. No name answers the cross-theme one: whether the corpus
    // the project wears survives every shipped theme. The listing carries
    // the text, so no second read is needed.
    const entries = command.name === undefined
      ? await client.project.themes.list({
        ...(command.root === undefined ? {} : { root: command.root }),
      })
      : await client.project.themes.list({
        ...(command.root === undefined ? {} : { root: command.root }),
      }).then((listed) => listed.filter((entry) => entry.name === command.name));
    if (command.name === undefined && entries.length === 0) {
      warn("no themes in this project.");
      return 2;
    }
    if (command.name !== undefined && entries.length === 0) {
      warn(`no theme named "${command.name}" in this project.`);
      return 2;
    }
    if (command.name === undefined) {
      return await runCrossTheme(command, entries, write, warn);
    }
    const results: Array<{
      name: string;
      error: string | null;
      issues: Array<{ path: string; message: string }>;
    }> = [];
    for (const entry of entries) {
      const read = entry.text !== undefined && entry.text !== null
        ? { text: entry.text as string }
        : await client.project.themes.read({
          name: entry.name,
          ...(command.root === undefined ? {} : { root: command.root }),
        });
      if (read.text === null) {
        warn(`no theme named "${entry.name}" in this project.`);
        return 2;
      }
      const analysis = await client.theme.analyze({ text: read.text });
      results.push({
        name: entry.name,
        error: analysis.error,
        issues: [...analysis.issues],
      });
    }
    if (command.format === "json") {
      write(
        JSON.stringify(
          {
            name: results[0]?.name,
            valid: (results[0]?.error ?? null) === null &&
              (results[0]?.issues.length ?? 1) === 0,
            error: results[0]?.error ?? null,
            issues: results[0]?.issues ?? [],
          },
          null,
          2,
        ),
      );
    } else {
      for (const result of results) {
        if (result.error !== null) {
          write(`${result.name}: ${result.error}`);
          continue;
        }
        if (result.issues.length === 0) {
          write(`${result.name}: valid`);
          continue;
        }
        write(result.name);
        for (const issue of result.issues) {
          write(`  ${issue.path ? `${issue.path}: ` : ""}${issue.message}`);
        }
      }
    }
    return results.some((result) =>
      result.error !== null || result.issues.length > 0
    )
      ? 1
      : 0;
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

/** Read the components: list, contract, or copy an example. */
async function runComponent(
  command: ComponentCommand,
  write: (line: string) => void,
  warn: (line: string) => void,
): Promise<number> {
  const { resolveSpinClient } = await import("../api/index.ts");
  const client = resolveSpinClient({ root: command.root, url: command.url });
  const print = (value: unknown): void => {
    write(
      command.format === "json" ? JSON.stringify(value, null, 2) : textOf(value),
    );
  };
  try {
    if (command.action === "list") {
      const listed = await client.components.list({});
      print(listed);
      return 0;
    }
    if (command.name === undefined) {
      warn(`component ${command.action} needs a component name.`);
      return 2;
    }
    if (command.action === "contract") {
      const resolved = await client.components.contract({ name: command.name });
      print(resolved);
      return 0;
    }
    if (command.example === undefined) {
      warn("component copy needs an example name.");
      return 2;
    }
    const copied = await client.components.copy({
      name: command.name,
      example: command.example,
      ...(command.root === undefined ? {} : { root: command.root }),
    });
    if (copied.error !== null) {
      warn(copied.error);
      return 2;
    }
    print(copied);
    return 0;
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

/** A value as text: one line per string, JSON for the rest. */
function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value.join("\n");
  }
  return JSON.stringify(value, null, 2);
}
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
