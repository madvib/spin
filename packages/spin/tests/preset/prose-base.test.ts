import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  createGenerator,
  type ExtendedTokenInfo,
  type GenerateResult,
} from "@unocss/core";
import { readFileSync } from "node:fs";
import { parseTokens } from "../../src/theme/index.ts";
import { spinPreset } from "../../src/compiler/index.ts";
import { splitTopLevel } from "../../src/compiler/rules/primitives/derive.ts";

const DEFAULT = new URL(
  "../../src/theme/themes/silk.json",
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
