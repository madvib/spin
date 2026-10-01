import { assertEquals } from "@std/assert";
import { createGenerator } from "@unocss/core";
import presetAttributify from "@unocss/preset-attributify";
import { spinPreset } from "../src/index.ts";

async function matchedIn(
  markup: string,
  strict: boolean,
): Promise<string[]> {
  const uno = await createGenerator({
    presets: [spinPreset(), presetAttributify({ strict })],
  });
  const { matched } = await uno.generate(markup);
  return [...matched];
}

Deno.test("attributify resolves theme attributes in both modes", async () => {
  assertEquals(
    await matchedIn('<div bg="primary"></div>', true),
    ['[bg~="primary"]'],
  );
  assertEquals(
    await matchedIn('<div bg="primary"></div>', false),
    ['[bg~="primary"]'],
  );
});

Deno.test("attributify matches nothing for arbitrary values", async () => {
  assertEquals(await matchedIn('<div bg="[#bada55]"></div>', true), []);
  assertEquals(await matchedIn('<div bg="[#bada55]"></div>', false), []);
});
