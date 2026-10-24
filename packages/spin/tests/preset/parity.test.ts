import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { spin } from "../../src/preset/plugin.ts";
import { starterThemes } from "../../src/theme/themes/index.ts";
import presetIcons from "@unocss/preset-icons";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };

const repo = new URL("../../../", import.meta.url).pathname;
const referenceRoot = `${repo}apps/reference/`;

/**
 * The hooks the test drives, shaped as the plugin hands them over.
 *
 * Unplugin's own types union each hook with an "object hook" form that a
 * framework's filter sets; this drives the plain callable form, which is
 * what every bundler calls.
 */
type ViteOptions = {
  configResolved?: (config: { root: string; command: string }) => void;
  resolveId?: (id: string) => string | null;
  load?: (id: string) => string | null | Promise<string | null>;
};

/** The reference app's config, expressed against `spin()` instead of Uno. */
const PLUGIN_INCLUDE = [
  /\.(vue|svelte|[jt]sx?|vine.ts|mdx?|astro|elm|php|phtml|marko|html)($|\?)/,
];

function referencePlugin(): ViteOptions {
  // `spin.vite()` composes the elements-pre and stylesheet-post stages, so
  // the test drives the stage that owns the sheet: the first whose
  // `resolveId` claims the stylesheet id.
  const stages = spin.vite({
    themes: starterThemes,
    presets: [presetIcons({ collections: { lucide } } as never)],
    content: {
      filesystem: [
        `${repo}packages/spin/src/preset/rules/primitives/*.examples.ts`,
        "src/**/*.{tsx,ts}",
      ],
      pipeline: { include: PLUGIN_INCLUDE },
    },
  }) as unknown as ViteOptions[];
  const options = stages.find((stage) => stage.resolveId?.("uno.css") !== null) ?? stages[0]!;
  options.configResolved?.({ root: referenceRoot, command: "serve" });
  return options;
}

test("the id the app imports resolves to the plugin's own module", () => {
  const plugin = referencePlugin();
  deepStrictEqual(plugin.resolveId!("uno.css"), "/__uno.css");
});

test("an id the app does not import is left to someone else", () => {
  const plugin = referencePlugin();
  deepStrictEqual(plugin.resolveId!("/src/app.tsx"), null);
});

test("a project without themes in config reads spin/*.json from disk", async () => {
  // The out-of-the-box path: a theme dropped in `spin/` is live with no
  // config, which is the shape a real app has.
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  await mkdir(`${root}/spin`);
  const doc = structuredClone(starterThemes.silk) as Record<
    string,
    Record<string, Record<string, string>>
  >;
  doc.color.primary.$value = "#b91c1c";
  await writeFile(
    `${root}/spin/brand.json`,
    JSON.stringify(doc),
  );
  const stages = spin.vite({ content: { filesystem: [] } }) as unknown as {
    configResolved?: (config: { root: string; command: string }) => void;
    resolveId?: (id: string) => string | null;
    load?: (id: string) => Promise<string | null>;
  }[];
  const plugin = stages.find((stage) => stage.resolveId?.("uno.css") !== null) ?? stages[0]!;
  plugin.configResolved?.({ root, command: "serve" });
  const css = (await plugin.load!(plugin.resolveId!("uno.css")!)) as string;
  assert(
    css.includes("--color-primary: #b91c1c"),
    "the disk theme's primary lands in the sheet",
  );
  await rm(root, { recursive: true });
});

test("the boot theme's variables are declared at the root", async () => {
  // A custom property cannot inherit upward. Scoped only to `[data-theme]`,
  // the variables are invisible to `body {}` — so the typography primitives'
  // own base rule falls back to the browser's default font, which is how a
  // studio chrome ends up rendering in Times. The first theme is the one the
  // app boots with, so it is also written at root.
  const plugin = referencePlugin();
  const css = (await plugin.load!(plugin.resolveId!("uno.css")!)) as string;
  // The root theme's block is a default now (`:where(:root)`), so a theme in
  // force beats it — but it still carries the boot theme's variables for the
  // page as a whole.
  const root = css.match(/:where\(:root\) \{([^}]*)\}/)?.[1] ?? "";
  assert(
    root.includes("--color-primary:"),
    "the root block carries the boot theme's variables",
  );
  assert(
    root.includes("--font-family-sans:"),
    "which is what lets `body {}` resolve a font-family at all",
  );
});
