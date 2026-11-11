import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { readFileSync } from "node:fs";
import {
  generateCss,
  parseDocument,
  requiredPaths,
} from "@spinjs/theme";
import { spinPreset } from "../src/index.ts";

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
  "../../theme/src/languages/minimal.json",
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

test("a complete theme assembles a working document", async () => {
  // Asserts what the document DOES, not what the generated text looks like.
  // Every rule here once read `var(--…)` out of the emitted CSS, which means
  // a rename anywhere in the theme pipeline broke the suite for no reason —
  // and a rule that emitted nothing could pass by never being checked.
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: theme } })],
  });
  const { css, matched } = await uno.generate(
    "bg-primary p-4 md:flex gap-gutter animate-spin hover:bg-primary",
    { extendedInfo: true },
  );

  // The utilities the markup asked for were matched, so rules engaged.
  for (const token of ["bg-primary", "p-4", "gap-gutter"]) {
    assert(
      matched.has(token),
      `${token} is in the document but no rule claimed it`,
    );
  }
  // Keyframes ship with the utility that names them. A keyframe in a
  // shakeable file is a keyframe that can ship without its definition.
  assert(
    css.includes("@keyframes") && css.includes("animation: spin"),
    "an animated utility must ship with its keyframes",
  );
  // The motion floor is a policy, not a component: it ships whenever anything
  // animates, so no page can opt out of respecting it.
  assert(
    css.includes("prefers-reduced-motion"),
    "the motion floor must ship alongside animated rules",
  );
});

test("the primitives ship because the theme enables them", async () => {
  // The markup has to name a button. Rules emit only for the tokens a document
  // uses, so a page with no `<button>` correctly ships no button CSS — and an
  // assertion that finds the button's selector in such a page is reading a
  // preflight's incidental text rather than the primitive.
  const markup = "<button>Go</button>";
  const page = async (options: Parameters<typeof spinPreset>[0]) => {
    const uno = await createGenerator({ presets: [spinPreset(options)] });
    return await uno.generate(markup);
  };

  const { css } = await page({ themes: { light: theme } });
  assert(
    /background-color:\s*var\(--color-primary\)/.test(css),
    "the button spends the primary fill",
  );
  assert(css.includes('[role="button"]'), "the button claims its role");

  const without = await page({
    themes: { light: theme },
    primitives: false,
  });
  assert(
    !without.css.includes('[role="button"]'),
    "a utility-only build must not ship components",
  );
});

test("fonts declared by the theme reach the document", async () => {
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

test("an incomplete composed doc refuses through the real build path, naming the missing token", async () => {
  // The refusal is proved by running, not by pinning: the brand below names
  // no `color.text`, composition carries that debt into the build, and the
  // build's own judgement — the lint surface, not the factory's old check —
  // names the leaf it owes.
  const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { loadProjectBrand } = await import(
    "@spinjs/server/project"
  );
  const dir = await mkdtemp(join(tmpdir(), "spin-compose-"));
  const brand = join(dir, "spin", "thin");
  await mkdir(join(brand, "primitives"), { recursive: true });
  await writeFile(
    join(brand, "tokens.json"),
    JSON.stringify({ $extends: "minimal" }),
  );
  await writeFile(
    join(brand, "elements.json"),
    JSON.stringify({
      element: { h1: { type: { $type: "typography", $value: "{font.style.title}" } } },
    }),
  );
  const facets = await loadProjectBrand(dir);
  const composed = facets.themes["thin"];
  assert(composed !== undefined, "the brand composes to a document");
  const { expandExtends, parseTokens, treeToJson } = await import("@spinjs/theme");
  const expanded = expandExtends(composed);
  delete (expanded["color"] as Record<string, unknown>)["text"];
  const parsed = parseTokens(expanded);
  assert(parsed.ok, `the variant parses: ${!parsed.ok ? parsed.error : ""}`);
  if (!parsed.ok) return;
  const incomplete = JSON.parse(treeToJson(parsed.tree));
  let refused = false;
  try {
    spinPreset({ themes: { thin: incomplete } });
  } catch (error) {
    refused = true;
    assert(
      (error as Error).message.includes("color.text"),
      `the error names what is missing: ${(error as Error).message}`,
    );
  }
  assert(refused, "an incomplete theme must be refused");
});

test("component tokens are optional, so requiring them narrows nothing", () => {
  const roles = requiredPaths();
  assert(
    !roles.some((role) => role.startsWith("button.")),
    "a component's own tokens are a customisation, not a requirement",
  );
  assert(roles.includes("color.primary"), "the base roles are still required");
});

test("a theme's tokens and extensions come from one parse", () => {
  const parsed = parseDocument(theme);
  assert(parsed.ok, `the example parses: ${JSON.stringify(parsed)}`);
  const spin = parsed.extensions["spin"] as Record<string, unknown>;
  // The extension the system reads is the fonts: the faces a theme declares
  // are the faces the sheet loads.
  const fonts = spin?.["fonts"] as { family?: string }[] | undefined;
  deepStrictEqual(fonts?.[0]?.family, "Inter");
  const css = generateCss(parsed.tree);
  assert(css.includes("--color-primary"), "the tree emits its variables");
});
