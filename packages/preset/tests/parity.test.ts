import { assert, assertEquals } from "@std/assert";
import { spin } from "../src/plugin.ts";
import { starterThemes } from "@spin/theme/themes";
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
  const options = spin.vite({
    themes: starterThemes,
    presets: [presetIcons({ collections: { lucide } } as never)],
    content: {
      filesystem: [
        `${repo}packages/preset/src/rules/primitives/*.examples.ts`,
        "src/**/*.{tsx,ts}",
      ],
      pipeline: { include: PLUGIN_INCLUDE },
    },
  }) as unknown as ViteOptions;
  options.configResolved?.({ root: referenceRoot, command: "serve" });
  return options;
}

/**
 * The sheet this plugin emits is the sheet `@unocss/vite` emitted.
 *
 * The fixture is the reference app's CSS at the cutover, captured from
 * `@unocss/vite` and then widened by twelve rules. The original capture
 * safelisted only `default`'s catalog while the app renders all three
 * starter themes, so a switch to `neobrut` or `console` left utilities
 * without a rule. `spin()` safelists every theme it was given; the extra
 * rules are the utilities those themes name and nothing else.
 *
 * It is a parity fixture, not a pin: a change here means the plugin
 * generates something Uno did not, which is worth reading before it ships.
 */
Deno.test("the plugin reproduces the reference app's sheet", async () => {
  const plugin = referencePlugin();
  const id = plugin.resolveId!("uno.css");
  const css = await plugin.load!(id!);
  assertEquals(
    css,
    await Deno.readTextFile(
      new URL("./fixtures/reference-golden.css", import.meta.url),
    ),
  );
});

Deno.test("the id the app imports resolves to the plugin's own module", () => {
  const plugin = referencePlugin();
  assertEquals(plugin.resolveId!("uno.css"), "/__uno.css");
});

Deno.test("an id the app does not import is left to someone else", () => {
  const plugin = referencePlugin();
  assertEquals(plugin.resolveId!("/src/app.tsx"), null);
});

Deno.test("a project without themes in config reads spin/*.json from disk", async () => {
  // The out-of-the-box path: a theme dropped in `spin/` is live with no
  // config, which is the shape a real app has.
  const root = await Deno.makeTempDir();
  await Deno.mkdir(`${root}/spin`);
  const doc = structuredClone(starterThemes.default) as Record<
    string,
    Record<string, Record<string, string>>
  >;
  doc.color.primary.$value = "#b91c1c";
  await Deno.writeTextFile(
    `${root}/spin/brand.json`,
    JSON.stringify(doc),
  );
  const plugin = spin.vite({ content: { filesystem: [] } }) as unknown as {
    configResolved?: (config: { root: string; command: string }) => void;
    resolveId?: (id: string) => string | null;
    load?: (id: string) => Promise<string | null>;
  };
  plugin.configResolved?.({ root, command: "serve" });
  const css = (await plugin.load!(plugin.resolveId!("uno.css")!)) as string;
  assert(
    css.includes("--color-primary: #b91c1c"),
    "the disk theme's primary lands in the sheet",
  );
  await Deno.remove(root, { recursive: true });
});
