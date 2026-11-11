import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configIn, themeTextsIn } from "./sync.ts";

/**
 * The project's own configuration, read from `spin/config.json`.
 *
 * Additive metadata only: which theme the studio seats, and what order the
 * theme list shows. Every failure mode answers the empty config — a half
 * written config must not cost the reader the themes the project has — and
 * `config.json` itself never surfaces as a theme.
 */

/** A root with a `spin/` directory holding the given files. */
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "spin-config-"));
  mkdirSync(join(root, "spin"), { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(root, "spin", name), text);
  }
  return root;
}

test("a config file answers its active theme and order", () => {
  const root = fixture({
    "config.json": JSON.stringify({
      activeTheme: "halide",
      themeOrder: ["halide", "acme"],
    }),
    "halide.json": "{}",
    "acme.json": "{}",
  });
  deepStrictEqual(configIn(root), {
    activeTheme: "halide",
    themeOrder: ["halide", "acme"],
  });
});
test("a config file answers its contract themes", () => {
  const root = fixture({
    "config.json": JSON.stringify({ contractThemes: ["halide", "acme"] }),
    "halide.json": "{}",
    "acme.json": "{}",
  });
  deepStrictEqual(configIn(root), { contractThemes: ["halide", "acme"] });
});


test("a missing, unreadable, or unparsable config answers empty", () => {
  const bare = mkdtempSync(join(tmpdir(), "spin-config-"));
  deepStrictEqual(configIn(bare), {});
  const absent = fixture({ "halide.json": "{}" });
  deepStrictEqual(configIn(absent), {});
  const halfWritten = fixture({ "config.json": '{"activeTheme":' });
  deepStrictEqual(configIn(halfWritten), {});
  const notAnObject = fixture({ "config.json": '["halide"]' });
  deepStrictEqual(configIn(notAnObject), {});
});

test("config.json is not served as a theme", () => {
  const root = fixture({
    "config.json": JSON.stringify({ activeTheme: "halide" }),
    "halide.json": "{}",
  });
  deepStrictEqual(Object.keys(themeTextsIn(root)), ["halide"]);
});
