import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { initProject } from "../../src/project/service.ts";

/** A greenfield root: an empty temp directory. */
async function fixture(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "spin-init-linter-"));
}

/** The project's `.oxlintrc.json`, read off disk. */
async function oxlintOf(dir: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(join(dir, ".oxlintrc.json"), "utf8")) as Record<
    string,
    unknown
  >;
}

test("oxlint init writes the spin plugin and the spin rules", async () => {
  const dir = await fixture();
  try {
    const result = await initProject({
      root: dir,
      name: "brand",
      language: "minimal",
      linter: "oxlint",
    });
    deepStrictEqual(result.error, null);
    const config = await oxlintOf(dir);
    const plugins = config["jsPlugins"] as unknown[];
    deepStrictEqual(
      plugins.some((entry) => String(entry).includes("@spinjs/dev/diagnostics")),
      true,
    );
    const rules = config["rules"] as Record<string, unknown>;
    deepStrictEqual(rules["spin/closed-vocabulary"], "error");
    deepStrictEqual(rules["spin/no-redundant-class"], "error");
    deepStrictEqual(rules["spin/prefer-theme-value"], "error");
    deepStrictEqual(rules["spin/no-unpaired-ink"], "error");
    deepStrictEqual(rules["spin/no-handwritten-tokens"], "error");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("oxlint init merges into an existing config without dropping its keys", async () => {
  const dir = await fixture();
  try {
    await writeFile(
      join(dir, ".oxlintrc.json"),
      JSON.stringify(
        { jsPlugins: ["./local-plugin.js"], rules: { "no-debugger": "warn" } },
        null,
        2,
      ),
      "utf8",
    );
    const result = await initProject({
      root: dir,
      name: "brand",
      language: "minimal",
      linter: "oxlint",
    });
    deepStrictEqual(result.error, null);
    const config = await oxlintOf(dir);
    const plugins = (config["jsPlugins"] as unknown[]).map(String);
    deepStrictEqual(plugins.includes("./local-plugin.js"), true);
    deepStrictEqual(
      plugins.some((entry) => entry.includes("@spinjs/dev/diagnostics")),
      true,
    );
    const rules = config["rules"] as Record<string, unknown>;
    deepStrictEqual(rules["no-debugger"], "warn");
    deepStrictEqual(rules["spin/closed-vocabulary"], "error");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("oxlint init leaves a configured rule override alone", async () => {
  const dir = await fixture();
  try {
    await writeFile(
      join(dir, ".oxlintrc.json"),
      JSON.stringify({ rules: { "spin/closed-vocabulary": "warn" } }, null, 2),
      "utf8",
    );
    const result = await initProject({
      root: dir,
      name: "brand",
      language: "minimal",
      linter: "oxlint",
    });
    deepStrictEqual(result.error, null);
    const rules = (await oxlintOf(dir))["rules"] as Record<string, unknown>;
    deepStrictEqual(rules["spin/closed-vocabulary"], "warn");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("eslint init writes a config that spreads the spin preset", async () => {
  const dir = await fixture();
  try {
    const result = await initProject({
      root: dir,
      name: "brand",
      language: "minimal",
      linter: "eslint",
    });
    deepStrictEqual(result.error, null);
    const config = await readFile(join(dir, "eslint.config.mjs"), "utf8");
    deepStrictEqual(config.includes('from "@spinjs/dev/eslint"'), true);
    deepStrictEqual(config.includes("spin.configs.recommended"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("eslint init leaves an existing config alone", async () => {
  const dir = await fixture();
  try {
    await writeFile(join(dir, "eslint.config.mjs"), "export default [];\n", "utf8");
    const result = await initProject({
      root: dir,
      name: "brand",
      language: "minimal",
      linter: "eslint",
    });
    deepStrictEqual(result.error, null);
    deepStrictEqual(await readFile(join(dir, "eslint.config.mjs"), "utf8"), "export default [];\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("skill init writes the project skill naming the brand directory", async () => {
  const dir = await fixture();
  try {
    const result = await initProject({
      root: dir,
      name: "acme",
      language: "minimal",
      skill: true,
    });
    deepStrictEqual(result.error, null);
    const skill = await readFile(join(dir, ".agents/skills/spin/SKILL.md"), "utf8");
    deepStrictEqual(skill.includes("spin/acme/"), true);
    deepStrictEqual(skill.includes(".mcp.json"), true);
    deepStrictEqual(skill.includes("linter"), true);
    deepStrictEqual(skill.includes("@spinjs/components"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
