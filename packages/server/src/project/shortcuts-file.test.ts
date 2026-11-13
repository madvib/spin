import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProjectShortcutsFile } from "./sync.ts";

/**
 * The shortcuts a themes directory declares, read from `shortcuts.json`.
 *
 * One table of names to class lists, validated as JSON. A missing file
 * declares nothing; a file that does not parse — or an entry that is not
 * a string — is unreadable rather than guessed at.
 */

/** A themes directory holding the given `shortcuts.json` text. */
function fixture(text: string): string {
  const root = mkdtempSync(join(tmpdir(), "spin-shortcuts-"));
  mkdirSync(join(root, "spin"), { recursive: true });
  writeFileSync(join(root, "spin", "shortcuts.json"), text);
  return join(root, "spin");
}

test("a file declares the shortcuts it composes", () => {
  const declared = readProjectShortcutsFile(
    fixture(JSON.stringify({ stack: "flex flex-col gap-4" })),
  );
  deepStrictEqual(declared.shortcuts["stack"], ["flex", "flex-col", "gap-4"]);
  deepStrictEqual(declared.unreadable, false);
});

test("a missing file declares nothing", () => {
  const root = mkdtempSync(join(tmpdir(), "spin-shortcuts-"));
  mkdirSync(join(root, "spin"), { recursive: true });
  const declared = readProjectShortcutsFile(join(root, "spin"));
  deepStrictEqual(declared.shortcuts, {});
  deepStrictEqual(declared.unreadable, false);
});

test("a file that does not parse is reported as unreadable", () => {
  const declared = readProjectShortcutsFile(fixture("{ not json"));
  deepStrictEqual(declared.unreadable, true);
  deepStrictEqual(declared.shortcuts, {});
});

test("a file that is not an object is reported as unreadable", () => {
  const declared = readProjectShortcutsFile(fixture(`["stack"]`));
  deepStrictEqual(declared.unreadable, true);
  deepStrictEqual(declared.shortcuts, {});
});

test("an entry that is not a string is skipped and reported", () => {
  const declared = readProjectShortcutsFile(
    fixture(JSON.stringify({ stack: "flex", dynamic: ["flex"] })),
  );
  deepStrictEqual(declared.shortcuts, { stack: ["flex"] });
  deepStrictEqual(declared.unreadable, true);
});
