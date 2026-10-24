import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { parseTokens, treeToJson } from "@spin/theme";
import { scaffold, spinPreset } from "../src/index.ts";
import { GRID_DECLS, STATIC_DECLS } from "../src/utils/declarations.ts";
import { wind4Layers } from "../src/wind4.ts";
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

test("every table entry has a declaration", () => {
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

test("the utilities with no table behind them still emit", () => {
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

test("a declaration states at least one property", () => {
  for (
    const [name, decls] of [
      ...Object.entries(STATIC_DECLS),
      ...Object.entries(GRID_DECLS),
    ]
  ) {
    assert(Object.keys(decls).length > 0, `"${name}" declares no properties`);
  }
});

test("an opacity utility is its percentage divided by a hundred", () => {
  // The one table whose values are computed rather than written, which makes
  // it the one worth pinning.
  deepStrictEqual(STATIC_DECLS["opacity-50"]?.opacity, "0.5");
  deepStrictEqual(STATIC_DECLS["opacity-100"]?.opacity, "1");
});

test("grid tracks are fixed counts, spans mirror them", () => {
  deepStrictEqual(STATIC_DECLS["grid-cols-none"] ?? GRID_DECLS["grid-cols-none"], {
    "grid-template-columns": "none",
  });
  deepStrictEqual(GRID_DECLS["col-span-4"]?.["grid-column"], "span 4 / span 4");
  deepStrictEqual(GRID_DECLS["col-span-full"]?.["grid-column"], "1 / -1");
});

test("the display table covers flex and grid", () => {
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

/**
 * The generator these cases are measured against: the preset with wind4
 * layered beneath it, which is how a real build is wired.
 */
async function cssFor(classes: string): Promise<string> {
  const layers = wind4Layers();
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { default: themeDocument() } })],
    rules: layers.rules as never,
    variants: layers.variants as never,
  });
  const { css } = await uno.generate(classes);
  return css;
}

/**
 * The declarations one utility's own rule carries, keyed by property.
 *
 * Read off the selector rather than searched for as text, so a declaration is
 * evidence about the utility that asked for it — `translate-x-2` setting
 * `transform` is a decision, whereas the characters `translate-x-2` appearing
 * somewhere in the sheet would not be.
 */
function declarationsFor(css: string, utility: string): Record<string, string> {
  const selector = new RegExp(`\\.${utility}(?![\\w-])`);
  const declarations: Record<string, string> = {};
  for (const [, selectorText, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selector.test(selectorText)) continue;
    for (const declaration of body.split(";")) {
      const at = declaration.indexOf(":");
      if (at < 0) continue;
      declarations[declaration.slice(0, at).trim()] = declaration
        .slice(at + 1)
        .trim();
    }
  }
  return declarations;
}

/** Whether a value defers to the browser by reading a custom property. */
function readsAToken(value: string): boolean {
  return /var\(\s*--/.test(value);
}

test("the utilities a component spends emit the declaration it needs", async () => {
  // One case per family a component reaches for, each mirroring a real
  // declaration in the primitives: a colour, a logical spacing edge, a radius,
  // a transform, and a capitalisation. The assertion is the DECISION — a
  // utility goes in, it sets this property, and a token-driven value defers
  // to the browser — not a list of emitted names.
  //
  // `transformed` marks the cases whose value must read a token. Naming WHICH
  // token would only break the suite when a token is renamed while the
  // behaviour under test is untouched.
  const cases: [utility: string, property: string, tokenDriven: boolean][] = [
    ["bg-surface-raised", "background-color", true],
    ["ps-4", "padding-inline-start", true],
    ["rounded-lg", "border-radius", true],
    ["translate-x-2", "transform", true],
    ["uppercase", "text-transform", false],
  ];
  for (const [utility, property, tokenDriven] of cases) {
    const css = await cssFor(utility);
    const value = declarationsFor(css, utility)[property];
    assert(
      value !== undefined,
      `${utility} matched but emits no ${property} in:\n${css}`,
    );
    if (!tokenDriven) continue;
    assert(
      readsAToken(value),
      `${utility} sets ${property} to the literal \`${value}\` instead of a token reference`,
    );
  }
});

test("a wind4-only family produces a rule", async () => {
  // The vocabulary tables above cover what spin spells for itself. This covers
  // the other half of what a build can spend: families nothing in spin names,
  // which only exist because wind4 is layered underneath. Each must reach a
  // rule — an unlayered generator emits nothing here, which is exactly the
  // state this asserts against.
  const wind4Only: [utility: string, property: string][] = [
    ["aspect-square", "aspect-ratio"],
    ["object-cover", "object-fit"],
    ["rotate-45", "rotate"],
    ["snap-x", "scroll-snap-type"],
    ["columns-2", "columns"],
    ["list-disc", "list-style-type"],
    ["caret-primary", "caret-color"],
    ["line-clamp-3", "-webkit-line-clamp"],
  ];
  for (const [utility, property] of wind4Only) {
    const css = await cssFor(utility);
    assert(
      declarationsFor(css, utility)[property] !== undefined,
      `${utility} emits no ${property}; the wind4 layer is not reaching this build:\n${css}`,
    );
  }
});

test("a utility we own resolves through our token", async () => {
  // Ours must win the families we claim, so `p-4` spends `spacing.4` from the
  // theme. The failure is silent: a wind4 spacing rule answers with a read of
  // `--spacing`, a bare base this theme never declares, so the declaration
  // parses and then computes to nothing — no padding, from a sheet that looks
  // entirely correct.
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { default: themeDocument() } })],
    rules: wind4Layers().rules as never,
    variants: wind4Layers().variants as never,
  });
  const { css } = await uno.generate("p-4 bg-surface-raised rounded-lg");
  for (
    const [utility, property] of [
      ["p-4", "padding"],
      ["bg-surface-raised", "background-color"],
      ["rounded-lg", "border-radius"],
    ] as [string, string][]
  ) {
    const value = declarationsFor(css, utility)[property];
    assert(value !== undefined, `${utility} sets no ${property}:\n${css}`);
    for (const [, read] of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
      assert(
        new RegExp(`${read}\\s*:`).test(css),
        `${utility} reads \`${read}\`, which this theme never declares, so the browser resolves ${property} to nothing:\n${css}`,
      );
    }
  }
});

test("no emitted declaration is a self-referential custom property", async () => {
  // The wind4 preflight bug, which must never return: a theme value is already
  // a reference, so re-emitting it writes `--spacing-2` as a read of itself.
  // That resolves to nothing at computed-value time — declared, correct-looking,
  // and worth nothing to every element that spends it.
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { default: themeDocument() } })],
    rules: wind4Layers().rules as never,
    variants: wind4Layers().variants as never,
  });
  const { css } = await uno.generate(
    "p-4 ps-4 bg-surface-raised rounded-lg translate-x-2 uppercase " +
      "m-4 px-4 gap-4 w-4 inset-4 text-lg border-primary",
  );
  deepStrictEqual(
    css.match(/(--[\w-]+):\s*var\(\s*\1\s*\)/g),
    null,
    `a custom property is declared as a read of itself; it resolves to nothing at computed-value time:\n${css}`,
  );
});
