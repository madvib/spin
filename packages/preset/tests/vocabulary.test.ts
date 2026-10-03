import { assert, assertEquals } from "@std/assert";
import { createGenerator } from "@unocss/core";
import { parseTokens, treeToJson } from "@spin/theme";
import { scaffold, spinPreset } from "../src/index.ts";
import { GRID_DECLS, STATIC_DECLS } from "../src/utils/declarations.ts";
import {
  DISPLAY_UTILITIES,
  FLEX_DIRECTIONS,
  GRID_FLOW,
  GRID_SPANS,
  GRID_TRACKS,
  OPACITY_UTILITIES,
  OVERFLOW_UTILITIES,
  POSITION_UTILITIES,
  STATIC_UTILITIES,
} from "../src/utils/vocabulary.ts";

/**
 * The vocabulary and the assembly agree.
 *
 * These two modules are the static surface, split so the tables state *what
 * exists* and the assembly states *what it emits*. The risk that follows from
 * that split is drift: a name with no declaration, or a declaration for a name
 * nothing defines. Both are silent — they produce a utility that does not
 * work and no error anywhere.
 */

Deno.test("every table entry has a declaration", () => {
  // One entry from each kind of table, so a family that stops being assembled
  // fails here rather than at some consumer's build.
  const named = [
    ...DISPLAY_UTILITIES,
    ...OPACITY_UTILITIES,
    ...OVERFLOW_UTILITIES,
    ...GRID_TRACKS,
    ...GRID_SPANS,
    ...GRID_FLOW,
    ...Object.keys(FLEX_DIRECTIONS),
    ...Object.keys(POSITION_UTILITIES),
  ];
  for (const name of named) {
    assert(
      STATIC_DECLS[name] ?? GRID_DECLS[name],
      `"${name}" is listed as a utility but emits nothing`,
    );
  }
});

Deno.test("the utilities with no table behind them still emit", () => {
  // `STATIC_UTILITIES` is the one list that names utilities without a table:
  // `w-full` and `top-1/2` have no scale step to derive from. They exist as
  // written declarations, and this is the contract that they stay real.
  assert(STATIC_UTILITIES.length > 0, "the table is not empty");
  for (const name of STATIC_UTILITIES) {
    assert(
      STATIC_DECLS[name],
      `"${name}" is declared static but emits nothing`,
    );
  }
});

Deno.test("a declaration states at least one property", () => {
  for (
    const [name, decls] of [
      ...Object.entries(STATIC_DECLS),
      ...Object.entries(GRID_DECLS),
    ]
  ) {
    assert(Object.keys(decls).length > 0, `"${name}" declares no properties`);
  }
});

Deno.test("an opacity utility is its percentage divided by a hundred", () => {
  // The one table whose values are computed rather than written, which makes
  // it the one worth pinning.
  assertEquals(STATIC_DECLS["opacity-50"]?.opacity, "0.5");
  assertEquals(STATIC_DECLS["opacity-100"]?.opacity, "1");
});

Deno.test("grid tracks are fixed counts, spans mirror them", () => {
  assertEquals(STATIC_DECLS["grid-cols-none"] ?? GRID_DECLS["grid-cols-none"], {
    "grid-template-columns": "none",
  });
  assertEquals(GRID_DECLS["col-span-4"]?.["grid-column"], "span 4 / span 4");
  assertEquals(GRID_DECLS["col-span-full"]?.["grid-column"], "1 / -1");
});

Deno.test("the display table covers flex and grid", () => {
  for (const name of ["block", "inline", "flex", "hidden"]) {
    assert(STATIC_DECLS[name]?.display, `${name} emits no display`);
  }
});

/**
 * A theme with one step per scale the cases below spend, so a token-driven
 * rule has something to resolve against. The scaffold supplies the colours and
 * fonts; the scales are the ones the cases read.
 */
function themeDocument() {
  const parsed = parseTokens({
    spacing: {
      $type: "dimension",
      2: { $value: "0.5rem" },
      4: { $value: "1rem" },
    },
    radius: { $type: "dimension", lg: { $value: "0.5rem" } },
  });
  if (!parsed.ok) throw new Error(parsed.error);
  return JSON.parse(treeToJson([...scaffold(), ...parsed.tree]));
}

async function cssFor(classes: string): Promise<string> {
  const uno = await createGenerator({
    presets: [spinPreset({ theme: themeDocument() })],
  });
  const { css } = await uno.generate(classes);
  return css;
}

Deno.test("the utilities a component spends emit the declaration it needs", async () => {
  // One case per family a component reaches for, each mirroring a real
  // declaration in the primitives: a colour, a logical spacing edge, a radius,
  // a transform, and a capitalisation. The assertion is the behaviour — a
  // utility goes in, the declaration comes out — not a list of names.
  const cases: [string, string, string][] = [
    ["bg-surface-raised", "background-color", "var(--color-surface-raised)"],
    ["ps-4", "padding-inline-start", "var(--spacing-4)"],
    ["rounded-lg", "border-radius", "var(--radius-lg)"],
    ["translate-x-2", "transform", "translateX(var(--spacing-2))"],
    ["uppercase", "text-transform", "uppercase"],
  ];
  for (const [utility, property, value] of cases) {
    const css = await cssFor(utility);
    assert(
      css.includes(property),
      `${utility} emits no ${property} in: ${css}`,
    );
    assert(
      css.includes(value),
      `${utility} emits no ${value} in: ${css}`,
    );
  }
});
