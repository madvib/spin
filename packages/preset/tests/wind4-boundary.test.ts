import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { spinPreset } from "../src/index.ts";
import { designLanguages } from "@spinjs/theme";

/**
 * The wind4 boundary: bare tags stay bare, utilities stay scoped.
 *
 * Two rule families share one generator, and the seam between them is a
 * variant prefix. A primitive rule claims its bare tag and nothing else — a
 * variant prefix in front of a tag is not a primitive, so `hover:button`
 * styles no button. A utility variant scopes its own class — `hover:` means
 * `:hover` on the class that carries it, `md:` means the theme's own width
 * in a media query — and never rewrites a tag selector.
 *
 * Asserted as EMISSION: what the sheet carries for each token. A bare tag
 * under a prefix emits nothing of its own; a utility under a prefix emits
 * its scoped rule; a token the vocabulary refuses (`from-primary`,
 * `fill-[#000]`, `dark:`) emits nothing at all.
 */

const theme = designLanguages.minimal;

async function sheetFor(markup: string): Promise<string> {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { default: theme } })],
  });
  const { css } = await uno.generate(markup, { preflights: false });
  return css;
}

/** Every selector the sheet carries, comments and at-rule heads aside. */
function selectorsOf(css: string): string[] {
  return [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((match) => match[1]!.trim())
    .filter((selector) => selector !== "" && !selector.startsWith("@"));
}

const TAGS = [
  "button",
  "input",
  "label",
  "card",
  "badge",
  "table",
  "hr",
  "dialog",
  "details",
] as const;

const PREFIXES = [
  "hover:",
  "focus:",
  "md:",
  "max-md:",
  "*:",
  "data-[open]:",
  "aria-[expanded]:",
] as const;

test("a variant prefix in front of a bare tag styles no element", async () => {
  // The primitive rules refuse variant handlers outright: a tag under a
  // prefix is a token no rule answers, so the sheet carries nothing for it —
  // no bare-tag rule leaked through, and no prefixed tag selector either.
  for (const tag of TAGS) {
    for (const prefix of PREFIXES) {
      const css = await sheetFor(`${prefix}${tag}`);
      deepStrictEqual(
        selectorsOf(css),
        [],
        `${prefix}${tag} styles something it must not`,
      );
    }
  }
});

test("JS syntax around a bare tag styles no element", async () => {
  // `!label` is TypeScript, not a utility: the `!important` variant is
  // excluded from the build for exactly this collision, and a leading `-`
  // is arithmetic, not a class. The sheet carries nothing for either.
  for (const token of ["!select", "select!", "-card", "label!"]) {
    const css = await sheetFor(token);
    deepStrictEqual(
      selectorsOf(css),
      [],
      `${token} styles something it must not`,
    );
  }
});

test("a bare tag without a prefix still claims its element", async () => {
  // The refusal above is about the PREFIX, not the tag: the same tags bare
  // each claim an element. Without this the boundary test would pass on a
  // generator that styles nothing at all.
  for (const tag of TAGS) {
    const css = await sheetFor(`<${tag}>`);
    assert(
      selectorsOf(css).length > 0,
      `<${tag}> claims no element`,
    );
  }
});

test("a utility variant scopes its own class", async () => {
  const hover = await sheetFor("hover:bg-primary");
  assert(
    hover.includes(".hover\\:bg-primary:hover"),
    `hover: must scope its rule to :hover:\n${hover}`,
  );
  assert(
    hover.includes("background-color:var(--color-primary)"),
    `hover:bg-primary must paint the primary:\n${hover}`,
  );
  const focus = await sheetFor("focus:border-strong");
  assert(
    focus.includes(".focus\\:border-strong:focus"),
    `focus: must scope its rule to :focus:\n${focus}`,
  );
  assert(
    focus.includes("border-color:var(--color-border-strong)"),
    `focus:border-strong must paint the strong edge:\n${focus}`,
  );
  const responsive = await sheetFor("md:flex");
  assert(
    responsive.includes(".md\\:flex"),
    `md: must carry its class:\n${responsive}`,
  );
  assert(
    /@media[^{]*min-width:\s*48rem/.test(responsive),
    `md: must carry the theme's own width as a literal:\n${responsive}`,
  );
});

test("a token the vocabulary refuses emits nothing", async () => {
  // `from-primary` reads variables nothing defines; `fill-[#000]` carries a
  // raw colour; `dark:` is a theme patch wearing a utility's clothes, in
  // every spelling wind4 offers. Each is refused, and the sheet is empty.
  for (
    const token of [
      "from-primary",
      "fill-[#000]",
      "dark:flex",
      ".dark:flex",
      "@dark:flex",
      "not-dark:flex",
    ]
  ) {
    const css = await sheetFor(token);
    deepStrictEqual(
      selectorsOf(css),
      [],
      `${token} emits a rule the vocabulary refuses`,
    );
  }
});
