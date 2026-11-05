import { test } from "bun:test";
/**
 * The project's operations, over a real directory.
 *
 * Every test writes to a temp root and reads it back: the contract is what a
 * consumer observes — a file that is there, a document that reads as it was
 * written, a refusal that names its reason — so the tests are about the
 * disk, not about the code that reaches it.
 */

import assert, { deepStrictEqual } from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  copyTheme,
  currentProject,
  detectProject,
  initProject,
  isWired,
  listThemes,
  readConfig,
  readConfiguration,
  readTheme,
  removeTheme,
  writeConfig,
  writeTheme,
} from "../../src/project/index.ts";

/** A root nothing has been written to. */
async function root(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "spin-project-"));
}

/** A root holding a themes directory and one theme file. */
async function projectWith(name: string, text: string): Promise<string> {
  const dir = await root();
  await mkdir(join(dir, "spin"));
  await writeFile(join(dir, "spin", `${name}.json`), text, "utf8");
  return dir;
}

/** A root whose configuration extends a brand module holding one theme. */
async function projectWithBrand(): Promise<string> {
  const dir = await root();
  await mkdir(join(dir, "spin"));
  await writeFile(
    join(dir, "brand.ts"),
    `export const acmeBrand = { themes: { halide: { color: { primary: { $value: "#123456" } } } } };\n`,
    "utf8",
  );
  await writeFile(
    join(dir, "vite.config.ts"),
    `import { acmeBrand } from "./brand.ts";\nimport { spin } from "@spinjs/spin/vite";\nexport default { plugins: [spin.vite({ extends: acmeBrand })] };\n`,
    "utf8",
  );
  return dir;
}

/** A root whose configuration declares its themes verbatim from a JSON module. */
async function projectVerbatim(): Promise<string> {
  const dir = await root();
  await mkdir(join(dir, "spin"));
  await writeFile(
    join(dir, "halide.json"),
    JSON.stringify({ color: { primary: { $value: "#123456" } } }),
    "utf8",
  );
  await writeFile(
    join(dir, "vite.config.ts"),
    `import halide from "./halide.json";\nimport { spin } from "@spinjs/spin/vite";\nexport default { plugins: [spin.vite({ themes: { halide } })] };\n`,
    "utf8",
  );
  return dir;
}

/** A root whose configuration extends an inline record import. */
async function projectWithRecord(): Promise<string> {
  const dir = await root();
  await mkdir(join(dir, "spin"));
  await writeFile(
    join(dir, "records.ts"),
    `export const records = { halide: { color: { primary: { $value: "#123456" } } } };\n`,
    "utf8",
  );
  await writeFile(
    join(dir, "vite.config.ts"),
    `import { records } from "./records.ts";\nimport { spin } from "@spinjs/spin/vite";\nexport default { plugins: [spin.vite({ extends: { themes: records } })] };\n`,
    "utf8",
  );
  return dir;
}

test("a root with themes and a wired config is a spin project", async () => {
  const dir = await root();
  await mkdir(join(dir, "spin"));
  await writeFile(join(dir, "spin", "acme.json"), "{}", "utf8");
  await writeFile(
    join(dir, "vite.config.ts"),
    'import { spin } from "@spinjs/spin";\nspin.vite();',
    "utf8",
  );

  const report = await detectProject(dir);
  deepStrictEqual(report.root, dir);
  deepStrictEqual(report.spin, true);
  deepStrictEqual(report.uno, true);
  deepStrictEqual(report.wired, true);
  deepStrictEqual(report.themes, ["acme.json"]);
});

test("a directory that holds no project reports itself as none", async () => {
  const report = await detectProject(await root());
  deepStrictEqual(report.spin, false);
  deepStrictEqual(report.uno, false);
  deepStrictEqual(report.wired, false);
  deepStrictEqual(report.themes, []);
});

