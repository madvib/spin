import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  createGenerator,
  type ExtendedTokenInfo,
  type GenerateResult,
} from "@unocss/core";
import { readFileSync } from "node:fs";
import { spinPreset } from "../src/index.ts";
import { splitTopLevel } from "../src/rules/primitives/derive.ts";

const DEFAULT = new URL(
  "../../theme/src/languages/minimal.json",
  import.meta.url,
);
const theme = JSON.parse(readFileSync(DEFAULT, "utf8")) as Record<
  string,
  unknown
>;

type Options = Parameters<typeof spinPreset>[0];
type Result = GenerateResult<Map<string, ExtendedTokenInfo>>;

async function generate(
  markup: string,
  extra: Options = {},
): Promise<Result> {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: theme }, ...extra })],
  });
  return await uno.generate(markup, { extendedInfo: true });
}

/** The selectors a token's winning rule emitted, in order. */
function selectorsFor(result: Result, token: string): string[] {
  const info = result.matched.get(token);
  if (info === undefined) return [];
  return info.data
    .map((util) => util[1])
    .filter((selector): selector is string => typeof selector === "string");
}

const PROSE_TOKENS = ["h1", "p", "ul", "blockquote", "code"] as const;
const PROSE_MARKUP =
  "<h1>Title</h1><p>Body</p><ul><li>One</li></ul><blockquote>Quote</blockquote><code>chip</code>";

function hasTagSelector(selectors: readonly string[], tag: string): boolean {
  return selectors.some((selector) =>
    splitTopLevel(selector).some((part) => {
      const trimmed = part.trim();
      return (
        trimmed === tag ||
        trimmed.startsWith(`${tag}:`) ||
        trimmed.startsWith(`${tag}[`) ||
        trimmed.includes(`:is(${tag})`)
      );
    })
  );
}

function hasClassSelector(
  selectors: readonly string[],
  tag: string,
): boolean {
  return selectors.some((selector) =>
    splitTopLevel(selector).some((part) => part.includes(`.${tag}`)),
  );
}

test("prose selectors stay tags", async () => {
  const result = await generate(PROSE_MARKUP);
  for (const token of PROSE_TOKENS) {
    const selectors = selectorsFor(result, token);
    assert(
      selectors.length > 0,
      `${token} must emit its rules`,
    );
    assert(
      hasTagSelector(selectors, token),
      `${token} must claim its tag`,
    );
    assert(
      !hasClassSelector(selectors, token),
      `.${token} must never be emitted (no .h1 classes)`,
    );
  }
});

test("a custom element claims its tag", async () => {
  const markup = "<details><summary>More</summary></details>";
  const result = await generate(markup);
  const selectors = selectorsFor(result, "details");
  assert(
    hasTagSelector(selectors, "details"),
    "details must claim its tag",
  );
  assert(
    !hasClassSelector(selectors, "details"),
    "details must not claim a class",
  );
});

test("no .h1-style class selectors are emittable for prose", async () => {
  const result = await generate(
    `<h1 class="h1">T</h1><p class="p">B</p><ul class="ul"><li class="li">I</li></ul><blockquote class="blockquote">Q</blockquote><code class="code">C</code>`,
  );
  const css = [...result.css].join("\n");
  for (const tag of PROSE_TOKENS) {
    assert(
      !new RegExp(`\\.${tag}(?![a-zA-Z0-9_-])`).test(css),
      `.${tag} must not appear in the sheet`,
    );
  }
});

test("the column stays a tag", async () => {
  const result = await generate("<prose><p>Body</p></prose>");
  assert(
    hasTagSelector(selectorsFor(result, "prose"), "prose"),
    "prose must claim its tag",
  );
});

test("the column caps the measure and nothing else does", async () => {
  const result = await generate(
    "<prose><h2>Head</h2><p>Body</p><ul><li>One</li></ul><blockquote>Q</blockquote><pre><code>x</code></pre></prose>",
  );
  const css = result.css;
  // Exactly one 65ch in the sheet: the column rule. Any second hit is the
  // bare-p footgun returning and must be removed, not preserved.
  const hits = css.match(/max-width:\s*65ch/g) ?? [];
  assert.equal(hits.length, 1, `expected exactly one 65ch measure rule, found ${hits.length}`);
  assert(
    /prose\{[^}]*max-width:65ch/.test(css.replace(/\s+/g, "")),
    "the 65ch measure must live on the prose container rule",
  );
});

test("p inside flex/grid rows takes no measure", async () => {
  const result = await generate(
    `<div class="flex gap-2"><p>One</p><p>Two</p></div><div class="grid gap-2"><p>Three</p></div>`,
  );
  const css = result.css;
  // Assert the emitted declarations, not class presence: the p rule must
  // set no max-width, so a paragraph used as a flex/grid child renders at
  // container width instead of clamping to the reading measure.
  const blocks = [...css.matchAll(/(?:^|[}])\s*p\{([^}]*)\}/g)].map((m) => m[1] as string);
  assert(blocks.length > 0, "expected a p rule in the sheet");
  for (const block of blocks) {
    assert(
      !block.includes("max-width"),
      `p inside flex/grid must not take a measure: p{${block}}`,
    );
  }
});

test("primitives: false still ships base type", async () => {
  // Matches documentDefaults' unconditional posture: utility-only is a
  // component switch, not a type switch.
  const result = await generate(PROSE_MARKUP, { primitives: false });
  for (const token of PROSE_TOKENS) {
    const selectors = selectorsFor(result, token);
    assert(
      selectors.length > 0,
      `${token} must ship in a utility-only build (prose is base)`,
    );
    assert(
      hasTagSelector(selectors, token),
      `${token} must claim its tag in a utility-only build`,
    );
  }
});

test("unused prose elements still shake", async () => {
  const result = await generate("<p>Only this</p>");
  assert(
    selectorsFor(result, "p").length > 0,
    "p must ship for the document that names it",
  );
  assert(
    !result.matched.has("h1"),
    "h1 must emit nothing for a document that never names it",
  );
  assert(
    !result.matched.has("blockquote"),
    "blockquote must emit nothing for a document that never names it",
  );
});
