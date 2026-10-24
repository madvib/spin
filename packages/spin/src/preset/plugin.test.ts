import assert from "node:assert";
import { describe, it } from "node:test";
import { starterThemes } from "../theme/themes/index.ts";
import type { ThemeDocument } from "../theme/index.ts";
import { projectThemes } from "./plugin.ts";

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
