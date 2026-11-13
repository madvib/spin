import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { CliUsageError, parseArgs, run } from "../../src/cli/main.ts";

/**
 * The CLI, on its own.
 *
 * The CLI reads the command line, asks the service, and prints what came
 * back. The rules themselves live behind the oxlint and ESLint plugins;
 * what matters here is that each remaining command reads its arguments and
 * a script can read the answer.
 */

test("an option the CLI does not know is a usage error", () => {
  let thrown: unknown;
  try {
    parseArgs(["brand", "list", "--nonsense"]);
  } catch (error) {
    thrown = error;
  }
  deepStrictEqual(thrown instanceof CliUsageError, true);
});

test("the retired lint command points at the linters", () => {
  let thrown: unknown;
  try {
    parseArgs(["lint", "src"]);
  } catch (error) {
    thrown = error;
  }
  deepStrictEqual(thrown instanceof CliUsageError, true);
  deepStrictEqual(
    (thrown as Error).message.includes("oxlint or ESLint"),
    true,
  );
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
  deepStrictEqual(command.language, "editorial");
  deepStrictEqual(command.bundler, undefined);
  deepStrictEqual(command.yes, false);
});

test("the init command carries its flags", () => {
  const command = parseArgs([
    "init",
    "--name",
    "brand",
    "--language",
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
  deepStrictEqual(command.language, "nordic");
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
      ["init", "--root", dir, "--name", "brand", "--language", "neobrutalist", "--bundler", "rspack", "--yes"],
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
      ["init", "--root", dir, "--name", "brand", "--language", "nordic", "--yes"],
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
    const { designLanguages } = await import("@spinjs/theme");
    const doc = structuredClone(designLanguages.minimal) as unknown as Record<string, unknown>;
    delete (doc["color"] as Record<string, unknown>)["text"];
    await import("node:fs/promises").then((fs) => fs.mkdir(join(dir, "spin", "broken"), { recursive: true }));
    await writeFile(join(dir, "spin", "broken", "tokens.json"), JSON.stringify(doc, null, 2));
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

test("brand analyze names code files inside the themes directory", async () => {
  // A themes directory holds documents, not modules: a `.ts` file inside
  // it is said aloud so it can move out.
  const dir = await mkdtemp(join(tmpdir(), "spin-cli-theme-"));
  try {
    const { designLanguages } = await import("@spinjs/theme");
    await import("node:fs/promises").then((fs) => fs.mkdir(join(dir, "spin", "fine"), { recursive: true }));
    await writeFile(join(dir, "spin", "fine", "tokens.json"), JSON.stringify(designLanguages.minimal, null, 2));
    await writeFile(join(dir, "spin", "theme.ts"), "export const x = 1;\n");
    const warns: string[] = [];
    const code = await run(
      ["brand", "analyze", "fine", "--root", dir],
      () => {},
      (line) => warns.push(line),
    );
    deepStrictEqual(code, 0);
    deepStrictEqual(
      warns.some((line) => line.includes(join("spin", "theme.ts")) && line.includes("code inside the themes directory")),
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the theme analyze without a name compares the corpus across themes", async () => {
  // No name means the cross-theme report: every shipped theme must resolve
  // every class the project wears. One theme with a missing step fails the
  // run with the class, the wearing file, and the theme that drops it; a
  // project whose themes agree passes with the clean line.
  const { designLanguages } = await import("@spinjs/theme");
  const split = await mkdtemp(join(tmpdir(), "spin-cli-theme-"));
  try {
    const full = structuredClone(designLanguages.minimal) as unknown as Record<string, unknown>;
    const narrow = structuredClone(full) as Record<string, Record<string, unknown>>;
    (full["spacing"] as Record<string, unknown>)["32"] = { $value: "8rem", $type: "dimension" };
    await import("node:fs/promises").then((fs) => fs.mkdir(join(split, "spin", "full"), { recursive: true }));
    await import("node:fs/promises").then((fs) => fs.mkdir(join(split, "spin", "narrow"), { recursive: true }));
    await writeFile(join(split, "spin", "full", "tokens.json"), JSON.stringify(full, null, 2));
    await writeFile(join(split, "spin", "narrow", "tokens.json"), JSON.stringify(narrow, null, 2));
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
    const { designLanguages: shipped } = await import("@spinjs/theme");
    await import("node:fs/promises").then((fs) => fs.mkdir(join(good, "spin", "fine"), { recursive: true }));
    await writeFile(join(good, "spin", "fine", "tokens.json"), JSON.stringify(shipped.minimal, null, 2));
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
