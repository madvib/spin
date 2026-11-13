import assert, { deepStrictEqual } from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installProjectSkills, projectSkillStatus } from "./skill.ts";

describe("project agent skill installation", () => {
  let root: string;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "spin-skill-"));
    mkdirSync(join(root, "spin", "acme"), { recursive: true });
    mkdirSync(join(root, "src", "lib", "components"), { recursive: true });
    writeFileSync(
      join(root, "spin", "config.json"),
      JSON.stringify({ brand: "acme", componentsDir: "src/lib/components" }),
    );
    writeFileSync(
      join(root, "spin", "acme", "brand.json"),
      JSON.stringify({ name: "acme", icons: { collection: "phosphor", stroke: "outline" } }),
    );
    writeFileSync(
      join(root, "spin", "acme", "tokens.json"),
      JSON.stringify({ $extends: "editorial", modes: ["light", "dark"] }),
    );
    writeFileSync(
      join(root, "spin", "shortcuts.json"),
      JSON.stringify({ shortcuts: { "page-shell": "mx-auto max-w-screen-lg" } }),
    );
    writeFileSync(
      join(root, "src", "lib", "components", "menu.html"),
      `<button type="button">Menu</button>\n`,
    );
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("writes general spin skill and <brand>-brand skill into a chosen directory", async () => {
    const result = await installProjectSkills({
      root,
      skillDir: ".claude/skills",
      general: true,
      brandSkill: true,
    });
    deepStrictEqual(result.error, null);
    deepStrictEqual(result.written, [
      ".claude/skills/spin/SKILL.md",
      ".claude/skills/acme-brand/SKILL.md",
    ]);

    const generalText = readFileSync(join(root, ".claude/skills/spin/SKILL.md"), "utf8");
    assert(generalText.includes("spin/acme/"));

    const brandText = readFileSync(join(root, ".claude/skills/acme-brand/SKILL.md"), "utf8");
    assert(brandText.includes("name: acme-brand"));
    assert(brandText.includes("`phosphor` (outline)"));
    assert(brandText.includes("`page-shell`"));
    assert(brandText.includes("`menu`"));

    const status = await projectSkillStatus(root);
    const claude = status.dirs.find((d) => d.dir === ".claude/skills");
    deepStrictEqual(claude, {
      dir: ".claude/skills",
      general: true,
      brandSkill: "acme-brand",
    });
  });

  it("refuses skill directories that escape the project root", async () => {
    const escaped = await installProjectSkills({
      root,
      skillDir: "../outside",
      general: true,
    });
    assert(escaped.error !== null && escaped.error.includes("escapes"));
    deepStrictEqual(escaped.written, []);
  });
});
