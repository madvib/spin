import assert from "node:assert";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ThemeDocument } from "../theme/index.ts";
import { projectThemes, themesFromDisk } from "./plugin.ts";

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
    const themes = await themesFromDisk(root);
    assert.deepEqual(Object.keys(themes), ["local"]);
  });

  it("refuses a specifier with the redirect to extends", async () => {
    const root = await fixture();
    await assert.rejects(
      themesFromDisk(root, "@acme/kit/themes"),
      /shared trees arrive through extends, not paths: '@acme\/kit\/themes'/,
    );
  });
});
