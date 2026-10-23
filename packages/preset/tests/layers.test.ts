import { assert } from "@std/assert";
import { createGenerator } from "@unocss/core";
import { readFileSync } from "node:fs";
import { spinPreset } from "../src/index.ts";

/**
 * The order the sheet is written in.
 *
 * The preset declares the order of its layers, and the declaration is the
 * contract: the reset is the stage every document needs before anything else
 * means anything, the theme's variables come next, the components sit under
 * the utilities, and a utility is the last word. A layer the declaration does
 * not name has no order at all, and lands wherever the sort puts it — which
 * is how a reset that means to be first becomes the last thing in the sheet.
 *
 * So the sheet is read, and the order it is read in is what is asserted.
 */

const DEFAULT = new URL(
  "../../theme/src/themes/silk.json",
  import.meta.url,
);
const theme = JSON.parse(readFileSync(DEFAULT, "utf8")) as Record<
  string,
  unknown
>;

/** Where a pattern first matches in the sheet, or -1 when it never does. */
function at(css: string, pattern: RegExp): number {
  return pattern.exec(css)?.index ?? -1;
}

Deno.test("the reset is written before the theme and the utilities", async () => {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: theme } })],
  });
  const { css } = await uno.generate("bg-primary flex");

  const reset = at(
    css,
    /\*,\s*::before,\s*::after\s*\{\s*box-sizing:\s*border-box;\s*border-width:\s*0;/,
  );
  const variables = at(css, /:where\(:root\)\s*\{/);
  const utility = at(css, /\.bg-primary(?![\w-])/);

  assert(reset !== -1, `the reset is missing from the sheet:\n${css}`);
  assert(
    variables !== -1,
    `the theme's variables are missing from the sheet:\n${css}`,
  );
  assert(utility !== -1, `the utility is missing from the sheet:\n${css}`);

  assert(
    reset < variables,
    `the reset must land before the theme's variables:\n${css}`,
  );
  assert(
    reset < utility,
    `the reset must land before the utilities:\n${css}`,
  );
});

Deno.test("the theme's variables are written before the utilities", async () => {
  // The other half of the same order: a component is a default and a utility
  // is a decision, so the utilities have to come last.
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: theme } })],
  });
  const { css } = await uno.generate("bg-primary flex");

  const variables = at(css, /:where\(:root\)\s*\{/);
  const utility = at(css, /\.bg-primary(?![\w-])/);

  assert(
    variables !== -1 && utility !== -1,
    `the sheet carries neither the theme's variables nor the utility:\n${css}`,
  );
  assert(
    variables < utility,
    `the theme's variables must land before the utilities:\n${css}`,
  );
});
