import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brandIconCollections, configIn, foreignFiles, savedIconGlyphs, themeTextsIn } from "./sync.ts";

/**
 * The project's own configuration, read from `spin/config.json`.
 *
 * Project facts only: the brand, the components directory, the lint
 * strictness, the icon collection. Every failure mode answers the empty
 * config — a half written config must not cost the reader the themes the
 * project has — and `config.json` itself never surfaces as a theme.
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

/** A root with a `spin/` directory holding one brand. */
function brandFixture(brand: string, tokens: string): string {
  const root = mkdtempSync(join(tmpdir(), "spin-config-"));
  mkdirSync(join(root, "spin", brand), { recursive: true });
  writeFileSync(join(root, "spin", brand, "tokens.json"), tokens);
  return root;
}

test("a config file answers the project's facts", () => {
  const root = fixture({
    "config.json": JSON.stringify({
      brand: "halide",
      componentsDir: "src/ui",
      strictness: "balanced",
      icons: { collection: "lucide" },
    }),
  });
  deepStrictEqual(configIn(root), {
    brand: "halide",
    componentsDir: "src/ui",
    strictness: "balanced",
    icons: { collection: "lucide" },
  });
});

test("a seating key the schema does not name is stripped, never kept", () => {
  const root = fixture({
    "config.json": JSON.stringify({
      brand: "halide",
      activeTheme: "halide",
      themeOrder: ["halide"],
      contractThemes: ["halide"],
    }),
  });
  deepStrictEqual(configIn(root), { brand: "halide" });
});

test("a missing, unreadable, or unparsable config answers empty", () => {
  const bare = mkdtempSync(join(tmpdir(), "spin-config-"));
  deepStrictEqual(configIn(bare), {});
  const absent = brandFixture("halide", "{}");
  deepStrictEqual(configIn(absent), {});
  const halfWritten = fixture({ "config.json": '{"brand":' });
  deepStrictEqual(configIn(halfWritten), {});
  const notAnObject = fixture({ "config.json": '["halide"]' });
  deepStrictEqual(configIn(notAnObject), {});
});

test("config.json is not served as a theme", () => {
  const root = brandFixture("halide", "{}");
  writeFileSync(
    join(root, "spin", "config.json"),
    JSON.stringify({ brand: "halide" }),
  );
  deepStrictEqual(Object.keys(themeTextsIn(root)), ["halide"]);
});

test("each brand reads as its tokens, beside the global reference", () => {
  const root = brandFixture("halide", '{"own":true}');
  mkdirSync(join(root, "spin", "acme"), { recursive: true });
  writeFileSync(join(root, "spin", "acme", "tokens.json"), '{"own":true}');
  writeFileSync(join(root, "spin", "reference.json"), '{"ref":true}');
  writeFileSync(join(root, "spin", "legacy.json"), '{"legacy":true}');
  const texts = themeTextsIn(root);
  deepStrictEqual(Object.keys(texts).sort(), ["acme", "halide", "reference"]);
  deepStrictEqual(texts["halide"], '{"own":true}');
});

test("each brand's collection joins the declared icon set", () => {
  const root = mkdtempSync(join(tmpdir(), "spin-icons-"));
  mkdirSync(join(root, "spin", "acme"), { recursive: true });
  writeFileSync(
    join(root, "spin", "acme", "brand.json"),
    JSON.stringify({ name: "acme", icons: { collection: "lucide" } }),
  );
  mkdirSync(join(root, "spin", "birch"), { recursive: true });
  writeFileSync(join(root, "spin", "birch", "tokens.json"), "{}");
  deepStrictEqual([...brandIconCollections(join(root, "spin"))], ["lucide"]);
  deepStrictEqual([...brandIconCollections(join(root, "nowhere"))], []);
});

test("each saved glyph reads as the class that names it", () => {
  const root = mkdtempSync(join(tmpdir(), "spin-icons-"));
  mkdirSync(join(root, "spin", "icons"), { recursive: true });
  writeFileSync(
    join(root, "spin", "icons", "star.json"),
    JSON.stringify({ markup: "<svg/>", attribution: { collection: "tabler" } }),
  );
  writeFileSync(join(root, "spin", "icons", "note.txt"), "not a glyph");
  deepStrictEqual([...savedIconGlyphs(join(root, "spin"))], ["i-tabler-star"]);
  deepStrictEqual([...savedIconGlyphs(join(root, "nowhere"))], []);
});

test("code files inside the themes directory are named", () => {
  const root = mkdtempSync(join(tmpdir(), "spin-foreign-"));
  mkdirSync(join(root, "spin", "acme"), { recursive: true });
  writeFileSync(join(root, "spin", "acme", "tokens.json"), "{}");
  writeFileSync(join(root, "spin", "theme.ts"), "export const x = 1;");
  writeFileSync(join(root, "spin", "acme", "helper.mjs"), "export const y = 2;");
  writeFileSync(join(root, "spin", "shortcuts.json"), "{}");
  deepStrictEqual(foreignFiles(join(root, "spin")), ["acme/helper.mjs", "theme.ts"]);
});
