import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { detectProject, initProject } from "@spinjs/server/project";

const roots: string[] = [];

afterEach(async () => {
  for (const dir of roots.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function root(): Promise<string> {
  const dir = await mkdtemp(join(import.meta.dir, ".tmp-"));
  roots.push(dir);
  return dir;
}

async function load(path: string): Promise<Record<string, unknown>> {
  return await import(`${pathToFileURL(path).href}?t=${Date.now()}-${Math.random()}`);
}

function flatten(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(flatten);
  return [value];
}

test("the generated vite config imports a plugin the package exports", async () => {
  const dir = await root();
  const made = await initProject({ root: dir, name: "acme", language: "minimal" });
  const module = await load(join(dir, "vite.config.ts"));
  const config = module.default as { plugins?: unknown };
  const plugins = flatten(config.plugins);
  assert(
    plugins.some((plugin) =>
      typeof plugin === "object" && plugin !== null &&
      (plugin as { name?: string }).name === "spin"
    ),
    "the config's plugin list contains the stylesheet plugin",
  );
});

test("a codemodded existing vite.config.ts imports and invokes spin.vite()", async () => {
  const dir = await root();
  await writeFile(
    join(dir, "vite.config.ts"),
    "export default {\n  plugins: [],\n};\n",
    "utf8",
  );
  const made = await initProject({ root: dir, name: "acme", language: "minimal" });
  deepStrictEqual(made.error, null);
  const module = await load(join(dir, "vite.config.ts"));
  const config = module.default as { plugins?: unknown };
  const plugins = flatten(config.plugins);
  assert(
    plugins.some(
      (plugin) =>
        typeof plugin === "object" &&
        plugin !== null &&
        "name" in plugin &&
        plugin.name === "spin",
    ),
    "the codemodded config's plugin list contains the stylesheet plugin",
  );
});

test("the generated esbuild config imports a plugin with a setup hook", async () => {
  const dir = await root();
  const made = await initProject({
    root: dir,
    name: "acme",
    language: "minimal",
    bundler: "esbuild",
  });
  deepStrictEqual(made.error, null);
  const module = await load(join(dir, "spin.config.ts"));
  const plugins = flatten(module.plugins);
  assert(
    plugins.some((plugin) =>
      typeof plugin === "object" && plugin !== null &&
      typeof (plugin as { setup?: unknown }).setup === "function"
    ),
    "the config exports an esbuild plugin",
  );
});

test("the generated webpack config is an ESM module with an apply hook", async () => {
  const dir = await root();
  const made = await initProject({
    root: dir,
    name: "acme",
    language: "minimal",
    bundler: "webpack",
  });
  deepStrictEqual(made.error, null);
  const module = await load(join(dir, "webpack.config.mjs"));
  const config = module.default as { plugins?: unknown };
  const plugins = flatten(config.plugins);
  assert(
    plugins.some((plugin) =>
      typeof plugin === "object" && plugin !== null &&
      typeof (plugin as { apply?: unknown }).apply === "function"
    ),
    "the config's plugin list contains a webpack plugin",
  );
  deepStrictEqual((await detectProject(dir)).uno, true);
});

test("the generated rollup config is an ESM module with both spin stages", async () => {
  const dir = await root();
  const made = await initProject({
    root: dir,
    name: "acme",
    language: "minimal",
    bundler: "rollup",
  });
  deepStrictEqual(made.error, null);
  const module = await load(join(dir, "rollup.config.mjs"));
  const config = module.default as { plugins?: unknown };
  const names = flatten(config.plugins)
    .filter((plugin): plugin is { name: string } =>
      typeof plugin === "object" && plugin !== null &&
      typeof (plugin as { name?: unknown }).name === "string"
    )
    .map((plugin) => plugin.name);
  deepStrictEqual(names.filter((name) => name.includes("spin")).length, 2);
});

test("the generated rspack config carries a plugin with an apply hook", async () => {
  const dir = await root();
  const made = await initProject({
    root: dir,
    name: "acme",
    language: "minimal",
    bundler: "rspack",
  });
  deepStrictEqual(made.error, null);
  const text = await readFile(join(dir, "rspack.config.ts"), "utf8");
  assert(
    text.includes("spin.rspack"),
    "the scaffold wires the rspack shape",
  );
  await writeFile(
    join(dir, "rspack.wired.ts"),
    'import { spin } from "@spinjs/dev/vite";\nexport default { plugins: [spin.rspack()] };\n',
    "utf8",
  );
  const module = await load(join(dir, "rspack.wired.ts"));
  const config = module.default as { plugins?: unknown };
  const plugins = flatten(config.plugins);
  assert(
    plugins.some((plugin) =>
      typeof plugin === "object" && plugin !== null &&
      typeof (plugin as { apply?: unknown }).apply === "function"
    ),
    "the wired config's plugin list contains an rspack plugin",
  );
});

test("the generated rolldown config is an ESM module with both spin stages", async () => {
  const dir = await root();
  const made = await initProject({
    root: dir,
    name: "acme",
    language: "minimal",
    bundler: "rolldown",
  });
  deepStrictEqual(made.error, null);
  const text = await readFile(join(dir, "rolldown.config.ts"), "utf8");
  assert(
    text.includes("spin.rolldown"),
    "the scaffold wires the rolldown shape",
  );
  await writeFile(
    join(dir, "rolldown.wired.ts"),
    'import { spin } from "@spinjs/dev/vite";\nexport default { plugins: [spin.rolldown()] };\n',
    "utf8",
  );
  const module = await load(join(dir, "rolldown.wired.ts"));
  const config = module.default as { plugins?: unknown };
  const stages = flatten(config.plugins).flatMap((plugin) =>
    typeof plugin === "object" && plugin !== null && !Array.isArray(plugin) &&
      "0" in plugin && "1" in plugin
      ? [plugin["0"], plugin["1"]]
      : [plugin]
  );
  const names = stages
    .filter((plugin): plugin is { name: string } =>
      typeof plugin === "object" && plugin !== null &&
      typeof (plugin as { name?: unknown }).name === "string"
    )
    .map((plugin) => plugin.name);
  deepStrictEqual(names.filter((name) => name.includes("spin")).length, 2);
});

test("the generated bun config imports a plugin with a setup hook", async () => {
  const dir = await root();
  const made = await initProject({
    root: dir,
    name: "acme",
    language: "minimal",
    bundler: "bun",
  });
  deepStrictEqual(made.error, null);
  const module = await load(join(dir, "spin.config.ts"));
  const plugins = flatten(module.plugins);
  assert(
    plugins.some((plugin) =>
      typeof plugin === "object" && plugin !== null &&
      typeof (plugin as { setup?: unknown }).setup === "function"
    ),
    "the config exports a bun plugin",
  );
});

test("init refuses to pass a preset-only config off as a spin project", async () => {
  const dir = await root();
  const made = await initProject({
    root: dir,
    name: "acme",
    language: "minimal",
    bundler: "unocss",
  });
  deepStrictEqual(
    made.error,
    "spin init wires the Spin plugin; it does not write a preset-only UnoCSS config. Add spinPreset to uno.config.ts yourself, or scaffold in a project without uno.config.",
  );
  await assert.rejects(readFile(join(dir, "spin", "acme.json"), "utf8"));
  await assert.rejects(readFile(join(dir, "uno.config.ts"), "utf8"));
});

test("init refuses a CommonJS webpack config before writing anything", async () => {
  const dir = await root();
  await writeFile(join(dir, "webpack.config.js"), "module.exports = {};\n", "utf8");
  const made = await initProject({
    root: dir,
    name: "acme",
    language: "minimal",
    bundler: "webpack",
  });
  deepStrictEqual(
    made.error,
    "spin init cannot wire a CommonJS webpack/rollup config; use an ESM config or add the plugin manually.",
  );
  await assert.rejects(readFile(join(dir, "spin", "acme.json"), "utf8"));
  await assert.rejects(readFile(join(dir, "webpack.config.mjs"), "utf8"));
});
