import { assert, assertEquals } from "@std/assert";
import { createGenerator, escapeRegExp, toEscapedSelector } from "@unocss/core";
import { parseTokens, treeToJson } from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import { scaffold, spinPreset } from "../src/index.ts";
import type { ThemeDocument } from "../src/index.ts";
import { carriesRawColor, hasRawColor } from "../src/utils/color.ts";

/**
 * The working theme: the scaffold plus a few scales, so the rules that
 * resolve a name have something to resolve.
 */
function workingDocument(): ThemeDocument {
  const tree: TokenTree = scaffold();
  const parsed = parseTokens({
    color: {
      $type: "color",
      primary: { $value: "#3355ff" },
      neutral: { 300: { $value: "#a1a1aa" } },
    },
    spacing: { $type: "dimension", 4: { $value: "1rem" } },
    font: { size: { $type: "dimension", lg: { $value: "1.25rem" } } },
    radius: { $type: "dimension", md: { $value: "0.5rem" } },
    shadow: { $type: "shadow", md: { $value: "0 1px 2px black" } },
    breakpoint: { $type: "dimension", md: { $value: "48rem" } },
  });
  if (!parsed.ok) throw new Error(`fixture: ${parsed.error}`);
  return JSON.parse(treeToJson([...tree, ...parsed.tree])) as ThemeDocument;
}

/**
 * The generator a real build uses: the spin preset, with wind4 layered
 * beneath it. The layer matters — it is where the colour rules of the
 * ecosystem live, and a guard that stopped at our own rules would let a raw
 * colour through the layer underneath.
 */
async function generator() {
  return await createGenerator({
    presets: [spinPreset({ themes: { default: workingDocument() } })],
  });
}

/**
 * The colours a class may carry, in every notation CSS defines.
 *
 * The list is CSS's, not ours: a hex, a colour function, a named colour, and
 * the two CSS-wide keywords. Each one is a design decision the theme never
 * made, so each one must be refused.
 */
const RAW_COLORS: readonly string[] = [
  "[#fff]",
  "[#ffffff]",
  "[#ffffffff]",
  "[rgb(0,0,0)]",
  "[rgba(0,0,0,0.5)]",
  "[hsl(120,50%,50%)]",
  "[hsla(120,50%,50%,0.5)]",
  "[hwb(120,0%,0%)]",
  "[lab(50%_20_-30)]",
  "[lch(50%_20_30)]",
  "[oklab(0.5_0.1_0)]",
  "[oklch(0.5_0.1_20)]",
  "[color(display-p3_1_0_0)]",
  "[color-mix(in_oklab,_red,_blue)]",
  "[red]",
  "[rebeccapurple]",
  "[transparent]",
  "[currentColor]",
];

/**
 * The families that paint a colour.
 *
 * The first block is ours — the colour rules of the preset. The second is
 * wind4's, which the preset layers beneath its own: `fill`, `stroke`, the
 * rings, the shadows and the two ink positions. A guard that only covered
 * our own rules would leave the layer underneath wide open.
 */
const COLOR_FAMILIES: readonly string[] = [
  "bg",
  "text",
  "border",
  "divide",
  "accent",
  "fill",
  "stroke",
  "ring",
  "ring-offset",
  "inset-ring",
  "decoration",
  "placeholder",
  "caret",
  "c",
  "color",
  "mask",
  "drop-shadow",
  "drop-shadow-color",
  "text-shadow",
  "text-shadow-color",
  "text-stroke",
  "outline",
];

/**
 * The classes that carry a raw colour, one per family and notation.
 */
function rawColorClasses(): string[] {
  return COLOR_FAMILIES.flatMap((family) =>
    RAW_COLORS.map((colour) => `${family}-${colour}`)
  );
}

/**
 * The sheet a class produces on its own.
 *
 * `preflights: false` because the theme layer's own rules would ride along
 * in every result and make an empty sheet impossible to read.
 */
async function sheetFor(cls: string): Promise<string> {
  const uno = await generator();
  const { css } = await uno.generate(cls, { preflights: false });
  return css;
}

