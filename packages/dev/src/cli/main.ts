/**
 * The CLI: a client of the service.
 *
 * Project scaffolding, brand reads, component reads, the studio, the agent
 * server, and the language server. The rules live in `@spinjs/diagnostics`
 * behind the oxlint and ESLint plugins — the CLI no longer walks source
 * itself.
 */

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeContract,
  contractInsertions,
  contractJson,
  formatContractMigrate,
  formatContractText,
} from "@spinjs/diagnostics";

/** A usage the CLI cannot make sense of. */
export class CliUsageError extends Error {}

/* ------------------------------------------------------------ the options -- */

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
  /** The design language to seed the theme from. */
  readonly language: string;
  /** The bundler the generated build config wires. Defaults to `"vite"`. */
  readonly bundler?: string;
  readonly themesDir?: string;
  readonly componentsDir?: string;
  readonly prefix?: string;
  /** Vendor the full design language text instead of a sparse `$extends` document. */
  readonly vendor?: boolean;
  /** The linter the generated config wires. Defaults to detected, else `"oxlint"` when prompting. */
  readonly linter?: "oxlint" | "eslint" | "none";
  /** Write the project agent skill under `skillDir` (defaults to `.agents/skills`). */
  readonly skill?: boolean;
  /** Target directory (relative to root) for project agent skills. */
  readonly skillDir?: string;
  /** Generate the `<brand>-brand` skill alongside the general `spin` skill. */
  readonly brandSkill?: boolean;
  /** The daemon to dial, when the procedures live elsewhere. */
  readonly url?: string;
  /** Seed from an existing brand directory instead of a design language. */
  readonly from?: string;
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


