import { assert, assertEquals } from "@std/assert";
import {
  createGenerator,
  type ExtendedTokenInfo,
  type GenerateResult,
} from "@unocss/core";
import { readFileSync } from "node:fs";
import { elementTypeElements, elementTypeFields } from "@spin/theme";
import { spinPreset } from "../src/index.ts";

/**
 * The per-element typography, spent.
 *
 * A theme may say what ONE element reads — its face, its size, its weight —
 * and the rules that paint that element read the theme's answer. What the
 * theme does not say, the ladder says: a heading keeps the step its level
 * takes, the display face keeps the heading family, and the body keeps the
 * sans.
 *
 * The assertions are about WHICH token a rule spends, never about the text
 * of a value: the token's name is the contract, and a rule that spends a
 * different one is a rule that reads a decision the theme never made.
 */

const DEFAULT = new URL(
  "../../theme/src/themes/silk.json",
  import.meta.url,
);
const theme = JSON.parse(readFileSync(DEFAULT, "utf8")) as Record<
  string,
  unknown
>;

type Result = GenerateResult<Map<string, ExtendedTokenInfo>>;

/** Generate a document against one theme. */
async function generate(
  markup: string,
  doc: Record<string, unknown> = theme,
): Promise<Result> {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: doc } })],
  });
  return await uno.generate(markup, { extendedInfo: true });
}

/** A body's declarations as a property -> value table. */
function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of body.split(";")) {
    const text = entry.trim();
    if (text.length === 0) continue;
    const colon = text.indexOf(":");
    if (colon < 0) continue;
    out[text.slice(0, colon).trim()] = text.slice(colon + 1).trim();
  }
  return out;
}

/**
 * The declarations the element's OWN rule emitted.
 *
 * The first yield, not the whole rule: a quotation's rule also styles the
 * footer inside it, and a caption's rule also centres it inside a column.
 * Those are the furniture, and the element's own type is the first yield.
 */
function bodyFor(result: Result, token: string): Record<string, string> {
  const info = result.matched.get(token);
  assert(info !== undefined, `${token} must be matched by a rule`);
  const first = info.data[0];
  assert(first !== undefined, `${token} must emit a declaration`);
  return declarations(first[2]);
}

/**
 * The baseline theme with one per-element decision added.
 *
 * The decision is written the way a theme writes it: a leaf with its own
 * type, under a group the document does not have yet.
 */
function withDecision(
  path: string,
  type: string,
  value: string,
): Record<string, unknown> {
  const doc = structuredClone(theme) as Record<string, unknown>;
  const segments = path.split(".");
  let node = doc;
  for (const segment of segments.slice(0, -1)) {
    const next = (node[segment] ?? {}) as Record<string, unknown>;
    node[segment] = next;
    node = next;
  }
  node[segments[segments.length - 1] as string] = {
    $type: type,
    $value: value,
  };
  return doc;
}

/** The baseline theme with some tokens removed. */
function without(...paths: string[]): Record<string, unknown> {
  const doc = structuredClone(theme) as Record<string, unknown>;
  for (const path of paths) {
    const segments = path.split(".");
    let node = doc;
    for (const segment of segments.slice(0, -1)) {
      node = (node[segment] ?? {}) as Record<string, unknown>;
    }
    delete node[segments[segments.length - 1] as string];
  }
  return doc;
}

Deno.test("a theme that states a heading's size moves that heading alone", async () => {
  // The decision is per element, so the levels are independent: the first
  // heading moves and the second keeps the step its level takes.
  const doc = withDecision("font.element.h1.size", "dimension", "3rem");
  const result = await generate("<h1>a</h1><h2>b</h2>", doc);
  assertEquals(
    bodyFor(result, "h1")["font-size"],
    "var(--font-element-h1-size)",
  );
  assertEquals(
    bodyFor(result, "h2")["font-size"],
    "var(--font-size-2xl)",
  );
});

Deno.test("a heading that the theme says nothing about keeps the ladder's step", async () => {
  // The fallback IS the ladder: a theme that omits the decision gets the
  // system's answer, which is the step the level takes.
  const result = await generate("<h1>a</h1><h6>b</h6>");
  assertEquals(
    bodyFor(result, "h1")["font-size"],
    "var(--font-size-3xl)",
  );
  assertEquals(
    bodyFor(result, "h6")["font-size"],
    "var(--font-size-sm)",
  );
});

