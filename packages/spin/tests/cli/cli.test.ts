import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { CliUsageError, formatJson, parseArgs, run } from "../../src/cli/main.ts";
import { filesUnder, lint } from "@spinjs/diagnostics";

/**
 * The CLI, on its own.
 *
 * The CLI is a client of the service: it reads the command line, asks the
 * service, and prints what came back. What matters here is that the
 * readings are the rules' readings — the same decisions the linters
 * deliver — and that a script can read the answer, whether it is a person
 * or a pipeline.
 */

/** A file with something to report, and a file with nothing. */
const DIRTY = `export function App() {
  return <span className="not-a-class" />;
}
`;

const CLEAN = `export function App() {
  return <span className="flex gap-2" />;
}
`;

/** A directory holding the two files. */
async function fixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  await writeFile(`${directory}/dirty.tsx`, DIRTY);
  await writeFile(`${directory}/clean.tsx`, CLEAN);
  return directory;
}

/** The CLI's findings, over a directory. */
async function findingsOf(
  directory: string,
  argv: readonly string[] = [],
): Promise<Awaited<ReturnType<typeof lint>>["findings"]> {
  const command = parseArgs(["lint", ...argv, directory]);
  if (command.kind !== "lint") throw new Error("not a lint command");
  const report = await lint(directory, undefined, {
    rules: command.rules,
    semantic: command.semantic,
  });
  return report.findings;
}