test("a config that does not name spin is not wired", async () => {
  const dir = await root();
  await mkdir(join(dir, "spin"));
  await writeFile(
    join(dir, "vite.config.ts"),
    'import { defineConfig } from "vite";',
    "utf8",
  );

  const report = await detectProject(dir);
  deepStrictEqual(report.uno, true);
  deepStrictEqual(report.wired, false);
});

test("init makes a project: themes, a theme, and a wired config", async () => {
  const dir = await root();

  const made = await initProject({
    root: dir,
    name: "acme",
    starter: "silk",
  });
  deepStrictEqual(made.error, null);

  const report = await detectProject(dir);
  deepStrictEqual(report.spin, true);
  deepStrictEqual(report.uno, true);
  deepStrictEqual(report.wired, true);
  deepStrictEqual(report.themes, ["acme.json"]);

  // The config it wrote is one that applies spin — that is what "wired"
  // means, and the init test is where it is proven.
  const config = await readFile(join(dir, "vite.config.ts"), "utf8");
  deepStrictEqual(isWired(config), true);
  deepStrictEqual(config.includes("spin.vite()"), true);

  const writtenTheme = JSON.parse(await readFile(join(dir, "spin", "acme.json"), "utf8")) as {
    modes?: unknown;
    $extensions?: { spin?: { fonts?: readonly { family?: string }[] } };
  };
  deepStrictEqual(writtenTheme.modes, ["light", "dark"]);
  deepStrictEqual(writtenTheme.$extensions?.spin?.fonts?.[0]?.family, "Inter");

  const mcpConfig = JSON.parse(await readFile(join(dir, ".mcp.json"), "utf8")) as {
    mcpServers?: { spin?: { command?: string; args?: readonly string[] } };
  };
  deepStrictEqual(mcpConfig.mcpServers?.spin, {
    command: "npx",
    args: ["spin", "mcp"],
  });
});

test("init refuses a root it cannot make a project in", async () => {
  const dir = await root();
  await writeFile(join(dir, "occupied"), "not a directory", "utf8");

  const made = await initProject({
    root: join(dir, "occupied", "under"),
    name: "acme",
    starter: "silk",
  });
  assert(made.error !== null, "a refused init says why");
});

test("a project holds its own themes beside the brand it has not forked", async () => {
  const dir = await projectWithBrand();
  await writeFile(join(dir, "spin", "acme.json"), '{"own":true}', "utf8");

  const listed = await listThemes(dir);
  const own = listed.filter((theme) => theme.file !== null);
  deepStrictEqual(own.map((theme) => theme.name), ["acme"]);
  deepStrictEqual(own[0]?.file, join("spin", "acme.json"));
  deepStrictEqual(own[0]?.text, '{"own":true}');

  const brand = listed.filter((theme) => theme.file === null);
  deepStrictEqual(brand.map((theme) => theme.name), ["halide"]);
});

test("a project without a brand lists only its own files", async () => {
  const dir = await projectWith("acme", '{"own":true}');

  const listed = await listThemes(dir);
  deepStrictEqual(listed.map((theme) => theme.name), ["acme"]);
});

test("a forked brand theme replaces the brand theme it forked", async () => {
  const dir = await projectWithBrand();
  await writeFile(join(dir, "spin", "halide.json"), '{"forked":true}', "utf8");

  const listed = await listThemes(dir);
  const halide = listed.filter((theme) => theme.name === "halide");
  deepStrictEqual(halide.length, 1);
  deepStrictEqual(halide[0]?.file, join("spin", "halide.json"));
  deepStrictEqual(halide[0]?.text, '{"forked":true}');
});

test("a theme reads back exactly as it was written", async () => {
  const dir = await root();
  const text = '{\n  "color": { "primary": { "$value": "#1e40af" } }\n}\n';

  const written = await writeTheme(dir, "acme", text);
  deepStrictEqual(written.error, null);

  const read = await readTheme(dir, "acme");
  deepStrictEqual(read.text, text);
});

