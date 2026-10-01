import { assert } from "@std/assert";
import { createGenerator } from "@unocss/core";
import { spinPreset } from "../src/index.ts";

Deno.test("document with token utilities emits every token variable", async () => {
  const uno = await createGenerator({ presets: [spinPreset()] });
  const { css } = await uno.generate("bg-primary p-4 flex");
  assert(css.includes("var(--color-primary)"), `missing color var in: ${css}`);
  assert(css.includes("var(--spacing-4)"), `missing spacing var in: ${css}`);
  assert(css.includes("display"), `missing layout output in: ${css}`);
});
