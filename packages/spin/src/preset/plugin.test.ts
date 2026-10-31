import assert from "node:assert";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { starterThemes } from "../theme/themes/index.ts";
import type { ThemeDocument } from "../theme/index.ts";
import { projectThemes, themesFromDisk } from "./plugin.ts";

/** A file a project wrote. The merge does not read it; it only has to win. */
const fork = {
  color: { $type: "color", primary: { $value: "#123456" } },
} as unknown as ThemeDocument;

describe("the themes a project serves", () => {
  it("are the shipped starters when the project has no files of its own", () => {
    assert.deepEqual(
      Object.keys(projectThemes({})).sort(),
      Object.keys(starterThemes).sort(),
    );
    assert.deepEqual(projectThemes({}).neobrut, starterThemes.neobrut);
  });

  it("fork a starter when a file carries its name", () => {
    const served = projectThemes({ neobrut: fork });
    assert.deepEqual(served.neobrut, fork);
    assert.deepEqual(served.silk, starterThemes.silk);
  });

  it("keep a project's own names beside the starters", () => {
    const served = projectThemes({ acme: fork });
    assert.deepEqual(served.acme, fork);
    assert.deepEqual(
      Object.keys(served).sort(),
      [...Object.keys(starterThemes), "acme"].sort(),
    );
  });
});

describe("the themes a directory holds", () => {
  /** A root with a local theme and a fixture package beside it. */
  async function fixture(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "spin-disk-"));
    await mkdir(join(root, "spin"), { recursive: true });
    await mkdir(join(root, "node_modules/@acme/kit/themes"), {
      recursive: true,
    });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "probe" }),
    );
    await writeFile(
      join(root, "node_modules/@acme/kit/package.json"),
      JSON.stringify({ name: "@acme/kit" }),
    );
    const doc = JSON.stringify({
      color: { primary: { $value: "#123456" } },
    });
    await writeFile(join(root, "spin/local.json"), doc);
    await writeFile(
      join(root, "node_modules/@acme/kit/themes/shared.json"),
      doc,
    );
    return root;
  }

  it("reads the local directory by stem", async () => {
    const root = await fixture();
    const themes = await themesFromDisk(root);
    assert.deepEqual(Object.keys(themes), ["local"]);
  });

  it("reads a specifier's directory by stem", async () => {
    const root = await fixture();
    const themes = await themesFromDisk(root, "@acme/kit/themes");
    assert.deepEqual(Object.keys(themes), ["shared"]);
  });
});