test("a write creates the themes directory the project did not have", async () => {
  const dir = await root();

  const written = await writeTheme(dir, "acme", "{}");
  deepStrictEqual(written.error, null);

  const listed = await listThemes(dir);
  deepStrictEqual(
    listed.filter((theme) => theme.file !== null).map((theme) => theme.name),
    ["acme"],
  );
});

test("a theme the project has not forked reads as the brand", async () => {
  const dir = await projectWithBrand();

  const read = await readTheme(dir, "halide");
  const document = JSON.parse(read.text ?? "{}") as Record<string, unknown>;
  assert(document["color"] !== undefined, "the brand reads as a document");
});

test("a theme that is neither a file nor brand reads as nothing", async () => {
  const read = await readTheme(await root(), "absent");
  deepStrictEqual(read.text, null);
});

test("a copy of a project's file is byte for byte", async () => {
  const dir = await projectWith("acme", '{"own":true}');

  const copied = await copyTheme(dir, "acme", "fork");
  deepStrictEqual(copied.error, null);

  const read = await readTheme(dir, "fork");
  deepStrictEqual(read.text, '{"own":true}');
});

test("a copy of a brand theme writes the brand's document", async () => {
  const dir = await projectWithBrand();

  const copied = await copyTheme(dir, "halide", "fork");
  deepStrictEqual(copied.error, null);

  const forked = await readTheme(dir, "fork");
  const brand = await readTheme(dir, "halide");
  deepStrictEqual(forked.text, brand.text);
});

test("a copy refuses a name that is taken", async () => {
  const dir = await projectWith("acme", '{"own":true}');

  const copied = await copyTheme(dir, "acme", "acme");
  deepStrictEqual(copied.error, "a theme named acme already exists");
});

test("a copy refuses a source that is neither a file nor brand", async () => {
  const copied = await copyTheme(await root(), "absent", "fork");
  deepStrictEqual(copied.error, "no theme named absent");
});

test("a remove takes the theme away", async () => {
  const dir = await projectWith("acme", '{"own":true}');

  const removed = await removeTheme(dir, "acme");
  deepStrictEqual(removed.error, null);

  const read = await readTheme(dir, "acme");
  deepStrictEqual(read.text, null);
});

test("a remove of a theme that is not there is refused", async () => {
  const removed = await removeTheme(await root(), "absent");
  assert(removed.error !== null, "a refused remove says why");
});

test("a write to a brand-only theme is refused", async () => {
  const dir = await projectWithBrand();

  const written = await writeTheme(dir, "halide", "{}");
  deepStrictEqual(
    written.error,
    "Brand theme 'halide' is read-only here; save as a local theme to fork it.",
  );
});

test("a remove of a brand-only theme is refused", async () => {
  const dir = await projectWithBrand();

  const removed = await removeTheme(dir, "halide");
  deepStrictEqual(
    removed.error,
    "Brand theme 'halide' is read-only here; save as a local theme to fork it.",
  );
});

test("a forked brand theme writes like any local file", async () => {
  const dir = await projectWithBrand();
  await writeFile(join(dir, "spin", "halide.json"), '{"forked":true}', "utf8");

  const written = await writeTheme(dir, "halide", '{"edited":true}');
  deepStrictEqual(written.error, null);
  deepStrictEqual((await readTheme(dir, "halide")).text, '{"edited":true}');
});

test("an inline record extends serves the imported record", async () => {
  const dir = await projectWithRecord();

  const listed = await listThemes(dir);
  deepStrictEqual(listed.map((theme) => theme.name), ["halide"]);
  deepStrictEqual(listed[0]?.file, null);
  const written = await writeTheme(dir, "halide", "{}");
  deepStrictEqual(
    written.error,
    "Brand theme 'halide' is read-only here; save as a local theme to fork it.",
  );
});

test("a verbatim configuration serves its declared documents", async () => {
  const dir = await projectVerbatim();
  await writeFile(join(dir, "spin", "acme.json"), '{"own":true}', "utf8");

  const listed = await listThemes(dir);
  deepStrictEqual(listed.map((theme) => theme.name), ["halide"]);
  deepStrictEqual(listed[0]?.file, null);
  const document = JSON.parse(listed[0]?.text ?? "{}") as Record<string, unknown>;
  assert(document["color"] !== undefined, "the declared document reads");

  const read = await readTheme(dir, "halide");
  deepStrictEqual(read.text, listed[0]?.text);
});

