import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { writeManifest } from "../src/rules/primitives/derive.ts";

/**
 * The manifest is written by reading the checked-in file: `variants` and
 * `reads` are derived from the rules, but tags, `component` and the comments
 * that explain them are hand knowledge the CSS cannot speak to. A regen that
 * cannot read them back writes an empty field and looks like a success — so
 * the round trip is proven here, on a copy, where a failure leaves the
 * checked-in file for the reader instead of rewriting it.
 */

const MANIFEST = new URL(
  "../src/rules/primitives/manifest.ts",
  import.meta.url,
);

test("a regen keeps the comment above an authored field", async () => {
  // `component` is hand knowledge the rules cannot derive, and the comment
  // above it says why the field is what it is. A regen that drops the
  // comment is one regen away from dropping the field it explains.
  const copy = await mkdtemp(join(tmpdir(),"spin-")) + "/manifest.ts";
  try {
    await copyFile(MANIFEST, copy);
    await writeManifest(pathToFileURL(copy));
    const avatar = /^ {2}avatar: \{[\s\S]*?\n {2}\},/m.exec(
      await readFile(copy, "utf8"),
    )?.[0] ?? "";
    assert(
      avatar.includes("// The ladder is the avatar's whole palette"),
      `the authored comment survives the regen:\n${avatar}`,
    );
    deepStrictEqual(
      avatar.includes(
        '{ path: "avatar.md", type: "dimension", value: "2.5rem" }',
      ),
      true,
      "and the field it explains, with it",
    );
  } finally {
    await rm(copy);
  }
});
