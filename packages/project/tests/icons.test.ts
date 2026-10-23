/**
 * The project's saved icons, over a real directory.
 *
 * Every test writes to a temp root and reads it back: the contract is what a
 * consumer observes — a file that is there, an icon that reads as it was
 * written, a refusal that names its reason — so the tests are about the
 * disk, not about the code that reaches it.
 */

import { assert, assertEquals } from "@std/assert";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listIcons, readIcon, removeIcon, writeIcon } from "../src/index.ts";

/** A root nothing has been written to. */
async function root(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "spin-icons-"));
}

/** The markup of a glyph, as it is saved. */
const MARKUP =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12h14"/></svg>';

/** Where a glyph came from. */
const SOURCE = {
  collection: "lucide",
  author: "Lucide Contributors",
  license: "ISC",
};

Deno.test("a saved icon reads back as it was written", async () => {
  const dir = await root();

  const written = await writeIcon(dir, "arrow-up", {
    markup: MARKUP,
    attribution: SOURCE,
  });
  assertEquals(written.error, null);

  const read = await readIcon(dir, "arrow-up");
  assertEquals(read.icon?.name, "arrow-up");
  assertEquals(read.icon?.markup, MARKUP);
  assertEquals(read.icon?.attribution, SOURCE);
});

Deno.test("the library names the icons the project holds", async () => {
  const dir = await root();
  await writeIcon(dir, "arrow-up", {
    markup: MARKUP,
    attribution: SOURCE,
  });
  await writeIcon(dir, "close", {
    markup: MARKUP,
    attribution: SOURCE,
  });

  const listed = await listIcons(dir);
  assertEquals(listed.map((icon) => icon.name), ["arrow-up", "close"]);
});

Deno.test("a save creates the library the project did not have", async () => {
  const dir = await root();

  const written = await writeIcon(dir, "arrow-up", {
    markup: MARKUP,
    attribution: SOURCE,
  });
  assertEquals(written.error, null);

  const listed = await listIcons(dir);
  assertEquals(listed.map((icon) => icon.name), ["arrow-up"]);
});

Deno.test("an icon saved without a source reads with nothing said about it", async () => {
  const dir = await root();
  await writeIcon(dir, "drawn", {
    markup: MARKUP,
    attribution: { collection: null, author: null, license: null },
  });

  const read = await readIcon(dir, "drawn");
  assertEquals(read.icon?.attribution, {
    collection: null,
    author: null,
    license: null,
  });
});

Deno.test("a removed icon is no longer in the library", async () => {
  const dir = await root();
  await writeIcon(dir, "arrow-up", {
    markup: MARKUP,
    attribution: SOURCE,
  });

  const removed = await removeIcon(dir, "arrow-up");
  assertEquals(removed.error, null);

  assertEquals(await listIcons(dir), []);
  assertEquals((await readIcon(dir, "arrow-up")).icon, null);
});

Deno.test("a name that is not a file stem is refused", async () => {
  const dir = await root();

  const written = await writeIcon(dir, "arrow up!", {
    markup: MARKUP,
    attribution: SOURCE,
  });
  assert(
    written.error !== null && written.error.includes("arrow up!"),
    `the refusal names the name: ${written.error}`,
  );

  assertEquals(await listIcons(dir), []);
});

Deno.test("a file that carries no markup is not an icon", async () => {
  const dir = await root();
  await mkdir(join(dir, "spin", "icons"), { recursive: true });
  await writeFile(
    join(dir, "spin", "icons", "notes.json"),
    '{"note":"not an icon"}',
    "utf8",
  );

  assertEquals(await listIcons(dir), []);
  assertEquals((await readIcon(dir, "notes")).icon, null);
});

Deno.test("an operation about one root leaves another root alone", async () => {
  const mine = await root();
  const yours = await root();
  await writeIcon(mine, "arrow-up", {
    markup: MARKUP,
    attribution: SOURCE,
  });

  assertEquals(await listIcons(yours), []);
  assertEquals((await readIcon(yours, "arrow-up")).icon, null);
});

Deno.test("a project that holds no icons holds an empty library", async () => {
  const dir = await root();
  await mkdir(join(dir, "spin"), { recursive: true });

  assertEquals(await listIcons(dir), []);
});
