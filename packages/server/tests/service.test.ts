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
  loadProjectBrand,
  readConfig,
  readConfiguration,
  readTheme,
  removeTheme,
  writeConfig,
  writeTheme,
} from "@spinjs/server/project";
import { parseTokens } from "@spinjs/theme";

/** A root nothing has been written to. */
async function root(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "spin-project-"));
}

/** A root holding a themes directory and one brand. */
async function projectWith(name: string, text: string): Promise<string> {
  const dir = await root();
  await mkdir(join(dir, "spin", name), { recursive: true });
  await writeFile(join(dir, "spin", name, "tokens.json"), text, "utf8");
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
    `import { acmeBrand } from "./brand.ts";\nimport { spin } from "@spinjs/dev/vite";\nexport default { plugins: [spin.vite({ extends: acmeBrand })] };\n`,
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
    `import halide from "./halide.json";\nimport { spin } from "@spinjs/dev/vite";\nexport default { plugins: [spin.vite({ themes: { halide } })] };\n`,
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
    `import { records } from "./records.ts";\nimport { spin } from "@spinjs/dev/vite";\nexport default { plugins: [spin.vite({ extends: { themes: records } })] };\n`,
    "utf8",
  );
  return dir;
}

test("a root with themes and a wired config is a spin project", async () => {
  const dir = await root();
  await mkdir(join(dir, "spin"));
  await mkdir(join(dir, "spin", "acme"));
  await writeFile(join(dir, "spin", "acme", "tokens.json"), "{}", "utf8");
  await writeFile(
    join(dir, "vite.config.ts"),
    'import { spin } from "@spinjs/dev/vite";\nspin.vite();',
    "utf8",
  );

  const report = await detectProject(dir);
  deepStrictEqual(report.root, dir);
  deepStrictEqual(report.spin, true);
  deepStrictEqual(report.uno, true);
  deepStrictEqual(report.wired, true);
  deepStrictEqual(report.themes, ["acme"]);
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
    language: "minimal",
  });
  deepStrictEqual(made.error, null);

  const report = await detectProject(dir);
  deepStrictEqual(report.spin, true);
  deepStrictEqual(report.uno, true);
  deepStrictEqual(report.wired, true);
  deepStrictEqual(report.themes, ["acme"]);

  // The config it wrote is one that applies spin — that is what "wired"
  // means, and the init test is where it is proven.
  const config = await readFile(join(dir, "vite.config.ts"), "utf8");
  deepStrictEqual(isWired(config), true);
  deepStrictEqual(config.includes("spin.vite()"), true);

  const writtenTheme = JSON.parse(await readFile(join(dir, "spin", "acme", "tokens.json"), "utf8")) as {
    modes?: unknown;
    $extends?: unknown;
    $extensions?: { spin?: { fonts?: readonly { family?: string }[] } };
  };
  deepStrictEqual(writtenTheme.modes, ["light", "dark"]);
  deepStrictEqual(writtenTheme.$extends, "minimal");
  deepStrictEqual(writtenTheme.$extensions, undefined);

  const mcpConfig = JSON.parse(await readFile(join(dir, ".mcp.json"), "utf8")) as {
    mcpServers?: { spin?: { command?: string; args?: readonly string[] } };
  };
  deepStrictEqual(mcpConfig.mcpServers?.spin, {
    command: "npx",
    args: ["spin", "mcp"],
  });
});

test("init with vendor:true writes the full design language text", async () => {
  const dir = await root();
  const made = await initProject({
    root: dir,
    name: "acme",
    language: "minimal",
    vendor: true,
  });
  deepStrictEqual(made.error, null);
  const writtenTheme = JSON.parse(await readFile(join(dir, "spin", "acme", "tokens.json"), "utf8")) as {
    $extends?: unknown;
    $extensions?: { spin?: { fonts?: readonly { family?: string }[] } };
  };
  deepStrictEqual(writtenTheme.$extends, undefined);
  deepStrictEqual(writtenTheme.$extensions?.spin?.fonts?.[0]?.family, "Inter");
});
test("init refuses a root it cannot make a project in", async () => {
  const dir = await root();
  await writeFile(join(dir, "occupied"), "not a directory", "utf8");

  const made = await initProject({
    root: join(dir, "occupied", "under"),
    name: "acme",
    language: "minimal",
  });
  assert(made.error !== null, "a refused init says why");
});