/** What the CLI was asked to do: read or rename a brand. */
export interface BrandCommand {
  readonly kind: "brand";
  readonly action: "list" | "analyze" | "rename";
  /** The brand the action reads, for `analyze`. */
  readonly name?: string;
  /** The name the brand takes, for `rename`. */
  readonly to?: string;
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


/** What the CLI was asked to do. */
export type Command =
  | InitCommand
  | StudioCommand
  | McpCommand
  | LspCommand
  | BrandCommand
  | ComponentCommand
  | HelpCommand;

/** What the CLI was asked to do when it was asked what it does. */
export interface HelpCommand {
  readonly kind: "help";
}

const USAGE = `spin — the project, its brands, and its components.
Usage:
  spin init [options]
  spin studio [options]
  spin mcp [options]
  spin lsp [options]
  spin brand <list|analyze|rename> [name] [options]
  spin component <list|contract|copy> [name] [example] [options]
  studio      open the standalone theme editor: the API, and the studio beside it
  mcp         run the agent server over stdio
  lsp         run the language server over stdio
  brand       read the brands: list; analyze one document, or the corpus across all; rename one
  component   read the components: list, contract, or copy an example
Options for init:
  --name <name>          the first theme's file stem (default: default)
  --language <language>  minimal | editorial | material | neobrutalist | neumorphic | glassmorphic (default: editorial)
  --bundler <bundler>    vite | rspack | webpack | rollup | rolldown | esbuild | bun | unocss (default: detected)
  --themes-dir <dir>     themes directory (default: spin)
  --components-dir <dir> components directory (default: src/lib/components)
  --vendor               vendor the full design language text instead of a sparse document
  --linter <linter>      oxlint | eslint | none (default: detected, else oxlint)
  --skill                write the project agent skill (default: .agents/skills/spin)
  --skill-dir <dir>      skill folder (.agents/skills | .claude/skills | .cursor/skills | custom)
  --brand-skill          generate <brand>-brand/SKILL.md beside the spin skill
  --no-skill             skip the project agent skill
  --from <dir>           seed from an existing brand directory instead of a design language
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

Options for brand:
  --root <dir>           the project root (default: the current directory)
  --url <url>            the daemon to dial (default: in-process)
  --format <text|json>   how the answer is printed (default: text)
  --contract[=a,b]       compare the scale keys across the shipped set (names the themes, or reads positionals)
  --migrate              list the missing scale keys with their neighbors (needs --contract)
  -h, --help             this text

Options for component:
  --root <dir>           the project root (default: the current directory)
  --url <url>            the daemon to dial (default: in-process)
  --format <text|json>   how the answer is printed (default: text)
  -h, --help             this text

Exit codes:
  0  nothing to report
  1  an error to report
  2  the CLI could not read what it was asked to read`;

/** Read the command line. */
export function parseArgs(argv: readonly string[]): Command {
  // A `--` is the end of the options: everything after it is the command,
  // whatever it is called.
  const [command, ...rest] = argv[0] === "--" ? argv.slice(1) : argv;
  if (command === undefined) {
    throw new CliUsageError(
      "Name a command: init, studio, mcp, lsp, brand, or component.",
    );
  }
  if (command === "-h" || command === "--help" || command === "help") {
    return { kind: "help" };
  }
  if (command === "lint") throw new CliUsageError(`Unknown command "lint". Run the spin rules through oxlint or ESLint instead.`);
  if (command === "init") return parseInit(rest);
  if (command === "studio") return parseStudio(rest);
  if (command === "mcp") return parseMcp(rest);
  if (command === "lsp") return parseLsp(rest);
  if (command === "brand") return parseBrand(rest);
  if (command === "component") return parseComponent(rest);
  throw new CliUsageError(`Unknown command "${command}".`);
}
/** Make a project: a theme, and a build config that wires spin. */
function parseInit(argv: readonly string[]): Command {
  let root = process.cwd();
  let name: string | undefined;
  let language: string | undefined;
  let bundler: string | undefined;
  let themesDir: string | undefined;
  let componentsDir: string | undefined;
  let prefix: string | undefined;
  let vendor: boolean | undefined;
  let linter: "oxlint" | "eslint" | "none" | undefined;
  let skill: boolean | undefined;
  let skillDir: string | undefined;
  let brandSkill: boolean | undefined;
  let url: string | undefined;
  let from: string | undefined;
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
      case "language":
        language = argument.value as string;
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
      case "linter": {
        const value = argument.value as string;
        if (value !== "oxlint" && value !== "eslint" && value !== "none") {
          throw new CliUsageError(
            `--linter takes oxlint, eslint, or none — not "${value}".`,
          );
        }
        linter = value;
        break;
      }
      case "skill":
        skill = true;
        break;
      case "skill-dir":
        skillDir = argument.value as string;
        skill ??= true;
        break;
      case "brand-skill":
        brandSkill = true;
        skill ??= true;
        break;
      case "no-skill":
        skill = false;
        break;
      case "url":
        url = argument.value as string;
        break;
      case "from":
        from = argument.value as string;
        break;
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
    language: language ?? "editorial",
    ...(bundler === undefined ? {} : { bundler }),
    ...(themesDir === undefined ? {} : { themesDir }),
    ...(componentsDir === undefined ? {} : { componentsDir }),
    ...(prefix === undefined ? {} : { prefix }),
    ...(vendor === undefined ? {} : { vendor }),
    ...(linter === undefined ? {} : { linter }),
    ...(skill === undefined ? {} : { skill }),
    ...(skillDir === undefined ? {} : { skillDir }),
    ...(brandSkill === undefined ? {} : { brandSkill }),
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

/** Read or rename a brand: list, analyze, or rename. */
function parseBrand(argv: readonly string[]): Command {
  let action: BrandCommand["action"] | undefined;
  let name: string | undefined;
  let to: string | undefined;
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
          if (argument.name !== "list" && argument.name !== "analyze" && argument.name !== "rename") {
            throw new CliUsageError(
              `brand takes list, analyze, or rename — not "${argument.name}".`,
            );
          }
          action = argument.name;
        } else {
          positionals.push(argument.name);
        }
    }
  }
  if (action === undefined) {
    throw new CliUsageError("brand needs an action: list, analyze, or rename.");
  }
  if (action === "rename") {
    // Rename takes exactly two names: the brand's, and the name it takes.
    if (positionals.length !== 2 || positionals[0] === undefined || positionals[1] === undefined) {
      throw new CliUsageError("brand rename needs the brand's name and the name it takes.");
    }
    name = positionals[0];
    to = positionals[1];
  } else if (action === "analyze" && contract) {
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
    kind: "brand",
    action,
    ...(name === undefined ? {} : { name }),
    ...(to === undefined ? {} : { to }),
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
    "config",
    "harness",
    "root",
    "url",
    "name",
    "language",
    "bundler",
    "themes-dir",
    "components-dir",
    "prefix",
    "linter",
    "skill-dir",
    "from",
    "port",
    "host",
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
    const short = argument.replace(/^--?/, "");
    const name = short === "y" ? "yes" : short === "h" ? "help" : short;
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


/* ------------------------------------------------------------------ the run -- */

/**
 * Run the CLI.
 *
 * The exit code is what a script reads: 0 when the command ran, 2 when the
 * CLI could not read what it was asked to read.
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
    case "init":
      return await runInit(command, write, warn);
    case "studio":
      return await runStudio(command, write, warn);
    case "mcp":
      return await runMcp(command, write, warn);
    case "lsp":
      return await runLsp(command, write, warn);
    case "brand":
      return await runBrand(command, write, warn);
    case "component":
      return await runComponent(command, write, warn);
  }
}

/** Make a project: a brand, and a build config that wires spin. */
async function runInit(
  command: InitCommand,
  write: (line: string) => void,
  warn: (line: string) => void,
): Promise<number> {
  const { resolveSpinClient } = await import("../api/index.ts");
  const { detectBundler } = await import("@spinjs/server/project");
  let { name, language, bundler, linter, skill, skillDir, brandSkill } = command;
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
      if (command.language === "editorial" && command.from === undefined) {
        const answer = (await io.question(`design language (editorial): `)).trim();
        if (answer !== "") language = answer;
      }
      if (command.bundler === undefined) {
        const answer = (await io.question(`bundler (${detected}): `)).trim();
        bundler = answer === "" ? detected : answer;
      }
      const { detectLinter } = await import("@spinjs/server/project");
      if (command.linter === undefined) {
        const detectedLinter = await detectLinter(command.root);
        const fallback = detectedLinter ?? "oxlint";
        const answer = (await io.question(`linter (oxlint, eslint, none) (${fallback}): `)).trim();
        const picked = answer === "" ? fallback : answer;
        if (picked !== "oxlint" && picked !== "eslint" && picked !== "none") {
          io.close();
          warn(`--linter takes oxlint, eslint, or none — not "${picked}".`);
          return 2;
        }
        linter = picked;
      }
      if (command.skill === undefined) {
        const answer = (
          await io.question(
            "agent skill dir (.agents/skills | .claude/skills | .cursor/skills | custom | skip): ",
          )
        ).trim();
        const lower = answer.toLowerCase();
        if (lower === "skip" || lower === "no" || lower === "n") {
          skill = false;
        } else {
          skill = true;
          if (answer !== "" && lower !== "y" && lower !== "yes") {
            skillDir = answer;
          }
          if (command.brandSkill === undefined) {
            const brandAnswer = (
              await io.question(`generate ${name}-brand skill? (y/N): `)
            )
              .trim()
              .toLowerCase();
            brandSkill = brandAnswer === "y" || brandAnswer === "yes";
          }
        }
      }
    } finally {
      io.close();
    }
  }
  bundler ??= await detectBundler(command.root);
  const client = resolveSpinClient({ root: command.root, url: command.url });
  const fail = (error: string): number => {
    warn(error);
    return 2;
  };
  try {
    // One flow, one owner: the project service creates the brand, writes the
    // build files, and stamps the design language — the CLI only prompts.
    const inited = await client.project.init({
      root: command.root,
      name,
      language,
      ...(bundler === undefined ? {} : { bundler: bundler as "vite" }),
      ...(command.themesDir === undefined ? {} : { themesDir: command.themesDir }),
      ...(command.componentsDir === undefined ? {} : { componentsDir: command.componentsDir }),
      ...(command.prefix === undefined ? {} : { prefix: command.prefix }),
      ...(command.vendor === undefined ? {} : { vendor: command.vendor }),
      ...(linter === undefined ? {} : { linter }),
      ...(skill === undefined ? {} : { skill }),
      ...(skillDir === undefined ? {} : { skillDir }),
      ...(brandSkill === undefined ? {} : { brandSkill }),
      ...(command.from === undefined ? {} : { from: command.from }),
    });
    if (inited.error !== null) return fail(inited.error);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
  write(`Initialized spin/${name}/tokens.json (${language}, ${bundler})`);
  return 0;
}

