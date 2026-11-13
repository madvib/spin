import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "bun:test";
import assert from "node:assert/strict";
import { spin } from "../../src/plugin/plugin.ts";
import { designLanguages } from "@spinjs/theme";

type ViteOptions = {
  configResolved?: (config: { root: string; command: string }) => void;
  resolveId?: (id: string) => string | null | Promise<string | null>;
  load?: (id: string) => string | null | Promise<string | null>;
};

async function stylesheetStage(
  stages: readonly ViteOptions[],
): Promise<ViteOptions> {
  for (const stage of stages) {
    if ((await stage.resolveId?.("uno.css")) != null) return stage;
  }
  return stages[0]!;
}

test("classless: false is a loud error, not a silent option", async () => {
  // The toggle is removed, not deprecated: passing it must fail loudly
  // rather than silently switching the build to class selectors.
  const root = await mkdtemp(join(import.meta.dir, ".tmp-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "src", "index.html"),
      "<button>Ship</button>\n",
      "utf8",
    );
    const stages = spin.vite({
      themes: { brand: designLanguages.editorial },
      classless: false,
      content: { filesystem: [`${root}/src/**/*.html`] },
    } as never) as unknown as ViteOptions[];
    const plugin = await stylesheetStage(stages);
    plugin.configResolved?.({ root, command: "serve" });
    const id = await plugin.resolveId!("uno.css");
    assert(id);
    await assert.rejects(
      async () => {
        await plugin.load!(id);
      },
      /classless.*removed/,
      "passing the removed toggle must fail with the removal message",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("verbatim themes replace the whole stack, disk included", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".tmp-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "spin"));
    await writeFile(
      join(root, "src", "index.html"),
      '<div class="flex">hi</div>\n',
      "utf8",
    );
    await mkdir(join(root, "spin", "disk"));
    await writeFile(
      join(root, "spin", "disk", "tokens.json"),
      JSON.stringify(designLanguages.minimal),
      "utf8",
    );
    const stages = spin.vite({
      themes: { brand: designLanguages.editorial },
      content: { filesystem: [`${root}/src/**/*.html`] },
    }) as unknown as ViteOptions[];
    const plugin = await stylesheetStage(stages);
    plugin.configResolved?.({ root, command: "serve" });
    const id = await plugin.resolveId!("uno.css");
    assert(id);
    const css = await plugin.load!(id);
    assert(
      typeof css === "string" && css.includes('data-theme="brand"'),
      "the verbatim theme is served",
    );
    assert(
      typeof css === "string" && !css.includes('data-theme="disk"'),
      "the disk theme is not served beside it",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("extends layers the brand under the local disk, fork by name", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".tmp-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "spin"));
    await writeFile(
      join(root, "src", "index.html"),
      '<div class="flex">hi</div>\n',
      "utf8",
    );
    const fork = JSON.parse(JSON.stringify(designLanguages.editorial)) as Record<
      string,
      unknown
    >;
    ((fork["color"] as Record<string, unknown>)["primary"] as Record<string, unknown>)["$value"] = "#123456";
    await mkdir(join(root, "spin", "brand"));
    await writeFile(join(root, "spin", "brand", "tokens.json"), JSON.stringify(fork), "utf8");
    await mkdir(join(root, "spin", "local"), { recursive: true });
    await writeFile(
      join(root, "spin", "local", "tokens.json"),
      JSON.stringify(designLanguages.minimal),
      "utf8",
    );
    const stages = spin.vite({
      extends: { themes: { brand: designLanguages.editorial } },
      content: { filesystem: [`${root}/src/**/*.html`] },
    }) as unknown as ViteOptions[];
    const plugin = await stylesheetStage(stages);
    plugin.configResolved?.({ root, command: "serve" });
    const id = await plugin.resolveId!("uno.css");
    assert(id);
    const css = await plugin.load!(id);
    assert(typeof css === "string", "the sheet generates");
    assert(
      css.includes('data-theme="brand"') && css.includes('data-theme="local"'),
      "the brand and the local-only theme are both served",
    );
    assert(
      css.includes("#123456"),
      "the local fork wins over the brand document",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("shortcuts.json beside the brands compiles and satisfies the strict gate", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".tmp-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "spin", "local"), { recursive: true });
    await writeFile(
      join(root, "src", "index.html"),
      '<div class="stack">hi</div>\n',
      "utf8",
    );
    await writeFile(
      join(root, "spin", "local", "tokens.json"),
      JSON.stringify(designLanguages.minimal),
      "utf8",
    );
    await writeFile(
      join(root, "spin", "shortcuts.json"),
      JSON.stringify({ stack: "flex flex-col gap-4" }),
      "utf8",
    );
    const stages = spin.vite({
      content: { filesystem: [`${root}/src/**/*.html`] },
    }) as unknown as ViteOptions[];
    const plugin = await stylesheetStage(stages);
    plugin.configResolved?.({ root, command: "build" });
    const id = await plugin.resolveId!("uno.css");
    assert(id);
    const css = await plugin.load!(id);
    assert(typeof css === "string", "the sheet generates");
    assert(
      css.includes(".stack"),
      "the file's shortcut compiles to a rule",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a malformed shortcuts.json fails the build naming the file", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".tmp-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "spin", "local"), { recursive: true });
    await writeFile(
      join(root, "src", "index.html"),
      '<div class="flex">hi</div>\n',
      "utf8",
    );
    await writeFile(
      join(root, "spin", "local", "tokens.json"),
      JSON.stringify(designLanguages.minimal),
      "utf8",
    );
    await writeFile(join(root, "spin", "shortcuts.json"), "{ not json", "utf8");
    const stages = spin.vite({
      content: { filesystem: [`${root}/src/**/*.html`] },
    }) as unknown as ViteOptions[];
    const plugin = await stylesheetStage(stages);
    plugin.configResolved?.({ root, command: "build" });
    const id = await plugin.resolveId!("uno.css");
    assert(id);
    await assert.rejects(
      async () => {
        await plugin.load!(id);
      },
      /shortcuts\.json is invalid/,
      "the build refuses half a table",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a code file inside the themes directory is warned about, not compiled", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".tmp-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "spin", "local"), { recursive: true });
    await writeFile(
      join(root, "src", "index.html"),
      '<div class="flex">hi</div>\n',
      "utf8",
    );
    await writeFile(
      join(root, "spin", "local", "tokens.json"),
      JSON.stringify(designLanguages.minimal),
      "utf8",
    );
    await writeFile(join(root, "spin", "theme.ts"), "export const x = 1;\n", "utf8");
    const stages = spin.vite({
      content: { filesystem: [`${root}/src/**/*.html`] },
    }) as unknown as ViteOptions[];
    const plugin = await stylesheetStage(stages);
    plugin.configResolved?.({ root, command: "build" });
    const id = await plugin.resolveId!("uno.css");
    assert(id);
    const warnings: string[] = [];
    const warn = console.warn;
    console.warn = (line: string) => void warnings.push(String(line));
    try {
      const css = await plugin.load!(id);
      assert(typeof css === "string", "the sheet still generates");
    } finally {
      console.warn = warn;
    }
    assert(
      warnings.some((line) => line.includes("theme.ts") && line.includes("code inside the themes directory")),
      `the foreign file was not named: ${warnings.join("\n")}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
