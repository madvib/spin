import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import presetAttributify from "@unocss/preset-attributify";
import { spinPreset } from "../src/index.ts";

async function matchedIn(
  markup: string,
  strict: boolean,
): Promise<string[]> {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { default: { $extends: "minimal" } } }), presetAttributify({ strict })],
  });
  const { matched } = await uno.generate(markup);
  return [...matched];
}

test("attributify resolves theme attributes in both modes", async () => {
  deepStrictEqual(
    await matchedIn('<div bg="surface"></div>', true),
    ['[bg~="surface"]'],
  );
  deepStrictEqual(
    await matchedIn('<div bg="surface"></div>', false),
    ['[bg~="surface"]'],
  );
});

test("attributify matches nothing for arbitrary values", async () => {
  deepStrictEqual(await matchedIn('<div bg="[#bada55]"></div>', true), []);
  deepStrictEqual(await matchedIn('<div bg="[#bada55]"></div>', false), []);
});
