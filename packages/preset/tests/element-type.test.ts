import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  createGenerator,
  type ExtendedTokenInfo,
  type GenerateResult,
} from "@unocss/core";
import { readFileSync } from "node:fs";
import { spinPreset } from "../src/index.ts";

/**
 * Every prose element reads its element type as a unit — the rule spends
 * the element's tuple, which defaults to its style. A theme re-points an
 * element by aliasing its element type to another style.
 *
 * The assertions are about WHICH token a rule spends, never about the
 * text of a value: the token's name is the contract, and a rule that
 * spends a different one is a rule that reads a decision the theme
 * never made.
 */

const DEFAULT = new URL(
  "../../theme/src/themes/minimal.json",
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

/** Every yield's declarations merged, the way the cascade merges them. */
function mergedBody(result: Result, token: string): Record<string, string> {
  const info = result.matched.get(token);
  assert(info !== undefined, `${token} must be matched by a rule`);
  const out: Record<string, string> = {};
  for (const entry of info.data) {
    Object.assign(out, declarations(entry[2]));
  }
  return out;
}

/**
 * The baseline theme with one style field restated.
 *
 * Written the way a theme writes it: a leaf with its own type, over
 * the style the element reads.
 */
function withStyleField(
  style: string,
  field: string,
  type: string,
  value: string,
): Record<string, unknown> {
  const doc = structuredClone(theme) as Record<string, unknown>;
  const font = doc["font"] as Record<string, unknown>;
  const styles = font["style"] as Record<string, unknown>;
  const entry = styles[style] as Record<string, unknown>;
  // Composite form nests fields inside one `$value`; group form nests a leaf
  // per field. Either way the value lands where the parser reads.
  const tuple = entry["$value"] as Record<string, unknown> | undefined;
  if (typeof tuple === "object" && tuple !== null) {
    tuple[field] = value;
  } else {
    entry[field] = { $type: type, $value: value };
  }
  return doc;
}

test("a style's size moves every element that reads it, and nothing else", async () => {
  // The style is the unit: restating display's size moves h1 (whose element
  // type defaults to display) and leaves h2 (title) exactly where it was.
  const doc = withStyleField("display", "size", "dimension", "4rem");
  const result = await generate("<h1>a</h1><h2>b</h2>", doc);
  deepStrictEqual(
    bodyFor(result, "h1")["font-size"],
    "var(--element-h1-type-size)",
  );
  deepStrictEqual(
    bodyFor(result, "h2")["font-size"],
    "var(--element-h2-type-size)",
  );
});

test("every element the map names reads its element type's tuple", async () => {
  // The whole default map, in one sweep: an element that reads atoms
  // instead of its element type is an emitter the cutover missed. `strong`
  // is the exception that proves the rule: an inline modifier, it reads
  // only the body-emphasized weight over whatever type style surrounds it.
  // The pairs are what the prose rules claim: each element reads its
  // element type's tuple, outright.
  const EXPECTED: Readonly<Record<string, string>> = {
    h1: "element-h1-type",
    h2: "element-h2-type",
    h3: "element-h3-type",
    h4: "element-h4-type",
    h5: "element-h5-type",
    h6: "element-h6-type",
    p: "element-p-type",
    blockquote: "element-blockquote-type",
    code: "element-code-type",
    small: "element-small-type",
    strong: "font-style-body-emphasized",
    figcaption: "element-figcaption-type",
    label: "element-label-type",
    legend: "element-legend-type",
    th: "element-th-type",
    caption: "element-caption-type",
    dt: "element-dt-type",
  };
  // The matched token carrying the element's type: the legend's type is
  // stated by the fieldset's rule, so it is read off the fieldset token.
  const MATCH: Readonly<Record<string, string>> = { legend: "fieldset" };
  // The type fields the element's rule states: most spread the whole tuple;
  // the term states only the weight, the legend size and weight, and the
  // header cell's weight is left to the cascade (a footer yield also states
  // one), so size and family carry the assertion there.
  const FIELDS: Readonly<Record<string, ReadonlyArray<readonly [string, string]>>> = {
    strong: [["font-weight", "weight"]],
    dt: [["font-weight", "weight"]],
    legend: [["font-size", "size"], ["font-weight", "weight"]],
    th: [["font-family", "family"], ["font-size", "size"]],
  };
  const WHOLE: ReadonlyArray<readonly [string, string]> = [
    ["font-family", "family"],
    ["font-size", "size"],
    ["font-weight", "weight"],
  ];
  for (const [element, token] of Object.entries(EXPECTED)) {
    const markup = element === "legend"
      ? `<fieldset><${element}>a</${element}></fieldset>`
      : element === "th" || element === "caption"
        ? `<table><${element}>a</${element}></table>`
        : `<${element}>a</${element}>`;
    const result = await generate(markup);
    // The header cell and the legend share their matched token with sibling
    // yields, so their declarations are merged the way the cascade merges
    // them; every other element's own type is its rule's first yield.
    const body = element === "th" || element === "legend"
      ? mergedBody(result, MATCH[element] ?? element)
      : bodyFor(result, element);
    for (const [property, field] of FIELDS[element] ?? WHOLE) {
      const spent = body[property] ?? "";
      assert(
        spent.includes(`--${token}-${field}`),
        `${element} does not read ${token}'s ${field}: ${property}: ${spent}`,
      );
    }
  }
});

test("mutating a style moves the element: the 99px probe", async () => {
  // The ownership proof: the element type defaults to the style, so an
  // absurd style value shows up in the element's rule through its type.
  const doc = withStyleField("body", "size", "dimension", "99px");
  const result = await generate("<p>a</p>", doc);
  deepStrictEqual(
    bodyFor(result, "p")["font-size"],
    "var(--element-p-type-size)",
  );
});

test("an element re-points by aliasing another style", async () => {
  // The indirection proof: re-pointing element.h1.type at the title style
  // keeps the h1 rule reading its element type while the variable resolves
  // to the title style's size.
  const doc = structuredClone(theme) as Record<string, unknown>;
  doc["element"] = {
    h1: { type: { $type: "typography", $value: "{font.style.title}" } },
  };
  const result = await generate("<h1>a</h1>", doc);
  deepStrictEqual(
    bodyFor(result, "h1")["font-size"],
    "var(--element-h1-type-size)",
  );
  const css = result.css;
  assert(
    css.includes("--element-h1-type-size:var(--font-style-title-size)") ||
      css.includes("--element-h1-type-size: var(--font-style-title-size)"),
    `element.h1.type must resolve to the title style, got: ${css.slice(0, 400)}`,
  );
});
