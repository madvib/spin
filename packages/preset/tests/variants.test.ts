import { assert } from "@std/assert";
import { createGenerator } from "@unocss/core";
import { spinPreset } from "../src/index.ts";

async function cssFor(classes: string): Promise<string> {
  const uno = await createGenerator({ presets: [spinPreset()] });
  const { css } = await uno.generate(classes);
  return css;
}

Deno.test("hover:bg-primary applies on hover", async () => {
  const css = await cssFor("hover:bg-primary");
  assert(css.includes(":hover"), `missing pseudo in: ${css}`);
  assert(css.includes("background-color"), `missing property in: ${css}`);
  assert(css.includes("var(--color-primary)"), `missing var in: ${css}`);
});

Deno.test("focus:p-4 applies on focus", async () => {
  const css = await cssFor("focus:p-4");
  assert(css.includes(":focus"), `missing pseudo in: ${css}`);
  assert(css.includes("padding"), `missing property in: ${css}`);
  assert(css.includes("var(--spacing-4)"), `missing var in: ${css}`);
});
