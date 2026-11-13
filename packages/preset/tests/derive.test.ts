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

test("each framework module names its framework and the tags", async () => {
  // The universal file carries the DOM map; each framework file carries
  // that framework's own augmentation over the same tags. A module that
  // named another framework's shape would typecheck templates against
  // the wrong visitor.
  const dir = new URL("../src/", import.meta.url);
  const universal = await readFile(new URL("elements.d.ts", dir), "utf8");
  deepStrictEqual(
    universal.match(/declare (?:module|global)/g),
    ["declare global"],
  );
  assert(universal.includes('"badge": HTMLElement;'), "the DOM map names the tags");
  const cases = [
    ["elements-react.d.ts", 'declare module "react"', "IntrinsicElements"],
    ["elements-solid.d.ts", 'declare module "solid-js"', "IntrinsicElements"],
    ["elements-svelte.d.ts", 'declare module "svelte/elements"', "SvelteHTMLElements"],
    ["elements-vue.d.ts", 'declare module "vue"', "GlobalComponents"],
  ] as const;
  for (const [file, module, surface] of cases) {
    const text = await readFile(new URL(file, dir), "utf8");
    assert(text.includes(module), `${file} augments its framework`);
    assert(text.includes(surface), `${file} names the framework's surface`);
    assert(text.includes('"badge"'), `${file} names the tags`);
  }
});
