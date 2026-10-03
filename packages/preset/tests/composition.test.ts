import { assert, assertEquals } from "@std/assert";
import { createGenerator } from "@unocss/core";
import { readFileSync } from "node:fs";
import { generateCss, parseDocument } from "@spin/theme";
import {
  requiredRolesFor,
  scaffoldDocument,
  spinPreset,
} from "../src/index.ts";

/**
 * The compositional proof.
 *
 * Preset is the root of the dependency graph, so this is where a theme is
 * checked against everything that consumes it at once — the tokens the CSS
 * reads, the primitives that read them, and the utilities that resolve
 * against them. A failure here is a failure of the whole assembly rather than
 * of one stage, which is what makes it worth its own file rather than another
 * assertion in a unit suite.
 */

const DEFAULT = new URL(
  "../../theme/examples/default/light.json",
  import.meta.url,
);
const theme = JSON.parse(readFileSync(DEFAULT, "utf8")) as Record<
  string,
  unknown
>;

async function assemble(options: Parameters<typeof spinPreset>[0]) {
  const uno = await createGenerator({ presets: [spinPreset(options)] });
  return uno.generate(
    "bg-primary p-4 md:flex gap-gutter animate-spin hover:bg-primary",
  );
}

Deno.test("a complete theme assembles a working document", async () => {
  const { css } = await assemble({ themes: { light: theme } });
  for (
    const expected of [
      "--color-primary",
      "--spacing-4",
      "--font-family-sans",
    ]
  ) {
    assert(css.includes(expected), `missing ${expected} in the assembled css`);
  }
  assert(css.includes("@keyframes spin"), "animation keyframes must ship");
  assert(
    css.includes("min-width: var(--breakpoint-md)"),
    "theme breakpoints drive variants",
  );
  assert(
    css.includes("var(--grid-gutter)"),
    "the container gutter must reach the grid",
  );
  assert(css.includes("prefers-reduced-motion"), "the motion floor must ship");
});

Deno.test("the primitives ship because the theme enables them", async () => {
  const { css } = await assemble({ themes: { light: theme } });
  assert(
    /background-color:\s*var\(--color-primary\)/.test(css),
    "the button spends the primary fill",
  );
  assert(css.includes('[role="button"]'), "the button claims its role");

  const without = await assemble({
    themes: { light: theme },
    primitives: false,
  });
  assert(
    !without.css.includes('[role="button"]'),
    "a utility-only build must not ship components",
  );
});

Deno.test("fonts declared by the theme reach the document", async () => {
  const document = {
    ...theme,
    $extensions: {
      spin: {
        fonts: [{
          family: "Inter",
          src: "url(/fonts/inter.woff2)",
          display: "swap",
        }],
      },
    },
  };
  const { css } = await assemble({ themes: { light: document } });
  assert(css.includes("@font-face {"), "the theme declared a font");
  assert(css.includes("/fonts/inter.woff2"), "the source must be carried");
});

Deno.test("a theme missing a required role is refused", () => {
  assertThrowsIncomplete({
    color: { $type: "color", primary: { $value: "#333333" } },
  });
});

function assertThrowsIncomplete(document: Record<string, unknown>): void {
  let refused = false;
  try {
    spinPreset({ themes: { light: document } });
  } catch (error) {
    refused = true;
    assert(
      (error as Error).message.includes("color.text"),
      `the error names what is missing: ${(error as Error).message}`,
    );
  }
  assert(refused, "an incomplete theme must be refused");
}

Deno.test("the scaffold assembles without any scale", async () => {
  const document = scaffoldDocument() as Record<string, unknown>;
  const { css } = await assemble({ themes: { light: document } });
  assert(css.includes("--color-primary"), "roles emit even without scales");
  assert(
    /background-color:\s*var\(--color-primary\)/.test(css),
    "components still ship",
  );
});

Deno.test("character tokens are optional, so requiring them narrows nothing", () => {
  const roles = requiredRolesFor();
  assert(
    !roles.some((role) => role.startsWith("button.")),
    "a component's character is a customisation, not a requirement",
  );
  assert(roles.includes("color.primary"), "the base roles are still required");
});

Deno.test("a theme's tokens and extensions come from one parse", () => {
  const parsed = parseDocument(theme);
  assert(parsed.ok, `the example parses: ${JSON.stringify(parsed)}`);
  const spin = parsed.extensions["spin"] as Record<string, unknown>;
  assertEquals(spin?.["id"], "spin-light");
  assertEquals(spin?.["modes"], ["light", "dark"]);
  const css = generateCss(parsed.tree);
  assert(css.includes("--color-primary"), "the tree emits its variables");
});
