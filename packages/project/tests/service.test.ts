/**
 * The project's operations, over a real directory.
 *
 * Every test writes to a temp root and reads it back: the contract is what a
 * consumer observes — a file that is there, a document that reads as it was
 * written, a refusal that names its reason — so the tests are about the
 * disk, not about the code that reaches it.
 */

import { assert, assertEquals } from "@std/assert";
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
  readTheme,
  removeTheme,
  writeTheme,
} from "../src/index.ts";

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

Deno.test("a root with themes and a wired config is a spin project", async () => {
  const dir = await root();
  await mkdir(join(dir, "spin"));
  await writeFile(join(dir, "spin", "acme.json"), "{}", "utf8");
  await writeFile(
    join(dir, "uno.config.ts"),
    'import { spin } from "@spin/config";',
    "utf8",
  );

  const report = await detectProject(dir);
  assertEquals(report.root, dir);
  assertEquals(report.spin, true);
  assertEquals(report.uno, true);
  assertEquals(report.wired, true);
  assertEquals(report.themes, ["acme.json"]);
});

Deno.test("a directory that holds no project reports itself as none", async () => {
  const report = await detectProject(await root());
  assertEquals(report.spin, false);
  assertEquals(report.uno, false);
  assertEquals(report.wired, false);
  assertEquals(report.themes, []);
});

Deno.test("a config that does not name spin is not wired", async () => {
  const dir = await root();
  await mkdir(join(dir, "spin"));
  await writeFile(
    join(dir, "uno.config.ts"),
    'import { defineConfig } from "unocss";',
    "utf8",
  );

  const report = await detectProject(dir);
  assertEquals(report.uno, true);
  assertEquals(report.wired, false);
});

Deno.test("init makes a project: themes, a theme, and a wired config", async () => {
  const dir = await root();

  const made = await initProject({
    root: dir,
    name: "acme",
    starter: "silk",
  });
  assertEquals(made.error, null);

  const report = await detectProject(dir);
  assertEquals(report.spin, true);
  assertEquals(report.uno, true);
  assertEquals(report.wired, true);
  assertEquals(report.themes, ["acme.json"]);

  // The config it wrote is one that applies spin — that is what "wired"
  // means, and the init test is where it is proven.
  const config = await readFile(join(dir, "uno.config.ts"), "utf8");
  assertEquals(isWired(config), true);
});

Deno.test("init refuses a root it cannot make a project in", async () => {
  const dir = await root();
  await writeFile(join(dir, "occupied"), "not a directory", "utf8");

  const made = await initProject({
    root: join(dir, "occupied", "under"),
    name: "acme",
    starter: "silk",
  });
  assert(made.error !== null, "a refused init says why");
});

Deno.test("a project holds its own themes beside the starters it has not forked", async () => {
  const dir = await projectWith("acme", '{"own":true}');

  const listed = await listThemes(dir);
  const own = listed.filter((theme) => theme.file !== null);
  assertEquals(own.map((theme) => theme.name), ["acme"]);
  assertEquals(own[0]?.file, join("spin", "acme.json"));
  assertEquals(own[0]?.text, '{"own":true}');

  const starters = listed.filter((theme) => theme.file === null);
  assert(
    starters.some((theme) => theme.name === "silk"),
    `the shipped starters are listed: ${starters.map((t) => t.name).join(",")}`,
  );
});

Deno.test("a forked starter replaces the starter it forked", async () => {
  const dir = await projectWith("silk", '{"forked":true}');

  const listed = await listThemes(dir);
  const silk = listed.filter((theme) => theme.name === "silk");
  assertEquals(silk.length, 1);
  assertEquals(silk[0]?.file, join("spin", "silk.json"));
  assertEquals(silk[0]?.text, '{"forked":true}');
});

Deno.test("a theme reads back exactly as it was written", async () => {
  const dir = await root();
  const text = '{\n  "color": { "primary": { "$value": "#1e40af" } }\n}\n';

  const written = await writeTheme(dir, "acme", text);
  assertEquals(written.error, null);

  const read = await readTheme(dir, "acme");
  assertEquals(read.text, text);
});

