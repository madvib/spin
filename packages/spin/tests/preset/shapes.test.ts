import assert from "node:assert";
import { describe, it } from "node:test";
import type { ThemeDocument } from "../../src/theme/index.ts";
import { silkTheme } from "../../src/theme/themes/index.ts";
import { spin, type SpinPluginOptions } from "../../src/plugin/plugin.ts";

/**
 * Every bundler shape carries the same options.
 *
 * The plugin is one `createUnplugin` factory, and unplugin derives each
 * bundler's entry from it — but nothing asserted the family agrees until
 * now. Each shape here is constructed with the same options and must
 * carry both stages: a shape that failed the construction its siblings
 * accept would serve a different product. The seed of the compat
 * matrix: later slices extend the loop with dev/build and dir-combo
 * cells. A second loop drives `uno.css` through every shape whose hooks
 * are visible and asserts the brand's token lands in the sheet — the
 * options are not just carried, they generate. (`spinPreset` is
 * deliberately absent: it is the stylesheet alone, takes explicit
 * `themes`, and has no `extends` to plumb.)
 */
const brandDoc = JSON.parse(JSON.stringify(silkTheme)) as Record<
  string,
  Record<string, unknown>
>;
(brandDoc.color as Record<string, unknown>)["halide-probe"] = {
  $value: "#0dd1ec",
};

const brand = {
  halide: brandDoc,
} as unknown as Record<string, ThemeDocument>;

const OPTIONS: SpinPluginOptions = {
  extends: { themes: brand, componentsDir: "lib/brand" },
  componentsDir: "lib/components",
  prefix: "acme",
  themesDir: "spin-nonexistent",
  safelist: false,
  // These builds assert sheet content, not class discipline: they run
  // with a fixture theme over the whole monorepo, so the class gate
  // would judge every surface by one fixture's vocabulary.
  strictClasses: false,
};

interface Stage {
  readonly name?: string;
  readonly enforce?: string;
}

/** The unplugin stages a shape returns, as a flat list. */
function stagesOf(shape: unknown): Stage[] {
  if (Array.isArray(shape)) return shape as Stage[];
  if (shape !== null && typeof shape === "object" && "plugins" in shape) {
    return (shape as { plugins: Stage[] }).plugins;
  }
  return [shape as Stage];
}

const META: { readonly framework: "rollup" } = { framework: "rollup" };

const CONSTRUCTION: Readonly<Record<string, () => unknown>> = {
  vite: () => spin.vite(OPTIONS),
  rspack: () => spin.rspack(OPTIONS),
  webpack: () => spin.webpack(OPTIONS),
  rollup: () => spin.rollup(OPTIONS),
  rolldown: () => spin.rolldown(OPTIONS),
  esbuild: () => spin.esbuild(OPTIONS),
  bun: () => spin.bun(OPTIONS),
  rsbuild: () => spin.rsbuild(OPTIONS),
  unloader: () => spin.unloader(OPTIONS),
  raw: () => spin.raw(OPTIONS, META),
};

describe("every bundler shape", () => {
  for (const [name, build] of Object.entries(CONSTRUCTION)) {
    it(`carries both stages: ${name}`, () => {
      // Webpack/rspack compile the factory into a compiler hook, and
      // esbuild into one host plugin: the stages are inside `apply`/
      // `setup`, not listed. What the loop pins there is that the shape
      // builds from the same options without throwing, and names the
      // host after both stages where the adapter names one.
      if (name === "rspack" || name === "webpack") {
        const plugin = build() as { apply?: unknown };
        assert.equal(typeof plugin.apply, "function");
        return;
      }
      if (name === "esbuild" || name === "bun") {
        const plugin = build() as { name?: string; setup?: unknown };
        assert.equal(plugin.name, "unplugin-host:spin-components:spin");
        assert.equal(typeof plugin.setup, "function");
        return;
      }
      const stages = stagesOf(build());
      assert.deepEqual(
        stages.map((stage) => stage.name).sort(),
        ["spin", "spin-components"],
      );
      const byName = new Map(stages.map((stage) => [stage.name, stage]));
      // Vite/rollup-family adapters preserve `enforce`; farm compiles
      // the factory into priority hooks and does not surface it.
      if (name !== "farm") {
        assert.equal(byName.get("spin-components")?.enforce, "pre");
        assert.equal(byName.get("spin")?.enforce, "post");
      }
    });
  }

  // The shapes whose stylesheet stage exposes its hooks: vite, rollup,
  // rolldown, unloader, raw. Webpack/rspack/esbuild/bun hide them inside
  // `apply`/`setup`, farm compiles them into priority hooks, and
  // rsbuild into its own plugin object — the construction loop above is
  // the assertion those shapes get.
  for (
    const [name, build] of
      Object.entries(CONSTRUCTION).filter(([shape]) =>
        ["vite", "rollup", "rolldown", "unloader", "raw"].includes(shape)
      )
  ) {
    it(`generates the brand sheet through uno.css: ${name}`, async () => {
      const stages = stagesOf(build());
      const sheet = stages.find((stage) =>
        stage.name === "spin"
      ) as unknown as {
        resolveId: (id: string) => Promise<string | null> | string | null;
        load: (id: string) => Promise<string | null> | string | null;
      };
      const id = await sheet.resolveId("uno.css");
      assert.equal(id, "/__uno.css");
      const css = await sheet.load(id!);
      assert.equal(typeof css, "string");
      assert.ok(
        (css as string).length > 0,
        "the stylesheet stage generates a sheet",
      );
      assert.ok(
        (css as string).includes("halide-probe"),
        "the brand theme's token lands in the sheet",
      );
    });
  }

  it("generates no brand token without a brand theme", async () => {
    const stages = stagesOf(spin.vite({
      extends: { themes: {} },
      themesDir: "spin-nonexistent",
      safelist: false,
      strictClasses: false,
    }));
    const sheet = stages.find((stage) =>
      stage.name === "spin"
    ) as unknown as {
      resolveId: (id: string) => Promise<string | null> | string | null;
      load: (id: string) => Promise<string | null> | string | null;
    };
    const css = await sheet.load((await sheet.resolveId("uno.css"))!);
    assert.equal(typeof css, "string");
    assert.ok(
      !(css as string).includes("halide-probe"),
      "no brand theme, no brand token",
    );
  });
});
