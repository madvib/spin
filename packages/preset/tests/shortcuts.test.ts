import { assert, assertEquals } from "@std/assert";
import { createGenerator } from "@unocss/core";
import { readFileSync } from "node:fs";
import { spinPreset } from "../src/index.ts";

/**
 * The project's own shortcuts.
 *
 * A shortcut is a named composition: one class that stands for a set of
 * utilities. The framework does not forbid a project from composing its own
 * vocabulary — the layout an app repeats is the app's decision — but the
 * VALUES stay the theme's, so a theme that prefers roomier sections sets it
 * once and every shortcut follows.
 */

const THEME = new URL(
  "../../theme/src/themes/silk.json",
  import.meta.url,
);
const theme = JSON.parse(readFileSync(THEME, "utf8")) as Record<
  string,
  unknown
>;

async function sheet(
  options: Parameters<typeof spinPreset>[0],
  markup: string,
) {
  const uno = await createGenerator({ presets: [spinPreset(options)] });
  const { css } = await uno.generate(markup);
  return css;
}

/** The declarations of the rule a selector names. */
function declarationsOf(css: string, selector: string): string {
  const index = css.indexOf(`${selector}{`);
  if (index === -1) return "";
  const close = css.indexOf("}", index);
  return css.slice(index + selector.length + 1, close);
}

Deno.test("a project's shortcut stands for the utilities it composes", async () => {
  const css = await sheet(
    { themes: { light: theme }, shortcuts: { stack: "flex flex-col gap-4" } },
    '<div class="stack"></div>',
  );
  const declarations = declarationsOf(css, ".stack");
  assert(declarations !== "", "the shortcut generated no rule");
  assert(
    declarations.includes("display:flex"),
    `the shortcut is not the flex column it declares: ${declarations}`,
  );
  assert(
    declarations.includes("flex-direction:column"),
    `the shortcut does not stack: ${declarations}`,
  );
});

Deno.test("a shortcut spends the theme's spacing, not a number", async () => {
  const css = await sheet(
    { themes: { light: theme }, shortcuts: { stack: "flex flex-col gap-4" } },
    '<div class="stack"></div>',
  );
  assert(
    declarationsOf(css, ".stack").includes("gap:var(--spacing-4)"),
    "the gap is not the theme's spacing step",
  );
});

Deno.test("a shortcut the markup never uses ships nothing", async () => {
  const css = await sheet(
    { themes: { light: theme }, shortcuts: { stack: "flex flex-col gap-4" } },
    '<div class="p-4"></div>',
  );
  assertEquals(
    css.includes(".stack{"),
    false,
    "an unused shortcut is still in the sheet",
  );
});

Deno.test("a project without shortcuts composes nothing of its own", async () => {
  const css = await sheet(
    { themes: { light: theme } },
    '<div class="stack"></div>',
  );
  assertEquals(
    css.includes(".stack{"),
    false,
    "a class the project did not declare generated a rule",
  );
});
