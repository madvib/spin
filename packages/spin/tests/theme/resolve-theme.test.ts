import { test } from "bun:test";
import assert from "node:assert/strict";
import { resolveTheme } from "@spinjs/theme";
import { minimalTheme } from "@spinjs/theme/themes";

test("an alias resolves to the value it names", () => {
  const light = resolveTheme(minimalTheme, "light");
  // `color.selected` is `{color.text}` in the starter; the map hands over the
  // resolved value, not the reference string.
  assert.deepStrictEqual(
    light.values["color.selected"],
    light.values["color.text"],
  );
  assert.equal(light.unresolved.length, 0);
});

test("a mode applies the overrides the document declares", () => {
  const light = resolveTheme(minimalTheme, "light");
  const dark = resolveTheme(minimalTheme, "dark");
  assert.notDeepStrictEqual(
    light.values["color.primary"],
    dark.values["color.primary"],
  );
});

test("a malformed document is refused", () => {
  assert.throws(() => resolveTheme("{ not json", "light"), /spin:/);
});