/**
 * The declarations a utility's own rule carries, keyed by property.
 *
 * Read off the selector rather than searched for as text, because a
 * declaration is a decision ABOUT one utility.
 */
function declarationsFor(
  css: string,
  utility: string,
): Record<string, string> {
  // The selector uno emits is asked for rather than spelled out here: a
  // class name may not carry a bracket bare, so the sheet's spelling of
  // `w-[13px]` is `.w-\[13px\]`.
  const selector = new RegExp(
    `${escapeRegExp(toEscapedSelector(utility))}(?![\\w-])`,
  );
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

/**
 * The value a utility set for one property, or `undefined` if it set none.
 */
function valueFor(
  css: string,
  utility: string,
  property: string,
): string | undefined {
  return declarationsFor(css, utility)[property];
}

/**
 * A raw colour is a design decision, and a design decision is a token.
 *
 * So a class carrying one produces NO CSS AT ALL: it is dead on arrival
 * rather than broken, and the ordinary vocabulary rule catches it the way it
 * catches a typo. What the sheet must NOT carry is the colour itself.
 */
Deno.test("an arbitrary colour produces no rule at all", async () => {
  const uno = await generator();
  const alive: string[] = [];
  for (const cls of rawColorClasses()) {
    const { css } = await uno.generate(cls, { preflights: false });
    if (css.trim() !== "") alive.push(cls);
  }
  assertEquals(
    alive,
    [],
    `these classes carry a colour written by hand and still produce a rule: ${
      alive.join(", ")
    }`,
  );
});

/**
 * The refusal is on the COLOUR, not on the arbitrary value.
 *
 * A size and a position are numbers the caller supplies, and the theme has
 * no opinion about them — which is exactly why they are allowed to be
 * written by hand. Each one still lands in the sheet.
 */
Deno.test("an arbitrary size still produces a rule", async () => {
  assertEquals(
    valueFor(await sheetFor("w-[13px]"), "w-[13px]", "width"),
    "13px",
  );
  assertEquals(
    valueFor(await sheetFor("top-[3px]"), "top-[3px]", "top"),
    "3px",
  );
  assertEquals(
    valueFor(await sheetFor("text-[15px]"), "text-[15px]", "font-size"),
    "15px",
  );
  assertEquals(
    valueFor(
      await sheetFor("w-[calc(100%-1rem)]"),
      "w-[calc(100%-1rem)]",
      "width",
    ),
    "calc(100%-1rem)",
  );
});

/**
 * The theme's palette is where colours live.
 *
 * A token colour still paints, and it paints by READING the token: the
 * value in the sheet is a reference, so the theme can change it. This is
 * the difference the refusal protects — the token follows the theme, and
 * the raw colour never did.
 */
Deno.test("a token colour still paints, and reads the token", async () => {
  const bg = await sheetFor("bg-primary");
  assertEquals(
    valueFor(bg, "bg-primary", "background-color"),
    "var(--color-primary)",
  );
  const text = await sheetFor("text-neutral-300");
  assertEquals(
    valueFor(text, "text-neutral-300", "color"),
    "var(--color-neutral-300)",
  );
  const border = await sheetFor("border-primary");
  assertEquals(
    valueFor(border, "border-primary", "border-color"),
    "var(--color-primary)",
  );
  const fill = await sheetFor("fill-primary");
  assert(
    (valueFor(fill, "fill-primary", "fill") ?? "").includes(
      "var(--color-primary)",
    ),
  );
  const stroke = await sheetFor("stroke-primary");
  assert(
    (valueFor(stroke, "stroke-primary", "stroke") ?? "").includes(
      "var(--color-primary)",
    ),
  );
});

/**
 * The CSS-wide keywords are VOCABULARY, and the plain spelling of them
 * keeps working.
 *
 * `transparent` and `currentColor` are values a stylesheet may legitimately
 * name — a component that must be see-through cannot express that any other
 * way — so `bg-transparent` says exactly what it means. The bracketed
 * spelling is an arbitrary value, and an arbitrary value is a number.
 */
Deno.test("the sanctioned colour keywords still paint", async () => {
  assertEquals(
    valueFor(
      await sheetFor("bg-transparent"),
      "bg-transparent",
      "background-color",
    ),
    "transparent",
  );
  assertEquals(
    valueFor(await sheetFor("text-currentColor"), "text-currentColor", "color"),
    "currentColor",
  );
});

/**
 * The wind4 layer is where a raw colour could still reach the sheet.
 *
 * Its colour rules take an arbitrary value and write it into the sheet as
 * it stands, so the guard has to reach the layer beneath ours. The
 * utilities wind4 owns that are NOT colours still work — a ring's width, a
 * stroke's width, the `current` keyword — because the guard refuses a
 * COLOUR and nothing else.
 */
Deno.test("the wind4 layer refuses a raw colour and keeps the rest", async () => {
  const uno = await generator();
  for (
    const cls of [
      "fill-[#000]",
      "stroke-[#000]",
      "ring-[#fff]",
      "ring-offset-[#fff]",
      "inset-ring-[#fff]",
      "decoration-[#fff]",
      "placeholder-[#fff]",
      "caret-[#fff]",
      "c-[#fff]",
      "color-[#fff]",
      "drop-shadow-[#fff]",
      "text-shadow-[#fff]",
      "text-stroke-[#fff]",
    ]
  ) {
    const { css } = await uno.generate(cls, { preflights: false });
    assertEquals(
      css.trim(),
      "",
      `${cls} carries a raw colour and still paints`,
    );
  }
  assertEquals(
    valueFor(await sheetFor("fill-current"), "fill-current", "fill"),
    "currentColor",
  );
  assertEquals(
    valueFor(await sheetFor("stroke-2"), "stroke-2", "stroke-width"),
    "2px",
  );
  assert(
    (await sheetFor("ring-2")).includes("--un-ring-shadow"),
    "ring-2 must still draw a ring",
  );
});

/**
 * The detector the rules share.
 *
 * A colour is a colour in every notation CSS defines, and it is a colour
 * wherever it appears in a value — a shadow whose colour is written by hand
 * carries one just as surely as the colour does.
 */
Deno.test("a value that carries a colour is a colour", () => {
  for (const value of RAW_COLORS.map((colour) => colour.slice(1, -1))) {
    assert(
      carriesRawColor(value),
      `${value} is a colour and must be refused`,
    );
  }
  assert(
    carriesRawColor("0 0 10px red"),
    "a shadow whose colour is written by hand carries a colour",
  );
  assert(
    carriesRawColor("color-mix(in oklab, red, blue)"),
    "a mixed colour is a colour",
  );
});

/**
 * A value that carries NO colour is not one.
 *
 * The other side of the same question, and the one that keeps the refusal
 * from eating the numbers: a length, a percentage, a time, an expression
 * of those, and a quoted string that happens to spell a colour.
 */
Deno.test("a value that carries no colour is left alone", () => {
  for (
    const value of [
      "13px",
      "50%",
      "1.25rem",
      "250ms",
      "calc(100% - 1rem)",
      "min(100%, 30rem)",
      "clamp(1rem, 2vw, 3rem)",
      "1/2",
      "0",
      "-.5vh",
      "translateX(10px)",
      "'red'",
      '"oklch(0.5 0.1 20)"',
      "red-500",
      "primary",
    ]
  ) {
    assert(
      !carriesRawColor(value),
      `${value} carries no colour and must be left alone`,
    );
  }
});

/**
 * The class-level reading of the same question.
 *
 * A bracket is where an arbitrary value lives, so the bracket is where the
 * colour has to be looked for.
 */
Deno.test("a class carries a colour only inside its brackets", () => {
  assert(hasRawColor("fill-[#000]"));
  assert(hasRawColor("ring-[rgb(0,0,0)]"));
  assert(hasRawColor("bg-[oklch(0.5_0.1_20)]"));
  assert(!hasRawColor("w-[13px]"));
  assert(!hasRawColor("bg-primary"));
  assert(!hasRawColor("text-currentColor"));
});
