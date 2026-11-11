import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import assert from "node:assert/strict";
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
  const copy = await mkdtemp(join(tmpdir(),"spin-")) + "/manifest.ts";
  try {
    await copyFile(MANIFEST, copy);
    await writeManifest(pathToFileURL(copy));
    const badge = /^ {2}badge: \{[\s\S]*?\n {2}\},/m.exec(
      await readFile(copy, "utf8"),
    )?.[0] ?? "";
    assert(
      badge.includes('"badge"'),
      `the badge entry survives the regen:\n${badge}`,
    );
  } finally {
    await rm(copy);
  }
});