test("the CLI reports what the rules decided", async () => {
  const directory = await fixture();
  try {
    const findings = await findingsOf(directory);
    deepStrictEqual(findings.map((finding) => finding.ruleId), [
      "spin/closed-vocabulary",
    ]);
    deepStrictEqual(findings.map((finding) => finding.messageId), ["unknown"]);
    deepStrictEqual(findings.map((finding) => finding.line), [2]);
    deepStrictEqual(findings.map((finding) => finding.column), [16]);
    deepStrictEqual(findings.map((finding) => finding.file), [
      `${directory}/dirty.tsx`,
    ]);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("the CLI reads the files under a path, not the ones beside it", async () => {
  const directory = await fixture();
  try {
    const files = await filesUnder(directory);
    deepStrictEqual(files.toSorted(), [
      `${directory}/clean.tsx`,
      `${directory}/dirty.tsx`,
    ]);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("the dials are the rule's own", async () => {
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await writeFile(
      `${directory}/app.tsx`,
      `export const App = () => <button className="type-body bg-surface-raised" />;\n`,
    );
    const strict = await findingsOf(directory, ["--strictness", "strict"]);
    const balanced = await findingsOf(directory, ["--strictness", "balanced"]);
    deepStrictEqual(strict.map((finding) => finding.message), [
      "`bg-surface-raised` sets `background-color` to what `<button>` already sets. Drop the class.",
      "the theme sets the size of `<button>`; `type-body` fights it. Use the theme's value.",
    ]);
    deepStrictEqual(balanced.map((finding) => finding.message), [
      "`bg-surface-raised` sets `background-color` to what `<button>` already sets. Drop the class.",
    ]);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("the CLI applies the edits its findings carry", async () => {
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const file = `${directory}/app.tsx`;
    await writeFile(
      file,
      `export const App = () => <span className="not-a-class" />;\n`,
    );
    // A class the theme cannot produce styles nothing, so dropping it
    // changes nothing — and the CLI drops it.
    const code = await run(["lint", file, "--fix"], () => {});
    deepStrictEqual(code, 0);
    deepStrictEqual(
      await readFile(file, "utf8"),
      `export const App = () => <span className="" />;\n`,
    );
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("the CLI says what it fixed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const file = `${directory}/app.tsx`;
    await writeFile(
      file,
      `export const App = () => <span className="not-a-class" />;\n`,
    );
    const lines: string[] = [];
    const code = await run(["lint", file, "--fix"], (line) => lines.push(line));
    // The finding was settled by the edit, so there is nothing left to
    // report: the exit code says so.
    deepStrictEqual(code, 0);
    deepStrictEqual(lines, [""]);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("the JSON format is a machine's answer", async () => {
  const directory = await fixture();
  try {
    const findings = await findingsOf(directory);
    const report = JSON.parse(formatJson(findings)) as {
      findings: { ruleId: string; line: number; column: number }[];
      summary: { findings: number; files: number };
    };
    deepStrictEqual(report.findings.map((finding) => finding.ruleId), [
      "spin/closed-vocabulary",
    ]);
    deepStrictEqual(report.findings.map((finding) => finding.line), [2]);
    deepStrictEqual(report.findings.map((finding) => finding.column), [16]);
    deepStrictEqual(report.summary, { findings: 1, files: 1 });
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("the exit code is what a script reads", async () => {
  const directory = await fixture();
  try {
    const lines: string[] = [];
    const dirty = await run(
      ["lint", `${directory}/dirty.tsx`],
      (line) => lines.push(line),
    );
    deepStrictEqual(dirty, 1);
    deepStrictEqual(
      lines.join("\n"),
      [
        `${directory}/dirty.tsx`,
        "  2:16  spin/closed-vocabulary  `not-a-class` is not in the spin vocabulary and generates no CSS. Use a token, or drop it.",
        "",
        "1 finding",
      ].join("\n"),
    );

    const clean = await run(
      ["lint", `${directory}/clean.tsx`],
      (line) => lines.push(line),
    );
    deepStrictEqual(clean, 0);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("a lint with no path reads the whole tree", () => {
  // The product's own gate is this command with no arguments: no path
  // names the cwd, so a lint that judges only remembered paths has no
  // way to be invoked.
  const command = parseArgs(["lint"]);
  deepStrictEqual(command.kind, "lint");
  if (command.kind !== "lint") return;
  deepStrictEqual(command.paths, ["."]);
});

test("a path that cannot be read is reported", async () => {
  const lines: string[] = [];
  const warnings: string[] = [];
  const code = await run(
    ["lint", "/nowhere/at/all"],
    (line) => lines.push(line),
    (line) => warnings.push(line),
  );
  deepStrictEqual(code, 2);
  deepStrictEqual(warnings, ['Cannot read "/nowhere/at/all".']);
});

test("a file that does not parse is reported, not swallowed", async () => {
  // The CLI has no linter to fall back on, so a file it cannot read is
  // something the person running it has to know about.
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await writeFile(`${directory}/broken.tsx`, `export const = ;\n`);
    const warnings: string[] = [];
    const code = await run(
      ["lint", `${directory}/broken.tsx`],
      () => {},
      (line) => warnings.push(line),
    );
    deepStrictEqual(code, 2);
    deepStrictEqual(warnings, [`Could not read "${directory}/broken.tsx".`]);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("a shared ink is reported and does not fail the run", async () => {
  // The link's ink is carried twice, so which element the author meant is a
  // question the lint cannot answer. The rule names one and stays advisory:
  // a warning, and the run still passes. TYPE-c legs: a surviving
  // multi-carrier (the tracking atoms are removed — unknown, not advisory).
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const file = `${directory}/app.tsx`;
    await writeFile(
      file,
      `export const App = () => <div className="text-link" />;\n`,
    );
    const findings = await findingsOf(directory);
    deepStrictEqual(
      findings.map((finding) => [finding.ruleId, finding.severity]),
      [
        ["spin/prefer-element", "warning"],
      ],
    );
    const lines: string[] = [];
    deepStrictEqual(await run(["lint", file], (line) => lines.push(line)), 0);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("a removed atom is reported as unknown with a style suggestion", async () => {
  // TYPE-c (styles own type): `tracking-tight` is no longer vocabulary — the
  // closed vocabulary reports it as unknown with the style to wear instead.
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const file = `${directory}/app.tsx`;
    await writeFile(
      file,
      `export const App = () => <span className="tracking-tight" />;\n`,
    );
    const findings = await findingsOf(directory);
    deepStrictEqual(
      findings.map((finding) => finding.ruleId),
      ["spin/closed-vocabulary"],
    );
    const [finding] = findings;
    deepStrictEqual(finding?.messageId, "unknown");
    deepStrictEqual((finding?.remedy ?? "").includes("type-"), true);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("an error fails the run", async () => {
  // The other way round: an override of a decision the system made is
  // banned, and a banned thing fails the run.
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const file = `${directory}/app.tsx`;
    await writeFile(
      file,
      `export const App = () => <h3 className="type-body" />;\n`,
    );
    const findings = await findingsOf(directory);
    deepStrictEqual(
      findings.map((finding) => [finding.ruleId, finding.severity]),
      [
        ["spin/prefer-theme-value", "error"],
      ],
    );
    const lines: string[] = [];
    deepStrictEqual(await run(["lint", file], (line) => lines.push(line)), 1);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("an option the CLI does not know is a usage error", () => {
  let thrown: unknown;
  try {
    parseArgs(["lint", "--nonsense", "src"]);
  } catch (error) {
    thrown = error;
  }
  deepStrictEqual(thrown instanceof CliUsageError, true);
});

test("a command the CLI does not know is a usage error", () => {
  let thrown: unknown;
  try {
    parseArgs(["diagnose", "src"]);
  } catch (error) {
    thrown = error;
  }
  deepStrictEqual(thrown instanceof CliUsageError, true);
});

test("the init command seeds its defaults", () => {
  const command = parseArgs(["init"]);
  deepStrictEqual(command.kind, "init");
  if (command.kind !== "init") return;
  deepStrictEqual(command.name, "default");
  deepStrictEqual(command.starter, "editorial");
  deepStrictEqual(command.bundler, undefined);
  deepStrictEqual(command.yes, false);
});

test("the init command carries its flags", () => {
  const command = parseArgs([
    "init",
    "--name",
    "brand",
    "--starter",
    "nordic",
    "--bundler",
    "rspack",
    "--root",
    "/tmp/x",
    "--yes",
  ]);
  deepStrictEqual(command.kind, "init");
  if (command.kind !== "init") return;
  deepStrictEqual(command.name, "brand");
  deepStrictEqual(command.starter, "nordic");
  deepStrictEqual(command.bundler, "rspack");
  deepStrictEqual(command.root, "/tmp/x");
  deepStrictEqual(command.yes, true);
});

test("the studio command defaults to the current directory", () => {
  const command = parseArgs(["studio"]);
  deepStrictEqual(command.kind, "studio");
  if (command.kind !== "studio") return;
  deepStrictEqual(command.port, undefined);
  deepStrictEqual(command.host, undefined);
});

test("the studio command carries its port and host", () => {
  const command = parseArgs([
    "studio",
    "--root",
    "/tmp/x",
    "--port",
    "8080",
    "--host",
    "0.0.0.0",
  ]);
  deepStrictEqual(command.kind, "studio");
  if (command.kind !== "studio") return;
  deepStrictEqual(command.root, "/tmp/x");
  deepStrictEqual(command.port, 8080);
  deepStrictEqual(command.host, "0.0.0.0");
});

test("the studio command refuses a port that is not a port", () => {
  let thrown: unknown;
  try {
    parseArgs(["studio", "--port", "http"]);
  } catch (error) {
    thrown = error;
  }
  deepStrictEqual(thrown instanceof CliUsageError, true);
});

test("the brand command reads its action and name", () => {
  const command = parseArgs(["brand", "analyze", "brand"]);
  deepStrictEqual(command.kind, "brand");
  if (command.kind !== "brand") return;
  deepStrictEqual(command.action, "analyze");
  deepStrictEqual(command.name, "brand");
  deepStrictEqual(command.contract, false);
  deepStrictEqual(command.migrate, false);
});

test("the brand command reads the contract set from positionals or the flag", () => {
  const positional = parseArgs(["brand", "analyze", "--contract", "full", "narrow"]);
  deepStrictEqual(positional.kind, "brand");
  if (positional.kind !== "brand") return;
  deepStrictEqual(positional.contract, true);
  deepStrictEqual(positional.contractThemes, ["full", "narrow"]);
  deepStrictEqual(positional.name, undefined);
  const comma = parseArgs(["brand", "analyze", "--contract", "full,narrow"]);
  deepStrictEqual(comma.kind, "brand");
  if (comma.kind !== "brand") return;
  deepStrictEqual(comma.contractThemes, ["full", "narrow"]);
  const flagged = parseArgs(["brand", "analyze", "--contract=full,narrow", "--migrate"]);
  deepStrictEqual(flagged.kind, "brand");
  if (flagged.kind !== "brand") return;
  deepStrictEqual(flagged.contract, true);
  deepStrictEqual(flagged.contractThemes, ["full", "narrow"]);
  deepStrictEqual(flagged.migrate, true);
});

test("the brand command needs an action it knows", () => {
  let thrown: unknown;
  try {
    parseArgs(["brand", "scaffold", "brand"]);
  } catch (error) {
    thrown = error;
  }
  deepStrictEqual(thrown instanceof CliUsageError, true);
});

test("the component command reads its action, name, and example", () => {
  const command = parseArgs(["component", "copy", "tree-view", "basic"]);
  deepStrictEqual(command.kind, "component");
  if (command.kind !== "component") return;
  deepStrictEqual(command.action, "copy");
  deepStrictEqual(command.name, "tree-view");
  deepStrictEqual(command.example, "basic");
});

test("the component list needs no name", () => {
  const command = parseArgs(["component", "list"]);
  deepStrictEqual(command.kind, "component");
  if (command.kind !== "component") return;
  deepStrictEqual(command.action, "list");
  deepStrictEqual(command.name, undefined);
});

test("init writes a theme and a bundler config into a fresh root", async () => {
  const dir = await mkdtemp(join(tmpdir(), "spin-cli-init-"));
  try {
    const lines: string[] = [];
    const code = await run(
      ["init", "--root", dir, "--name", "brand", "--starter", "neobrutalist", "--bundler", "rspack", "--yes"],
      (line) => lines.push(line),
      () => {},
    );
    deepStrictEqual(code, 0);
    deepStrictEqual(lines, ["Initialized spin/brand/tokens.json (neobrutalist, rspack)"]);
    const written = JSON.parse(
      await readFile(join(dir, "spin", "brand", "tokens.json"), "utf8"),
    ) as Record<string, unknown>;
    deepStrictEqual(written["$extends"], "neobrutalist");
    deepStrictEqual(written["color"], undefined);
    const config = await readFile(join(dir, "rspack.config.ts"), "utf8");
    deepStrictEqual(config.includes("spin.rspack()"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("init refuses an unknown design language", async () => {
  const dir = await mkdtemp(join(tmpdir(), "spin-cli-init-bad-"));
  try {
    const warns: string[] = [];
    const code = await run(
      ["init", "--root", dir, "--name", "brand", "--starter", "nordic", "--yes"],
      () => {},
      (line) => warns.push(line),
    );
    deepStrictEqual(code, 2, "the unknown language refuses");
    deepStrictEqual(
      warns.some((line) => line.includes("unknown design language") && line.includes("neobrutalist")),
      true,
      "the refusal names the language and the valid set",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("help answers as a command and as a flag", async () => {
  for (const argv of [["help"], ["--help"], ["-h"]]) {
    const lines: string[] = [];
    const code = await run(
      argv,
      (line) => lines.push(line),
      () => {},
    );
    deepStrictEqual(code, 0);
    deepStrictEqual(lines[0]?.startsWith("spin — "), true);
  }
});

test("the brand command refuses an unknown action", async () => {
  // No scaffold to print: the brand surface reads, analyzes, and renames,
  // and an action it does not know is a usage error, not a document.
  const lines: string[] = [];
  const warns: string[] = [];
  const code = await run(["brand", "scaffold"], (line) => lines.push(line), (line) => warns.push(line));
  deepStrictEqual(code, 2);
  deepStrictEqual(warns.some((line) => line.includes("list, analyze, or rename")), true);
});

test("the brand analyze judges one theme and fails on an invalid one", async () => {
  // A named theme is analyzed alone; an invalid theme exits 1 with the
  // issue on stdout as `<path>: <message>`.
  const dir = await mkdtemp(join(tmpdir(), "spin-cli-theme-"));
  try {
    const { starterThemes } = await import("@spinjs/theme/themes");
    const doc = structuredClone(starterThemes.minimal) as unknown as Record<string, unknown>;
    delete (doc["color"] as Record<string, unknown>)["text"];
    await import("node:fs/promises").then((fs) => fs.mkdir(join(dir, "spin"), { recursive: true }));
    await writeFile(join(dir, "spin", "broken.json"), JSON.stringify(doc, null, 2));
    const lines: string[] = [];
    const code = await run(
      ["brand", "analyze", "broken", "--root", dir],
      (line) => lines.push(line),
      () => {},
    );
    deepStrictEqual(code, 1);
    deepStrictEqual(lines[0], "broken");
    deepStrictEqual(lines.some((line) => line.includes("color.text")), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the theme analyze without a name compares the corpus across themes", async () => {
  // No name means the cross-theme report: every shipped theme must resolve
  // every class the project wears. One theme with a missing step fails the
  // run with the class, the wearing file, and the theme that drops it; a
  // project whose themes agree passes with the clean line.
  const { starterThemes } = await import("@spinjs/theme/themes");
  const split = await mkdtemp(join(tmpdir(), "spin-cli-theme-"));
  try {
    const full = structuredClone(starterThemes.minimal) as unknown as Record<string, unknown>;
    const narrow = structuredClone(full) as Record<string, Record<string, unknown>>;
    (full["spacing"] as Record<string, unknown>)["32"] = { $value: "8rem", $type: "dimension" };
    await import("node:fs/promises").then((fs) => fs.mkdir(join(split, "spin"), { recursive: true }));
    await writeFile(join(split, "spin", "full.json"), JSON.stringify(full, null, 2));
    await writeFile(join(split, "spin", "narrow.json"), JSON.stringify(narrow, null, 2));
    await writeFile(join(split, "app.tsx"), `export function App() {\n  return <div className="p-32">hi</div>;\n}\n`);
    const lines: string[] = [];
    const code = await run(
      ["brand", "analyze", "--root", split],
      (line) => lines.push(line),
      () => {},
    );
    deepStrictEqual(code, 1);
    deepStrictEqual(lines[0], "Cross-theme: every class your project wears must resolve under every shipped theme — switching themes never unstyles markup.");
    deepStrictEqual(lines.some((line) => line.includes("p-32") && line.includes("narrow")), true);
    deepStrictEqual(lines.some((line) => line.includes("full")), true);
    const json: string[] = [];
    const jsonCode = await run(
      ["brand", "analyze", "--root", split, "--format", "json"],
      (line) => json.push(line),
      () => {},
    );
    deepStrictEqual(jsonCode, 1);
    const report = JSON.parse(json.join("\n")) as {
      clean: boolean;
      themes: string[];
      gaps: Array<{ file: string; class: string; resolves: string[]; missing: string[] }>;
    };
    deepStrictEqual(report.clean, false);
    deepStrictEqual(report.themes, ["full", "narrow"]);
    deepStrictEqual(report.gaps.length, 1);
    deepStrictEqual(report.gaps[0]?.class, "p-32");
    deepStrictEqual(report.gaps[0]?.missing, ["narrow"]);
    deepStrictEqual(report.gaps[0]?.resolves, ["full"]);
    deepStrictEqual(report.gaps[0]?.file.endsWith("app.tsx"), true);
  } finally {
    await rm(split, { recursive: true, force: true });
  }
  const good = await mkdtemp(join(tmpdir(), "spin-cli-theme-"));
  try {
    const { starterThemes: shipped } = await import("@spinjs/theme/themes");
    await import("node:fs/promises").then((fs) => fs.mkdir(join(good, "spin"), { recursive: true }));
    await writeFile(join(good, "spin", "fine.json"), JSON.stringify(shipped.minimal, null, 2));
    await writeFile(join(good, "app.tsx"), `export function App() {\n  return <div className="flex gap-2">hi</div>;\n}\n`);
    const lines: string[] = [];
    const code = await run(
      ["brand", "analyze", "--root", good],
      (line) => lines.push(line),
      () => {},
    );
    deepStrictEqual(code, 0);
    deepStrictEqual(lines.length, 2);
    deepStrictEqual(lines[0], "Cross-theme: every class your project wears must resolve under every shipped theme — switching themes never unstyles markup.");
  } finally {
    await rm(good, { recursive: true, force: true });
  }
});