test("a project holds its own themes beside the brand it has not forked", async () => {
  const dir = await projectWithBrand();
  await mkdir(join(dir, "spin", "acme"));
  await writeFile(join(dir, "spin", "acme", "tokens.json"), '{"own":true}', "utf8");

  const listed = await listThemes(dir);
  const own = listed.filter((theme) => theme.file !== null);
  deepStrictEqual(own.map((theme) => theme.name), ["acme"]);
  deepStrictEqual(own[0]?.file, join("spin", "acme", "tokens.json"));
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
  await mkdir(join(dir, "spin", "halide"));
  await writeFile(join(dir, "spin", "halide", "tokens.json"), '{"forked":true}', "utf8");

  const listed = await listThemes(dir);
  const halide = listed.filter((theme) => theme.name === "halide");
  deepStrictEqual(halide.length, 1);
  deepStrictEqual(halide[0]?.file, join("spin", "halide", "tokens.json"));
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
  await mkdir(join(dir, "spin", "halide"));
  await writeFile(join(dir, "spin", "halide", "tokens.json"), '{"forked":true}', "utf8");

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
  await mkdir(join(dir, "spin", "acme"));
  await writeFile(join(dir, "spin", "acme", "tokens.json"), '{"own":true}', "utf8");

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
  deepStrictEqual(second.themes, ["acme"]);
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
    language: "minimal",
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
    language: "minimal",
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
    language: "minimal",
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
  deepStrictEqual(report.themes, ["acme"]);
});
test("a listed theme names where it is served from", async () => {
  const dir = await projectWithBrand();
  await mkdir(join(dir, "spin", "acme"));
  await writeFile(join(dir, "spin", "acme", "tokens.json"), '{"own":true}', "utf8");

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
    brand: "halide",
    componentsDir: "src/ui",
    strictness: "balanced",
    icons: { collection: "lucide" },
  });
  deepStrictEqual(written.error, null);

  const read = await readConfig(dir);
  deepStrictEqual(read.config, {
    brand: "halide",
    componentsDir: "src/ui",
    strictness: "balanced",
    icons: { collection: "lucide" },
  });
  deepStrictEqual(read.file, join("spin", "config.json"));

  const onDisk = await readFile(join(dir, "spin", "config.json"), "utf8");
  deepStrictEqual(
    onDisk,
    `${JSON.stringify({ brand: "halide", componentsDir: "src/ui", strictness: "balanced", icons: { collection: "lucide" } }, null, 2)}\n`,
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
  await writeFile(join(dir, "spin", "config.json"), '{"brand":', "utf8");

  const read = await readConfig(dir);
  deepStrictEqual(read.config, {});
  deepStrictEqual(read.file, join("spin", "config.json"));
});

test("a seating key the schema does not name is stripped, never kept", async () => {
  const dir = await root();
  await mkdir(join(dir, "spin"));
  await writeFile(
    join(dir, "spin", "config.json"),
    JSON.stringify({ brand: "halide", activeTheme: "halide", themeOrder: ["halide"] }),
    "utf8",
  );

  const read = await readConfig(dir);
  deepStrictEqual(read.config, { brand: "halide" });
  deepStrictEqual(read.file, join("spin", "config.json"));
});

test("a config write creates the spin directory the project did not have", async () => {
  const dir = await root();

  const written = await writeConfig(dir, { brand: "halide" });
  deepStrictEqual(written.error, null);

  const read = await readConfig(dir);
  deepStrictEqual(read.config, { brand: "halide" });
});