Deno.test("a write creates the themes directory the project did not have", async () => {
  const dir = await root();

  const written = await writeTheme(dir, "acme", "{}");
  assertEquals(written.error, null);

  const listed = await listThemes(dir);
  assertEquals(
    listed.filter((theme) => theme.file !== null).map((theme) => theme.name),
    ["acme"],
  );
});

Deno.test("a theme the project has not forked reads as the starter", async () => {
  const dir = await root();

  const read = await readTheme(dir, "silk");
  const document = JSON.parse(read.text ?? "{}") as Record<string, unknown>;
  assert(document["color"] !== undefined, "the starter reads as a document");
});

Deno.test("a theme that is neither a file nor a starter reads as nothing", async () => {
  const read = await readTheme(await root(), "absent");
  assertEquals(read.text, null);
});

Deno.test("a copy of a project's file is byte for byte", async () => {
  const dir = await projectWith("acme", '{"own":true}');

  const copied = await copyTheme(dir, "acme", "fork");
  assertEquals(copied.error, null);

  const read = await readTheme(dir, "fork");
  assertEquals(read.text, '{"own":true}');
});

Deno.test("a copy of a starter writes the starter's document", async () => {
  const dir = await root();

  const copied = await copyTheme(dir, "silk", "fork");
  assertEquals(copied.error, null);

  const forked = await readTheme(dir, "fork");
  const starter = await readTheme(dir, "silk");
  assertEquals(forked.text, starter.text);
});

Deno.test("a copy refuses a name that is taken", async () => {
  const dir = await projectWith("acme", '{"own":true}');

  const copied = await copyTheme(dir, "acme", "acme");
  assertEquals(copied.error, "a theme named acme already exists");
});

Deno.test("a copy refuses a source that is neither a file nor a starter", async () => {
  const copied = await copyTheme(await root(), "absent", "fork");
  assertEquals(copied.error, "no theme named absent");
});

Deno.test("a remove takes the theme away", async () => {
  const dir = await projectWith("acme", '{"own":true}');

  const removed = await removeTheme(dir, "acme");
  assertEquals(removed.error, null);

  const read = await readTheme(dir, "acme");
  assertEquals(read.text, null);
});

Deno.test("a remove of a theme that is not there is refused", async () => {
  const removed = await removeTheme(await root(), "absent");
  assert(removed.error !== null, "a refused remove says why");
});

Deno.test("an operation about one root leaves another root alone", async () => {
  const mine = await projectWith("acme", '{"mine":true}');
  const yours = await projectWith("acme", '{"yours":true}');

  await writeTheme(mine, "fresh", "{}");

  const theirs = await readTheme(yours, "acme");
  assertEquals(theirs.text, '{"yours":true}');
  const theirListed = await listThemes(yours);
  assertEquals(
    theirListed.filter((theme) => theme.file !== null).map((t) => t.name),
    ["acme"],
  );
});

Deno.test("the project in hand reads the same as the project named", async () => {
  const dir = await projectWith("acme", '{"own":true}');

  const named = await detectProject(dir);
  const current = await currentProject(dir);
  assertEquals(current, named);
});

Deno.test("the root a report names is the root it examined", async () => {
  const dir = await root();
  const report = await detectProject(dir);
  assertEquals(report.root, dir);
});

Deno.test("a project keeps no state between calls", async () => {
  const dir = await root();
  await writeTheme(dir, "acme", "{}");

  // The same root, read twice: the second read sees the first read's world.
  const first = await detectProject(dir);
  const second = await detectProject(dir);
  assertEquals(second.themes, first.themes);
  assertEquals(second.themes, ["acme.json"]);
});

Deno.test("a root that is not there holds no themes of its own", async () => {
  const dir = join(await root(), "never-made");

  const listed = await listThemes(dir);
  assertEquals(
    listed.filter((theme) => theme.file !== null),
    [],
  );
  const report = await detectProject(dir);
  assertEquals(report.spin, false);
});