Deno.test("a theme that states a weight moves the weight, not the size", async () => {
  // The three decisions are independent: stating one leaves the others
  // exactly where the ladder put them.
  const doc = withDecision("font.element.h2.weight", "fontWeight", "500");
  const result = await generate("<h2>a</h2>", doc);
  assertEquals(
    bodyFor(result, "h2")["font-weight"],
    "var(--font-element-h2-weight)",
  );
  assertEquals(
    bodyFor(result, "h2")["font-size"],
    "var(--font-size-2xl)",
  );
});

Deno.test("a theme that states a face gives the element that face", async () => {
  // The face is a decision like any other: a quotation the theme sets in the
  // body's face reads in the body's face, and the editorial face is the
  // answer only while the theme has not given another.
  const doc = withDecision(
    "font.element.blockquote.family",
    "fontFamily",
    "Inter, sans-serif",
  );
  const result = await generate("<blockquote>a</blockquote>", doc);
  assertEquals(
    bodyFor(result, "blockquote")["font-family"],
    "var(--font-element-blockquote-family)",
  );
});

Deno.test("a quotation the theme says nothing about reads the editorial face", async () => {
  const result = await generate("<blockquote>a</blockquote>");
  assertEquals(
    bodyFor(result, "blockquote")["font-family"],
    "var(--font-family-serif)",
  );
});

Deno.test("a display face that the theme does not name falls back to the body", async () => {
  // The chain: the display face falls back to the heading family, and the
  // heading family to the body. A theme that names no display voice still
  // has a face for its headings.
  const doc = without("font.family.heading");
  const result = await generate("<h1>a</h1>", doc);
  assertEquals(
    bodyFor(result, "h1")["font-family"],
    "var(--font-family-body)",
  );
});

Deno.test("a body face that the theme does not name falls back to the sans", async () => {
  // The last step of the chain: with no display face and no body face, the
  // heading still reads in the sans every theme declares.
  const doc = without("font.family.heading", "font.family.body");
  const result = await generate("<h1>a</h1>", doc);
  assertEquals(
    bodyFor(result, "h1")["font-family"],
    "var(--font-family-sans)",
  );
});

Deno.test("every element the contract names reads its own decision", async () => {
  // The whole list, in one sweep: an element the contract declares but no
  // rule spends is a decision the theme can make that changes nothing.
  for (const element of elementTypeElements()) {
    const fields = elementTypeFields(element);
    const doc = withDecision(
      fields.size?.path as string,
      "dimension",
      "2rem",
    );
    const result = await generate(`<${element}>a</${element}>`, doc);
    assertEquals(
      bodyFor(result, element)["font-size"],
      `var(--font-element-${element}-size)`,
      `${element} does not read its own size`,
    );
  }
});

Deno.test("every element the contract names reads its own face and weight", async () => {
  // The other two decisions, over the same list.
  for (const element of elementTypeElements()) {
    const withFace = withDecision(
      `font.element.${element}.family`,
      "fontFamily",
      "Inter, sans-serif",
    );
    const faced = await generate(`<${element}>a</${element}>`, withFace);
    assertEquals(
      bodyFor(faced, element)["font-family"],
      `var(--font-element-${element}-family)`,
      `${element} does not read its own face`,
    );

    const withWeight = withDecision(
      `font.element.${element}.weight`,
      "fontWeight",
      "500",
    );
    const weighted = await generate(`<${element}>a</${element}>`, withWeight);
    assertEquals(
      bodyFor(weighted, element)["font-weight"],
      `var(--font-element-${element}-weight)`,
      `${element} does not read its own weight`,
    );
  }
});

Deno.test("a theme that states no per-element decision is a complete theme", async () => {
  // The group is optional: the rules fall back to the ladder, and a theme
  // that never mentions the group still renders.
  const parsed = await generate("<h1>a</h1><p>b</p><code>c</code>");
  assertEquals(
    bodyFor(parsed, "h1")["font-size"],
    "var(--font-size-3xl)",
  );
});
