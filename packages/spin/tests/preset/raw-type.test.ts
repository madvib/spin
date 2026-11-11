import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "bun:test";
import assert, { deepStrictEqual, match, ok } from "node:assert/strict";
import { spin } from "../../src/plugin/plugin.ts";
import { starterThemes } from "@spinjs/theme/themes";

type ViteOptions = {
  configResolved?: (config: { root: string; command: string }) => void;
  resolveId?: (id: string) => string | null | Promise<string | null>;
  load?: (id: string) => string | null | Promise<string | null>;
};

/**
 * TYPE-b: removed raw type utilities fail the strict build with a style
 * suggestion, behind the warn-then-error migration window.
 *
 * `text-sm` is no longer something the generator can produce, so the dead
 * class names the style to wear instead. Before the gate version the build
 * warns and still serves the sheet; after it, the build throws.
 */

async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(import.meta.dir, ".tmp-raw-type-"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "probe" }));
  for (const [name, text] of Object.entries(files)) {
    const path = join(root, name);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, text, "utf8");
  }
  return root;
}

async function stylesheetStage(
  stages: readonly ViteOptions[],
): Promise<ViteOptions> {
  for (const stage of stages) {
    if ((await stage.resolveId?.("uno.css")) != null) return stage;
  }
  return stages[0]!;
}

async function buildMessage(
  root: string,
  options: Parameters<typeof spin.vite>[0],
): Promise<{ message: string; css: string }> {
  const stages = spin.vite(options) as unknown as ViteOptions[];
  const plugin = await stylesheetStage(stages);
  plugin.configResolved?.({ root, command: "build" });
  const id = await plugin.resolveId!("uno.css");
  assert(id);
  try {
    const css = (await plugin.load!(id)) as string;
    return { message: "", css };
  } catch (error) {
    return { message: error instanceof Error ? error.message : String(error), css: "" };
  }
}

const RAW_TYPE = {
  "spin/local.json": JSON.stringify(starterThemes.minimal),
  "src/index.html": '<p class="text-sm">hi</p>\n',
};

test("a removed size utility fails the strict build with a style suggestion", async () => {
  // text-sm names no rule anymore, so the production build refuses it — and
  // the error says which style to wear instead of just saying no.
  const root = await fixture(RAW_TYPE);
  try {
    const { message } = await buildMessage(root, {
      rawType: "error",
      content: { filesystem: [`${root}/src/**/*.html`] },
    });
    match(message, /text-sm/, "the error names the dead class");
    match(message, /src\/index\.html/, "the error names the file");
    // The build scanner reads raw text, not elements, so the suggestion is
    // the value match without the element-default refinement the lint adds
    // beside it: any declared style, not just any neighbour by spelling.
    match(message, /type-[a-z-]+/, "the error suggests a declared style");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the warn side serves the sheet and warns with the suggestion", async () => {
  // The migration window: before the gate version, a removed utility is a
  // warning, not a broken build — but the warning still names the style.
  const root = await fixture(RAW_TYPE);
  try {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message: string) => warnings.push(message);
    try {
      const { message, css } = await buildMessage(root, {
        rawType: "warn",
        content: { filesystem: [`${root}/src/**/*.html`] },
      });
      deepStrictEqual(message, "", "a warned build does not throw");
      ok(css.length > 0, "the sheet is still served");
    } finally {
      console.warn = original;
    }
    match(
      warnings.join("\n"),
      /text-sm/,
      "the warning names the dead class",
    );
    match(
      warnings.join("\n"),
      /type-[a-z-]+/,
      "the warning suggests a declared style",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the default is the warn side before the gate version", async () => {
  // No option passed: the shipping version predates the gate, so the build
  // warns rather than throws.
  const root = await fixture(RAW_TYPE);
  try {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message: string) => warnings.push(message);
    try {
      const { message } = await buildMessage(root, {
        content: { filesystem: [`${root}/src/**/*.html`] },
      });
      deepStrictEqual(message, "", "the default build does not throw");
    } finally {
      console.warn = original;
    }
    ok(warnings.length > 0, "the default build warns");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an unrelated dead class still throws on the warn side", async () => {
  // The window covers removed type utilities only: a genuine typo is still
  // a build error while the migration runs.
  const root = await fixture({
    "spin/local.json": JSON.stringify(starterThemes.minimal),
    "src/index.html": '<div class="bg-primry">hi</div>\n',
  });
  try {
    const { message } = await buildMessage(root, {
      rawType: "warn",
      content: { filesystem: [`${root}/src/**/*.html`] },
    });
    match(message, /bg-primry/, "a typo still fails the warn-side build");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
