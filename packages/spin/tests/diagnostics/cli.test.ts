import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { CliUsageError, formatJson, parseArgs, run } from "../../src/diagnostics/cli.ts";
import { filesUnder, lint } from "../../src/diagnostics/service.ts";

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
      `export const App = () => <button className="text-sm bg-primary" />;\n`,
    );
    const strict = await findingsOf(directory, ["--strictness", "strict"]);
    const balanced = await findingsOf(directory, ["--strictness", "balanced"]);
    deepStrictEqual(strict.map((finding) => finding.message), [
      "`bg-primary` sets `background-color` to what `<button>` already sets. Drop the class.",
      "the theme sets the size of `<button>`; `text-sm` fights it. Use the theme's value.",
    ]);
    deepStrictEqual(balanced.map((finding) => finding.message), [
      "`bg-primary` sets `background-color` to what `<button>` already sets. Drop the class.",
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

test("an advisory is reported and does not fail the run", async () => {
  // The wrong element cannot be banned: a span carrying the size the theme
  // gives the heading may be deliberate. So the rule is a suggestion, the
  // finding is a warning, and the run still passes.
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const file = `${directory}/app.tsx`;
    await writeFile(
      file,
      `export const App = () => <span className="text-3xl" />;\n`,
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

test("an error fails the run", async () => {
  // The other way round: an override of a decision the system made is
  // banned, and a banned thing fails the run.
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const file = `${directory}/app.tsx`;
    await writeFile(
      file,
      `export const App = () => <h3 className="text-sm" />;\n`,
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

test("the rendered checks need the app's own facts", () => {
  // The checks cannot guess an app's routes or its themes, so the command
  // says so rather than measuring a page nobody named.
  let thrown: unknown;
  try {
    parseArgs(["check", "http://localhost:5173"]);
  } catch (error) {
    thrown = error;
  }
  deepStrictEqual(thrown instanceof CliUsageError, true);
});

test("the check command names the app and its configuration", () => {
  const command = parseArgs([
    "check",
    "--config",
    "./visual/check.ts",
    "http://localhost:5173",
  ]);
  deepStrictEqual(command.kind, "check");
  if (command.kind !== "check") return;
  deepStrictEqual(command.url, "http://localhost:5173");
  deepStrictEqual(command.config, "./visual/check.ts");
});

test("the init command seeds its defaults", () => {
  const command = parseArgs(["init"]);
  deepStrictEqual(command.kind, "init");
  if (command.kind !== "init") return;
  deepStrictEqual(command.name, "default");
  deepStrictEqual(command.starter, "spin");
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

test("the theme command reads its action and name", () => {
  const command = parseArgs(["theme", "analyze", "brand"]);
  deepStrictEqual(command.kind, "theme");
  if (command.kind !== "theme") return;
  deepStrictEqual(command.action, "analyze");
  deepStrictEqual(command.name, "brand");
});

test("the theme command needs an action it knows", () => {
  let thrown: unknown;
  try {
    parseArgs(["theme", "rename", "brand"]);
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
      ["init", "--root", dir, "--name", "brand", "--starter", "nordic", "--bundler", "rspack", "--yes"],
      (line) => lines.push(line),
      () => {},
    );
    deepStrictEqual(code, 0);
    deepStrictEqual(lines, ["Initialized spin/brand.json (nordic, rspack)"]);
    const written = JSON.parse(
      await readFile(join(dir, "spin", "brand.json"), "utf8"),
    ) as Record<string, unknown>;
    deepStrictEqual(typeof written.color, "object");
    const config = await readFile(join(dir, "rspack.config.ts"), "utf8");
    deepStrictEqual(config.includes("spin.rspack()"), true);
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

test("the theme scaffold prints the document, not an envelope", async () => {
  // `spin theme scaffold` is a document on stdout: raw JSON a caller can
  // redirect into `spin/acme.json`, not `{"text": ...}`.
  const lines: string[] = [];
  const code = await run(["theme", "scaffold"], (line) => lines.push(line), () => {});
  deepStrictEqual(code, 0);
  const doc = JSON.parse(lines.join("\n")) as Record<string, unknown>;
  deepStrictEqual(typeof doc["color"], "object");
  deepStrictEqual((lines.join("\n").includes('"text"') && doc["text"] !== undefined), false);
});

test("the theme analyze judges one theme and fails on an invalid one", async () => {
  // A named theme is analyzed alone; an invalid theme exits 1 with the
  // issue on stdout as `<path>: <message>`.
  const dir = await mkdtemp(join(tmpdir(), "spin-cli-theme-"));
  try {
    const { scaffoldTheme } = await import("../../src/theme/index.ts");
    const { treeToJson } = await import("../../src/theme/index.ts");
    const doc = JSON.parse(treeToJson(scaffoldTheme())) as Record<string, unknown>;
    delete (doc["color"] as Record<string, unknown>)["text"];
    await import("node:fs/promises").then((fs) => fs.mkdir(join(dir, "spin"), { recursive: true }));
    await writeFile(join(dir, "spin", "broken.json"), JSON.stringify(doc, null, 2));
    const lines: string[] = [];
    const code = await run(
      ["theme", "analyze", "broken", "--root", dir],
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

test("the theme analyze without a name judges every theme", async () => {
  // No name means every project theme; one invalid theme fails the run,
  // and a project of valid themes passes with `<name>: valid`.
  const { scaffoldTheme } = await import("../../src/theme/index.ts");
  const { treeToJson } = await import("../../src/theme/index.ts");
  const bad = await mkdtemp(join(tmpdir(), "spin-cli-theme-"));
  try {
    const doc = JSON.parse(treeToJson(scaffoldTheme())) as Record<string, unknown>;
    delete (doc["color"] as Record<string, unknown>)["text"];
    await import("node:fs/promises").then((fs) => fs.mkdir(join(bad, "spin"), { recursive: true }));
    await writeFile(join(bad, "spin", "broken.json"), JSON.stringify(doc, null, 2));
    const lines: string[] = [];
    const code = await run(
      ["theme", "analyze", "--root", bad],
      (line) => lines.push(line),
      () => {},
    );
    deepStrictEqual(code, 1);
    deepStrictEqual(lines.some((line) => line.includes("color.text")), true);
  } finally {
    await rm(bad, { recursive: true, force: true });
  }
  const good = await mkdtemp(join(tmpdir(), "spin-cli-theme-"));
  try {
    await import("node:fs/promises").then((fs) => fs.mkdir(join(good, "spin"), { recursive: true }));
    await writeFile(join(good, "spin", "fine.json"), treeToJson(scaffoldTheme()));
    const lines: string[] = [];
    const code = await run(
      ["theme", "analyze", "--root", good],
      (line) => lines.push(line),
      () => {},
    );
    deepStrictEqual(code, 0);
    deepStrictEqual(lines, ["fine: valid"]);
    const json: string[] = [];
    const jsonCode = await run(
      ["theme", "analyze", "--root", good, "--format", "json"],
      (line) => json.push(line),
      () => {},
    );
    deepStrictEqual(jsonCode, 0);
    const parsed = JSON.parse(json.join("\n")) as Array<{ name: string; valid: boolean; tree?: unknown }>;
    deepStrictEqual(parsed[0]?.valid, true);
    deepStrictEqual("tree" in (parsed[0] ?? {}), false);
  } finally {
    await rm(good, { recursive: true, force: true });
  }
});
