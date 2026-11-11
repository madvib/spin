import assert from "node:assert";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { designLanguages, type ThemeDocument } from "@spinjs/theme";
import { projectThemes, spin } from "./plugin.ts";
import { loadProjectBrand } from "@spinjs/server/project";
/** A brand document and a local fork. The merge does not read them; one has to win. */
const brandDoc = {
  color: { $type: "color", primary: { $value: "#111111" } },
} as unknown as ThemeDocument;
const fork = {
  color: { $type: "color", primary: { $value: "#123456" } },
} as unknown as ThemeDocument;

describe("the themes a project serves", () => {
  it("serves the brand layer when the project has no files of its own", () => {
    assert.deepEqual(projectThemes({ halide: brandDoc }, {}), {
      halide: brandDoc,
    });
  });

  it("serves nothing when neither layer names a theme", () => {
    assert.deepEqual(projectThemes({}, {}), {});
  });

  it("forks a brand theme when a local file carries its name", () => {
    const served = projectThemes({ halide: brandDoc }, { halide: fork });
    assert.deepEqual(served.halide, fork);
  });

  it("keeps local-only names beside the brand", () => {
    const served = projectThemes({ halide: brandDoc }, { acme: fork });
    assert.deepEqual(served.halide, brandDoc);
    assert.deepEqual(served.acme, fork);
  });
});

describe("the themes a directory holds", () => {
  /** A root with a local theme. */
  async function fixture(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "spin-disk-"));
    await mkdir(join(root, "spin"), { recursive: true });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "probe" }),
    );
    const doc = JSON.stringify({
      color: { primary: { $value: "#123456" } },
    });
    await writeFile(join(root, "spin/local.json"), doc);
    return root;
  }

  it("reads the local directory by stem", async () => {
    const root = await fixture();
    const facets = await loadProjectBrand(root);
    assert.deepEqual(Object.keys(facets.themes), ["local"]);
  });

  it("refuses a specifier with the redirect to extends", async () => {
    const root = await fixture();
    await assert.rejects(
      loadProjectBrand(root, "@acme/kit/themes"),
      /shared trees arrive through extends, not paths: '@acme\/kit\/themes'/,
    );
  });
});

describe("the icons every app gets by default", () => {
  /** A root whose content names one icon glyph. */
  async function iconFixture(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "spin-icons-"));
    await mkdir(join(root, "spin"), { recursive: true });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "probe" }),
    );
    await writeFile(join(root, "spin/local.json"), JSON.stringify(designLanguages.minimal));
    await writeFile(
      join(root, "index.html"),
      '<span class="i-lucide-folder"></span>',
    );
    return root;
  }

  /** The stylesheet stage: the one whose `resolveId` claims `uno.css`. */
  type StylesheetHooks = {
    configResolved?: (config: { root: string; command: string }) => void;
    resolveId?: (id: string) => string | null | Promise<string | null>;
    load?: (id: string) => string | null | Promise<string | null>;
  };

  async function stylesheetOf(root: string, icons?: boolean): Promise<string> {
    const stages = spin.vite(
      icons === undefined ? {} : { icons },
    ) as unknown as StylesheetHooks[];
    let stage: StylesheetHooks | undefined;
    for (const candidate of stages) {
      if ((await candidate.resolveId?.("uno.css")) != null) {
        stage = candidate;
        break;
      }
    }
    if (stage === undefined) throw new Error("spin.vite() returned no stylesheet stage");
    stage.configResolved?.({ root, command: "build" });
    const id = await stage.resolveId?.("uno.css");
    if (id === null || id === undefined) throw new Error("stylesheet stage claims no id");
    const css = await stage.load?.(id);
    if (typeof css !== "string") throw new Error("stylesheet stage loaded no sheet");
    return css;
  }

  it("resolves the shipped lucide collection with no presets option", async () => {
    const css = await stylesheetOf(await iconFixture());
    assert.match(css, /\.i-lucide-folder\s*\{[^}]*--un-icon/);
  });

  it("emits no icon rule when icons: false silences the default", async () => {
    const css = await stylesheetOf(await iconFixture(), false);
    assert.doesNotMatch(css, /\.i-lucide-folder/);
  });
});
