import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "bun:test";
import assert from "node:assert/strict";
import { spin } from "../../src/plugin/plugin.ts";
import { starterThemes } from "../../src/theme/themes/index.ts";

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

test("the plugin forwards classless to the preset", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".tmp-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "src", "index.html"),
      '<button class="button">Ship</button>\n',
      "utf8",
    );
    const stages = spin.vite({
      themes: { brand: starterThemes.spin },
      classless: false,
      content: { filesystem: [`${root}/src/**/*.html`] },
    }) as unknown as ViteOptions[];
    const plugin = await stylesheetStage(stages);
    plugin.configResolved?.({ root, command: "serve" });
    const id = await plugin.resolveId!("uno.css");
    assert(id);
    const css = await plugin.load!(id);
    assert(
      typeof css === "string" && css.includes(".button"),
      "classless: false emits the primitive's class selector",
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
    await writeFile(
      join(root, "spin", "disk.json"),
      JSON.stringify(starterThemes.silk),
      "utf8",
    );
    const stages = spin.vite({
      themes: { brand: starterThemes.spin },
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
    const fork = JSON.parse(JSON.stringify(starterThemes.spin)) as Record<
      string,
      unknown
    >;
    ((fork["color"] as Record<string, unknown>)["primary"] as Record<string, unknown>)["$value"] = "#123456";
    await writeFile(join(root, "spin", "brand.json"), JSON.stringify(fork), "utf8");
    await writeFile(
      join(root, "spin", "local.json"),
      JSON.stringify(starterThemes.silk),
      "utf8",
    );
    const stages = spin.vite({
      extends: { themes: { brand: starterThemes.spin } },
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
