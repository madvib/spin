import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { readFileSync } from "node:fs";
import { spinPreset } from "../src/index.ts";
import { describeCatalog } from "../src/catalog.ts";
import { parseTokens } from "@spinjs/theme";

const theme = JSON.parse(
  readFileSync(new URL("../../theme/src/themes/minimal.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

test("a declared style emits its full tuple as one utility", async () => {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: theme } })],
  });
  const { matched, css } = await uno.generate("type-body", {
    extendedInfo: true,
  });
  assert(matched.has("type-body"), "a declared style resolves to a rule");
  assert(css.includes("font-family"), "a style states its face");
  assert(css.includes("font-size"), "a style states its size");
  assert(css.includes("font-weight"), "a style states its weight");
  assert(css.includes("letter-spacing"), "a style states its tracking");
  assert(css.includes("line-height"), "a style states its leading");
});

test("a style nobody declared matches no rule", async () => {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: theme } })],
  });
  const { matched } = await uno.generate("type-nobody-declared-this", {
    extendedInfo: true,
  });
  deepStrictEqual(
    [...matched.keys()],
    [],
    "an undeclared style must not resolve",
  );
});

test("the catalog lists the style family from the theme", async () => {
  const parsed = parseTokens(theme);
  if (!parsed.ok) throw new Error(parsed.error);
  const section = describeCatalog(parsed.tree).find((s) => s.id === "font-style");
  assert(section !== undefined, "the catalog names the font-style family");
  assert(
    section.utilities.includes("type-body"),
    "the theme's body style is listed",
  );
});
