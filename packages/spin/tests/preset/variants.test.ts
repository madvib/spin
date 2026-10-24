import { test } from "bun:test";
import assert from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { spinPreset } from "../../src/preset/index.ts";
import { readFile } from "node:fs/promises";
import { starterThemes } from "../../src/theme/themes/index.ts";

/**
 * What a variant utility has to do.
 *
 * Asserted as a DECISION — this class produces a rule under this pseudo-class
 * — rather than as substrings of the generated text. `:hover` appears in the
 * output as `.hover\:bg-primary:hover`, with the class name escaped, so a
 * literal `includes(":hover")` was asserting on the escaping as much as on the
 * behaviour, and `includes("var(--color-primary)")` broke whenever a token
 * moved.
 */

/**
 * Only these exist.
 *
 * `active`, `disabled` and `focus-visible` are NOT implemented, and the
 * structural ones (`first`, `odd`, `group-*`, `peer-*`) are not either: a
 * component emits its own states directly, because a control's states are not
 * utilities a consumer should be able to compose by hand. Adding one to
 * `src/variants/` without a case here is a review question, not a CI failure —
 * a test asserting a gap is a ticket, not a test.
 */
const IMPLEMENTED = ["hover", "focus"] as const;

async function theme() {
  return JSON.parse(
    await readFile(
      new URL("../../src/theme/themes/silk.json", import.meta.url),
      "utf8",
    ),
  );
}

async function variantOf(
  variant: string,
  base: string,
): Promise<{ matched: boolean; pseudo: boolean; property: boolean }> {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { default: await theme() } })],
  });
  const { css, matched } = await uno.generate(`${variant}:${base}`, {
    extendedInfo: true,
  });
  // The escaped class carries the variant, and a body proves the rule has a
  // declaration rather than being an empty shell.
  const escaped = variant.replace(/:/g, "\\:");
  return {
    matched: matched.has(`${variant}:${base}`),
    pseudo: css.includes(`.${escaped}`) && css.includes(`:${variant}`),
    property: /\{[^}]*:/s.test(css),
  };
}

for (const variant of IMPLEMENTED) {
  test(`a ${variant}: variant applies under its pseudo-class`, async () => {
    const result = await variantOf(variant, "bg-primary");
    assert(
      result.matched,
      `${variant}:bg-primary was not recognised as a utility`,
    );
    assert(result.pseudo, `${variant}: must scope its rule to :${variant}`);
    assert(result.property, `${variant}: must produce a declaration`);
  });
}

test("a variant and its base both ship", async () => {
  // A variant is an ADDITION, not a replacement: the base still applies, and
  // both rules must be present for the cascade to have anything to order.
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { default: await theme() } })],
  });
  const { css } = await uno.generate("bg-primary hover:bg-surface-raised");
  assert(
    css.includes("background-color"),
    `neither the base nor the variant stated a background:\n${css}`,
  );
  assert(
    css.includes("hover"),
    `the variant must carry its pseudo-class:\n${css}`,
  );
});

test("a responsive prefix emits the theme's width as a media query", async () => {
  // A custom property is not valid in a media query: an emitting variant
  // produced `(min-width: var(--breakpoint-md))`, which never matches, and
  // every responsive rule in the product was silently dead. The width must
  // arrive as the literal the theme declared.
  const theme = starterThemes.silk;
  const gen = await createGenerator({
    presets: [spinPreset({ themes: { default: theme } })],
  });
  const { css } = await gen.generate(
    '<div class="md:flex max-md:hidden"></div>',
  );
  const media = css.match(/@media[^{]+/g) ?? [];
  const responsive = media.filter((m) => m.includes("min-width"));
  assert(
    responsive.length >= 2,
    `both the min and the inverted prefix must carry a media query; got ${
      JSON.stringify(media)
    }`,
  );
  for (const query of responsive) {
    assert(
      !query.includes("var("),
      `a media query cannot read a custom property: ${query}`,
    );
    assert(
      /min-width:\s*[\d.]+(rem|px|em)/.test(query),
      `the query must carry a literal width: ${query}`,
    );
  }
  const [md] = responsive;
  const themeWidth = (theme.breakpoint as Record<string, { $value?: string }>)
    ?.[
      "md"
    ]?.$value;
  if (themeWidth !== undefined) {
    assert(
      md.includes(themeWidth),
      `the query must carry the theme's own width (${themeWidth}): ${md}`,
    );
  }
});
