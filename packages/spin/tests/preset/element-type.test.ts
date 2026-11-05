import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  createGenerator,
  type ExtendedTokenInfo,
  type GenerateResult,
} from "@unocss/core";
import { readFileSync } from "node:fs";
import { elementStyleDefault, elementStyleElements } from "../../src/theme/index.ts";
import { spinPreset } from "../../src/compiler/index.ts";

/**
 * Elements read named styles, spent.
 *
 * Every prose element reads its default style as a unit — the rule
 * spends the style's tuple, never atoms and never a per-element
 * override path. What the style does not state, the ladder states
 * during the migration window: a heading keeps the step its level
 * takes until the window closes and the fallback is deleted with it.
 *
 * The assertions are about WHICH token a rule spends, never about the
 * text of a value: the token's name is the contract, and a rule that
 * spends a different one is a rule that reads a decision the theme
 * never made.
 */

const DEFAULT = new URL(
  "../../src/theme/themes/silk.json",
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
  // The style is the unit: restating display's size moves h1 and leaves
  // h2 (title) exactly where it was.
  const doc = withStyleField("display", "size", "dimension", "4rem");
  const result = await generate("<h1>a</h1><h2>b</h2>", doc);
  deepStrictEqual(
    bodyFor(result, "h1")["font-size"],
    "var(--font-style-display-size)",
  );
  deepStrictEqual(
    bodyFor(result, "h2")["font-size"],
    "var(--font-style-title-size)",
  );
});

test("every element the map names reads its style's tuple", async () => {
  // The whole default map, in one sweep: an element that reads atoms
  // instead of its style is an emitter the cutover missed. `strong` is the
  // exception that proves the rule: an inline modifier, it reads only the
  // body-strong weight over whatever voice surrounds it.
  for (const element of elementStyleElements()) {
    const style = elementStyleDefault(element) as string;
    const result = await generate(`<${element}>a</${element}>`);
    const body = bodyFor(result, element);
    const fields: ReadonlyArray<readonly [string, string]> = element === "strong"
      ? [["font-weight", "weight"]]
      : [["font-family", "family"], ["font-size", "size"], ["font-weight", "weight"]];
    for (const [property, field] of fields) {
      const spent = body[property] ?? "";
      assert(
        spent.includes(`--font-style-${style}-${field}`),
        `${element} does not read ${style}'s ${field}: ${property}: ${spent}`,
      );
    }
  }
});

test("mutating a style moves the element: the 99px probe", async () => {
  // The ownership proof: the style is what the element reads, so an
  // absurd style value shows up in the element's rule.
  const doc = withStyleField("body", "size", "dimension", "99px");
  const result = await generate("<p>a</p>", doc);
  deepStrictEqual(
    bodyFor(result, "p")["font-size"],
    "var(--font-style-body-size)",
  );
});

test("a per-element decision is dead: font.element changes nothing", async () => {
  // The deleted path, pinned: a theme that still states font.element
  // gets the style anyway. The group is gone from the contract; this
  // test dies with the migration window.
  const doc = structuredClone(theme) as Record<string, unknown>;
  const font = doc["font"] as Record<string, unknown>;
  font["element"] = {
    h1: { size: { $type: "dimension", $value: "3rem" } },
  };
  const result = await generate("<h1>a</h1>", doc);
  deepStrictEqual(
    bodyFor(result, "h1")["font-size"],
    "var(--font-style-display-size)",
  );
});