test("a write to a verbatim theme names where it is served from", async () => {
  const dir = await projectVerbatim();

  const written = await writeTheme(dir, "halide", "{}");
  deepStrictEqual(
    written.error,
    "Theme 'halide' is read-only here; it is served from './halide.json'.",
  );
});

test("a write to an undeclared name under verbatim says it would not serve", async () => {
  const dir = await projectVerbatim();

  const written = await writeTheme(dir, "fresh", "{}");
  deepStrictEqual(
    written.error,
    "Theme 'fresh' would not be served: 'vite.config.ts' declares its themes verbatim.",
  );
});

test("a copy under verbatim is refused like a write", async () => {
  const dir = await projectVerbatim();

  const copied = await copyTheme(dir, "halide", "fork");
  deepStrictEqual(
    copied.error,
    "Theme 'fork' would not be served: 'vite.config.ts' declares its themes verbatim.",
  );
});

test("an operation about one root leaves another root alone", async () => {
  const mine = await projectWith("acme", '{"mine":true}');
  const yours = await projectWith("acme", '{"yours":true}');

  await writeTheme(mine, "fresh", "{}");

  const theirs = await readTheme(yours, "acme");
  deepStrictEqual(theirs.text, '{"yours":true}');
  const theirListed = await listThemes(yours);
  deepStrictEqual(
    theirListed.filter((theme) => theme.file !== null).map((t) => t.name),
    ["acme"],
  );
});

test("the project in hand reads the same as the project named", async () => {
  const dir = await projectWith("acme", '{"own":true}');

  const named = await detectProject(dir);
  const current = await currentProject(dir);
  deepStrictEqual(current, named);
});

test("the root a report names is the root it examined", async () => {
  const dir = await root();
  const report = await detectProject(dir);
  deepStrictEqual(report.root, dir);
});

test("a project keeps no state between calls", async () => {
  const dir = await root();
  await writeTheme(dir, "acme", "{}");

  // The same root, read twice: the second read sees the first read's world.
  const first = await detectProject(dir);
  const second = await detectProject(dir);
  deepStrictEqual(second.themes, first.themes);
  deepStrictEqual(second.themes, ["acme.json"]);
});

test("a root that is not there holds no themes of its own", async () => {
  const dir = join(await root(), "never-made");

  const listed = await listThemes(dir);
  deepStrictEqual(
    listed.filter((theme) => theme.file !== null),
    [],
  );
  const report = await detectProject(dir);
  deepStrictEqual(report.spin, false);
});

test("init codemods an existing unwired vite.config.ts in place", async () => {
  const dir = await root();
  await writeFile(
    join(dir, "vite.config.ts"),
    'import { defineConfig } from "vite";\nimport solid from "vite-plugin-solid";\n\nexport default defineConfig({\n  plugins: [solid()],\n});\n',
    "utf8",
  );

  const made = await initProject({
    root: dir,
    name: "acme",
    starter: "silk",
  });
  deepStrictEqual(made.error, null);

  const config = await readFile(join(dir, "vite.config.ts"), "utf8");
  deepStrictEqual(isWired(config), true);
  deepStrictEqual(config.includes("solid()"), true);
  deepStrictEqual(config.includes("spin.vite()"), true);
});

test("init codemods an existing vite.config.js without a plugins array in place", async () => {
  const dir = await root();
  await writeFile(
    join(dir, "vite.config.js"),
    'import { defineConfig } from "vite";\n\nexport default defineConfig({\n  server: { port: 3000 },\n});\n',
    "utf8",
  );

  const made = await initProject({
    root: dir,
    name: "acme",
    starter: "silk",
  });
  deepStrictEqual(made.error, null);

  const config = await readFile(join(dir, "vite.config.js"), "utf8");
  deepStrictEqual(isWired(config), true);
  deepStrictEqual(config.includes("server: { port: 3000 }"), true);
  deepStrictEqual((await detectProject(dir)).wired, true);
});