/** Open the standalone studio: the API, and the studio beside it. */
async function runStudio(
  command: StudioCommand,
  write: (line: string) => void,
  _warn: (line: string) => void,
): Promise<number> {
  const { startDaemon } = await import("@spinjs/server/daemon");
  const { createSpinApp } = await import("../api/index.ts");
  const daemon = await startDaemon({
    root: command.root,
    app: createSpinApp({ root: command.root, base: "/rpc" }),
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
  const { handleMessage, createState } = await import("../lsp/index.ts");
  const { encodeFrame, readFrames } = await import("../lsp/index.ts");
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
  const { createSpinMcpServer } = await import("../mcp/index.ts");
  const { StdioServerTransport } = await import(
    "@modelcontextprotocol/server/stdio"
  );
  const server = await createSpinMcpServer(
    resolveSpinClient({ root: command.root, url: command.url }),
  );
  const transport = new StdioServerTransport();
  await server.connect(transport);
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    transport.onclose = done;
    process.stdin.once("end", done);
  });
  return 0;
}

/** The cross-theme report: every worn class, under every shipped theme. */
async function runCrossTheme(
  command: BrandCommand,
  entries: Array<{ name: string; text?: string | null }>,
  write: (line: string) => void,
  warn: (line: string) => void,
): Promise<number> {
  const {
    analyzeCrossTheme,
    crossThemeJson,
    formatCrossThemeText,
  } = await import("../plugin/index.ts");
  const { readConfiguration } = await import("@spinjs/server/project");
  const root = command.root ?? process.cwd();
  const themes: Record<string, unknown> = {};
  for (const entry of entries) {
    const text = entry.text !== undefined && entry.text !== null
      ? entry.text
      : null;
    if (text === null) {
      warn(`no brand named "${entry.name}" in this project.`);
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
    const { readConfiguration, readProjectShortcutsFile } = await import("@spinjs/server/project");
    const { join } = await import("node:path");
    const config = await readConfiguration(root);
    shortcuts = readProjectShortcutsFile(join(root, config.themesDir)).shortcuts;
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
  command: BrandCommand,
  entries: Array<{ name: string; text?: string | null }>,
  names: readonly string[],
  write: (line: string) => void,
  warn: (line: string) => void,
): Promise<number> {
  const wanted = names.length > 0 ? names : entries.map((entry) => entry.name);
  const themes: Record<string, unknown> = {};
  for (const name of wanted) {
    const entry = entries.find((candidate) => candidate.name === name);
    const text = entry?.text !== undefined && entry?.text !== null
      ? entry.text
      : null;
    if (text === null) {
      warn(`no brand named "${name}" in this project.`);
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


/** Read the brands: list or analyze one. */
async function warnForeignFiles(root: string, warn: (line: string) => void): Promise<void> {
  try {
    const { foreignFiles, readConfiguration, resolveProjectDir } = await import("@spinjs/server/project");
    const { join } = await import("node:path");
    const config = await readConfiguration(root).catch(() => null);
    const value = config?.themesDir ?? "spin";
    const resolved = await resolveProjectDir(root, value, "themes").catch(() => null);
    if (resolved === null || resolved.file) return;
    for (const file of foreignFiles(resolved.path)) {
      warn(`${join(value, file)} is code inside the themes directory: themes hold DTCG JSON, config.json, shortcuts.json, and icons/ — move it out.`);
    }
  } catch {
    // No themes directory: nothing foreign in it.
  }
}

/** Read the brands: list or analyze one. */
async function runBrandRead(
  command: BrandCommand,
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
    await warnForeignFiles(command.root ?? process.cwd(), warn);
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
      const names = [...(command.contractThemes ?? [])];
      if (names.length === 0) {
        warn("the contract compares a shipped set: name themes with --contract=a,b.");
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
      warn("no brands in this project.");
      return 2;
    }
    if (command.name !== undefined && entries.length === 0) {
      warn(`no brand named "${command.name}" in this project.`);
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
        warn(`no brand named "${entry.name}" in this project.`);
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

/** Read or rename a brand. */
async function runBrand(
  command: BrandCommand,
  write: (line: string) => void,
  warn: (line: string) => void,
): Promise<number> {
  if (command.action === "rename") return await runBrandRename(command, write, warn);
  return await runBrandRead(command, write, warn);
}

/** Rename a brand: its directory, its seating, and the name inside. */
async function runBrandRename(
  command: BrandCommand,
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
    const root = command.root ?? process.cwd();
    const renamed = await client.project.brand.rename({
      root,
      brand: command.name as string,
      to: command.to as string,
    });
    if (renamed.error !== null) {
      warn(renamed.error);
      return 2;
    }
    print({ brand: command.to, renamedFrom: command.name });
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
