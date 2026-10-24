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
import { readdir, stat } from "node:fs/promises";
import { spinAliases } from "../src/plugin.ts";

test("the specifier table resolves spin packages to source that exists", async () => {
  const entries = await spinAliases();
  assert(entries.length > 0);

  for (const entry of entries) {
    const isPrefix = entry.replacement.includes("$1") &&
      entry.replacement.includes("/");
    if (isPrefix) {
      // A prefix entry: its directory is the part before the capture.
      const dir = entry.replacement.replace(/\$1$/, "");
      const info = await stat(dir);
      assert(info.isDirectory, `${dir} should be the package source dir`);
      // …and it is the package's src dir itself: the index module beside
      // the rewrite target proves the capture can't land on a file's name.
      const names: string[] = [];
      for (const name of await readdir(dir)) names.push(name);
      assert(
        names.includes("index.ts"),
        `${dir} should be the package's src dir`,
      );
    } else {
      // An exact entry: the replacement is a file that is really there.
      const info = await stat(entry.replacement);
      assert(info.isFile, `${entry.replacement} should exist`);
    }
  }
});

test("prefix entries own subpaths and return the matcher's tail", async () => {
  const entries = await spinAliases();
  const themePrefix = entries.find(
    (entry) => entry.find instanceof RegExp && entry.replacement.includes("$1"),
  )!;
  assert(themePrefix, "at least one prefix entry exists");
  assert(
    (themePrefix.find as RegExp).test("@spin/theme/themes"),
    "the theme prefix matches subpaths",
  );
  // The replacement carries the capture through: `@spin/theme/a/b` is
  // rewritable, its tail reaching the package source.
  assert(
    themePrefix.replacement.includes("$1"),
    "a prefix entry replays the matcher's tail, not a file",
  );
});

test("longest match rides first: base, then prefix, then exact", async () => {
  const entries = await spinAliases();
  const indexOf = (
    predicate: (value: typeof entries[number]) => boolean,
  ): number => entries.findIndex(predicate);
  const base = indexOf((entry) => entry.find === "@spin/theme/base");
  const prefix = indexOf(
    (entry) =>
      entry.find instanceof RegExp ||
      typeof entry.find === "string" && entry.find.includes("$1"),
  );
  const exact = indexOf((entry) => entry.find === "@spin/theme");
  assert(base > -1);
  assert(prefix > -1);
  assert(exact > -1);
  assert(base < prefix);
  assert(prefix < exact);
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