test("init and configuration respect custom themesDir, componentsDir, and prefix", async () => {
  const dir = await root();

  const made = await initProject({
    root: dir,
    name: "acme",
    starter: "silk",
    themesDir: "design/themes",
    componentsDir: "src/ui",
    prefix: "coffee",
  });
  deepStrictEqual(made.error, null);

  const cfg = await readConfiguration(dir);
  deepStrictEqual(cfg.themesDir, "design/themes");
  deepStrictEqual(cfg.componentsDir, "src/ui");
  deepStrictEqual(cfg.prefix, "coffee");

  const report = await detectProject(dir);
  deepStrictEqual(report.spin, true);
  deepStrictEqual(report.themes, ["acme.json"]);
});
test("a listed theme names where it is served from", async () => {
  const dir = await projectWithBrand();
  await writeFile(join(dir, "spin", "acme.json"), '{"own":true}', "utf8");

  const listed = await listThemes(dir);
  const byName = Object.fromEntries(listed.map((theme) => [theme.name, theme.origin]));
  deepStrictEqual(byName, { acme: "local", halide: "brand" });
});

test("a verbatim listing names its entries verbatim", async () => {
  const dir = await projectVerbatim();

  const listed = await listThemes(dir);
  deepStrictEqual(listed.map((theme) => theme.origin), ["verbatim"]);
});

test("a written config reads back with the file that holds it", async () => {
  const dir = await root();

  const written = await writeConfig(dir, {
    activeTheme: "halide",
    themeOrder: ["halide", "acme"],
  });
  deepStrictEqual(written.error, null);

  const read = await readConfig(dir);
  deepStrictEqual(read.config, {
    activeTheme: "halide",
    themeOrder: ["halide", "acme"],
  });
  deepStrictEqual(read.file, join("spin", "config.json"));

  const onDisk = await readFile(join(dir, "spin", "config.json"), "utf8");
  deepStrictEqual(
    onDisk,
    `${JSON.stringify({ activeTheme: "halide", themeOrder: ["halide", "acme"] }, null, 2)}\n`,
  );
});

test("a project that never wrote a config reads the empty default", async () => {
  const dir = await projectWith("acme", '{"own":true}');

  const read = await readConfig(dir);
  deepStrictEqual(read.config, {});
  deepStrictEqual(read.file, null);
});

test("a half written config reads as the empty default, over its file", async () => {
  const dir = await projectWith("acme", '{"own":true}');
  await writeFile(join(dir, "spin", "config.json"), '{"activeTheme":', "utf8");

  const read = await readConfig(dir);
  deepStrictEqual(read.config, {});
  deepStrictEqual(read.file, join("spin", "config.json"));
});

test("a written contract set reads back with the file that holds it", async () => {
  const dir = await root();

  const written = await writeConfig(dir, { contractThemes: ["halide", "acme"] });
  deepStrictEqual(written.error, null);

  const read = await readConfig(dir);
  deepStrictEqual(read.config, { contractThemes: ["halide", "acme"] });
  deepStrictEqual(read.file, join("spin", "config.json"));
});

test("a config write creates the spin directory the project did not have", async () => {
  const dir = await root();

  const written = await writeConfig(dir, { activeTheme: "halide" });
  deepStrictEqual(written.error, null);

  const read = await readConfig(dir);
  deepStrictEqual(read.config, { activeTheme: "halide" });
});

test("config.json is not served as a theme", async () => {
  const dir = await projectWith("halide", "{}");
  await writeConfig(dir, { activeTheme: "halide" });

  const listed = await listThemes(dir);
  deepStrictEqual(listed.map((theme) => theme.name), ["halide"]);
  const report = await detectProject(dir);
  deepStrictEqual(report.themes, ["halide.json"]);
});