test("config.json is not served as a theme", async () => {
  const dir = await projectWith("halide", "{}");
  await writeConfig(dir, { brand: "halide" });

  const listed = await listThemes(dir);
  deepStrictEqual(listed.map((theme) => theme.name), ["halide"]);
  const report = await detectProject(dir);
  deepStrictEqual(report.themes, ["halide"]);
});

test("a brand directory composes its layers over its design language", async () => {
  const dir = await root();
  const brand = join(dir, "spin", "acme");
  await mkdir(join(brand, "themes"), { recursive: true });
  await writeFile(
    join(dir, "spin", "reference.json"),
    JSON.stringify({
      element: { h1: { type: { $type: "typography", $value: "{font.style.title}" } } },
    }),
  );
  await writeFile(
    join(brand, "tokens.json"),
    JSON.stringify({
      $extends: "minimal",
      modes: ["light", "dark"],
      button: { radius: { $type: "dimension", $value: "0px" } },
    }),
  );
  await writeFile(
    join(brand, "themes", "compact.spacing.json"),
    JSON.stringify({ spacing: { $type: "dimension", 4: { $value: "0.875rem" } } }),
  );

  const facets = await loadProjectBrand(dir);
  deepStrictEqual(Object.keys(facets.themes), ["acme"]);
  const parsed = parseTokens(facets.themes["acme"] as Record<string, unknown>);
  assert(parsed.ok, `brand must parse: ${!parsed.ok ? parsed.error : ""}`);
  if (!parsed.ok) return;
  const at = (path: string): unknown => {
    const leaves: { path: string[]; value: unknown }[] = [];
    const walk = (nodes: typeof parsed.tree): void => {
      for (const node of nodes) {
        if (node.kind === "token") leaves.push(node);
        else walk(node.children);
      }
    };
    walk(parsed.tree);
    return leaves.find((leaf) => leaf.path.join(".") === path)?.value;
  };
  // The layers land in order: the global reference, then the brand's own
  // tokens, over the language's voice.
  deepStrictEqual(at("element.h1.type.family"), "{font.style.title.family}");
  deepStrictEqual(at("button.radius"), "0px");
  deepStrictEqual(at("button.type.family"), "{font.style.label.family}");
  // The facet serves under its axis, validated on load.
  deepStrictEqual(Object.keys(facets.spacings), ["compact"]);
  const spacing = parseTokens(facets.spacings["compact"] as Record<string, unknown>);
  assert(spacing.ok, "facet must parse");

  const report = await detectProject(dir);
  deepStrictEqual(report.themes, ["acme"]);
});

test("a stray file the shape does not name is not served", async () => {
  const dir = await root();
  const brand = join(dir, "spin", "acme");
  await mkdir(brand, { recursive: true });
  await writeFile(
    join(brand, "tokens.json"),
    JSON.stringify({ $extends: "minimal", modes: ["light", "dark"] }),
  );
  await writeFile(join(dir, "spin", "legacy.json"), JSON.stringify({ color: {} }));
  await writeFile(join(brand, "elements.json"), JSON.stringify({ element: {} }));

  const facets = await loadProjectBrand(dir);
  deepStrictEqual(Object.keys(facets.themes), ["acme"]);
  const listed = await listThemes(dir);
  deepStrictEqual(listed.map((theme) => theme.name), ["acme"]);
});

test("a brand facet carrying the wrong tokens is refused with its file", async () => {
  const dir = await root();
  const brand = join(dir, "spin", "acme");
  await mkdir(join(brand, "themes"), { recursive: true });
  await writeFile(
    join(brand, "tokens.json"),
    JSON.stringify({ $extends: "minimal", modes: ["light", "dark"] }),
  );
  await writeFile(
    join(brand, "themes", "nope.spacing.json"),
    JSON.stringify({ color: { $type: "color", primary: { $value: "#ff0000" } } }),
  );
  await assert.rejects(
    () => loadProjectBrand(dir),
    /nope\.spacing\.json/,
    "a spacing facet carrying color names its file",
  );
});

