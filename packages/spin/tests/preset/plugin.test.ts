import { test } from "bun:test";
/**
 * The specifier table — the bridge between the packages' Deno import-map
 * world and rolldown's bare-specifier world. Its contract:
 *
 * - geometry: entries point INTO the packages' source, computed from the
 *   plugin's own location;
 * - order: longest match first, so a prefix entry cannot swallow the
 *   special-case ids that ride ahead of it;
 * - shape: an entry is a find/replacement pair — a prefix capture returns
 *   the matcher's tail, not a hardcoded file;
 * - life: an entry exists only while its target exists. A package consumed
 *   from npm has no source tree for the table to point at, and the natural
 *   resolution takes over.
 */
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { spinAliases } from "../../src/plugin/plugin.ts";

test("the specifier table resolves spin packages to source that exists", async () => {
  const entries = await spinAliases();
  assert(entries.length > 0);

  for (const entry of entries) {
    const isPrefix = entry.replacement.includes("$1") &&
      entry.replacement.includes("/");
    if (isPrefix) {
      // A prefix entry: resolve a known subpath through it and prove the
      // capture lands on a real file.
      const probe = entry.replacement.replace("$1", "index.ts");
      const info = await stat(probe).catch(() => null);
      if (info?.isFile()) continue;
      // The spin catch-all fans out to area dirs, not a root index: probe
      // one area each consumer actually spells.
      const area = entry.replacement.replace("$1", "plugin/plugin.ts");
      const areaInfo = await stat(area);
      assert(areaInfo.isFile(), `${entry.replacement} resolves no known subpath`);
    } else {
      // An exact entry: the replacement is a file that is really there.
      const info = await stat(entry.replacement);
      assert(info.isFile, `${entry.replacement} should exist`);
    }
  }
});

test("prefix entries own subpaths and return the matcher's tail", async () => {
  const entries = await spinAliases();
  const prefixes = entries.filter(
    (entry) => entry.find instanceof RegExp && entry.replacement.includes("$1"),
  );
  assert(prefixes.length > 0, "at least one prefix entry exists");
  const spinPrefix = prefixes.find((entry) =>
    (entry.find as RegExp).test("@spinjs/spin/theme/base")
  )!;
  assert(
    (spinPrefix.find as RegExp).test("@spinjs/spin/theme/base"),
    "the spin prefix matches subpaths",
  );
  const themePrefix = prefixes.find((entry) =>
    (entry.find as RegExp).test("@spinjs/theme/base")
  )!;
  assert(themePrefix, "the legacy theme prefix still matches subpaths");
  // The replacement carries the capture through: `@spinjs/spin/a/b` is
  // rewritable, its tail reaching the package source.
  assert(
    spinPrefix.replacement.includes("$1"),
    "a prefix entry replays the matcher's tail, not a file",
  );
});

test("longest match rides first: base, then prefix, then exact", async () => {
  const entries = await spinAliases();
  const indexOf = (
    predicate: (value: typeof entries[number]) => boolean,
  ): number => entries.findIndex(predicate);
  const vite = indexOf((entry) => entry.find === "@spinjs/spin/vite");
  const spinPrefix = indexOf(
    (entry) =>
      entry.find instanceof RegExp &&
      (entry.find as RegExp).test("@spinjs/spin/theme/base"),
  );
  const exact = indexOf((entry) => entry.find === "@spinjs/spin");
  assert(vite > -1);
  assert(spinPrefix > -1);
  assert(exact > -1);
  assert(vite < spinPrefix);
  assert(spinPrefix < exact);
});

test("no npm: specifiers survive the cutover", async () => {
  // The cutover stripped every `npm:` prefix at the source, so the alias
  // table carries no strip rule: bare specifiers resolve natively.
  const entries = await spinAliases();
  const strip = entries.find(
    (entry) => entry.find instanceof RegExp && entry.replacement === "$1",
  );
  assert(!strip, "the npm: strip is gone with the last npm: import");
});
