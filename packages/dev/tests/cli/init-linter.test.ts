import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { CliUsageError, parseArgs, run } from "../../src/cli/main.ts";

/** A greenfield root: an empty temp directory. */
async function fixture(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "spin-cli-init-lint-"));
}

test("the init command defaults to no linter and no skill flags", () => {
  const command = parseArgs(["init"]);
  deepStrictEqual(command.kind, "init");
  if (command.kind !== "init") return;
  deepStrictEqual(command.linter, undefined);
  deepStrictEqual(command.skill, undefined);
});

test("the init command carries its linter and skill flags", () => {
  const linter = parseArgs(["init", "--linter", "eslint"]);
  deepStrictEqual(linter.kind, "init");
  if (linter.kind !== "init") return;
  deepStrictEqual(linter.linter, "eslint");
  const none = parseArgs(["init", "--linter", "none"]);
  deepStrictEqual(none.kind, "init");
  if (none.kind !== "init") return;
  deepStrictEqual(none.linter, "none");
  const skill = parseArgs(["init", "--skill"]);
  deepStrictEqual(skill.kind, "init");
  if (skill.kind !== "init") return;
  deepStrictEqual(skill.skill, true);
  const noSkill = parseArgs(["init", "--no-skill"]);
  deepStrictEqual(noSkill.kind, "init");
  if (noSkill.kind !== "init") return;
  deepStrictEqual(noSkill.skill, false);
});

test("the init command refuses a linter it does not know", () => {
  let thrown: unknown;
  try {
    parseArgs(["init", "--linter", "biome"]);
  } catch (error) {
    thrown = error;
  }
  deepStrictEqual(thrown instanceof CliUsageError, true);
});

test("init --linter oxlint writes the spin plugin and the spin rules", async () => {
  const dir = await fixture();
  try {
    const lines: string[] = [];
    const code = await run(
      ["init", "--root", dir, "--name", "brand", "--language", "minimal", "--linter", "oxlint", "--yes"],
      (line) => lines.push(line),
      () => {},
    );
    deepStrictEqual(code, 0);
    const config = JSON.parse(await readFile(join(dir, ".oxlintrc.json"), "utf8")) as Record<
      string,
      unknown
    >;
    const plugins = (config["jsPlugins"] as unknown[]).map(String);
    deepStrictEqual(
      plugins.some((entry) => entry.includes("@spinjs/dev/diagnostics")),
      true,
    );
    const rules = config["rules"] as Record<string, unknown>;
    deepStrictEqual(rules["spin/closed-vocabulary"], "error");
    deepStrictEqual(rules["spin/no-redundant-class"], "error");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("init --linter eslint writes a config that spreads the spin preset", async () => {
  const dir = await fixture();
  try {
    const code = await run(
      ["init", "--root", dir, "--name", "brand", "--language", "minimal", "--linter", "eslint", "--yes"],
      () => {},
      () => {},
    );
    deepStrictEqual(code, 0);
    const config = await readFile(join(dir, "eslint.config.mjs"), "utf8");
    deepStrictEqual(config.includes('from "@spinjs/dev/eslint"'), true);
    deepStrictEqual(config.includes("spin.configs.recommended"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("init --skill writes the project skill naming the brand directory", async () => {
  const dir = await fixture();
  try {
    const code = await run(
      ["init", "--root", dir, "--name", "acme", "--language", "minimal", "--skill", "--yes"],
      () => {},
      () => {},
    );
    deepStrictEqual(code, 0);
    const skill = await readFile(join(dir, ".agents/skills/spin/SKILL.md"), "utf8");
    deepStrictEqual(skill.includes("spin/acme/"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
