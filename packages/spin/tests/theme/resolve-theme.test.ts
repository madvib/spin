import { test } from "bun:test";
import assert from "node:assert/strict";
import { resolveTheme } from "../../src/theme/resolve-theme.ts";
import { silkTheme } from "../../src/theme/themes/index.ts";

test("an alias resolves to the value it names", () => {
  const light = resolveTheme(silkTheme, "light");
  // `color.selected` is `{color.text}` in the starter; the map hands over the
  // resolved value, not the reference string.
  assert.deepStrictEqual(
    light.values["color.selected"],
    light.values["color.text"],
  );
  assert.equal(light.unresolved.length, 0);
});

test("a mode applies the overrides the document declares", () => {
  const light = resolveTheme(silkTheme, "light");
  const dark = resolveTheme(silkTheme, "dark");
  assert.notDeepStrictEqual(
    light.values["color.primary"],
    dark.values["color.primary"],
  );
});

test("a malformed document is refused", () => {
  assert.throws(() => resolveTheme("{ not json", "light"), /spin:/);
});
