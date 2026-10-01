import { assert, assertEquals, assertThrows } from "@std/assert";
import { isTokenType } from "./parse.ts";
import { contrastRatio, formatHex, isColor, parseColor } from "./color.ts";

const HEX = /^#[0-9a-f]{6}$/;
function channels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(hex);
  if (!match) {
    throw new Error(`expected a #rrggbb colour, got: ${hex}`);
  }
  return [
    parseInt(match[1], 16),
    parseInt(match[2], 16),
    parseInt(match[3], 16),
  ];
}
/**
 * Independent WCAG relative-luminance oracle, used to judge a scale without
 * trusting the implementation that produced it.
 */
function relativeLuminance(hex: string): number {
  const linear = channels(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
Deno.test("contrastRatio reports no contrast between a colour and itself", () => {
  for (const hex of ["#000000", "#ffffff", "#3a7bd5", "#808080"]) {
    assertEquals(contrastRatio(hex, hex), 1);
  }
});
Deno.test("contrastRatio reports the maximum ratio for black against white", () => {
  assertEquals(contrastRatio("#000000", "#ffffff"), 21);
});
Deno.test("contrastRatio is symmetric in its arguments", () => {
  assertEquals(
    contrastRatio("#3a7bd5", "#fedcba"),
    contrastRatio("#fedcba", "#3a7bd5"),
  );
});
Deno.test("contrastRatio grows as the two colours drift apart", () => {
  const greys = [
    "#ffffff",
    "#cccccc",
    "#999999",
    "#666666",
    "#333333",
    "#000000",
  ];

  for (let i = 1; i < greys.length; i++) {
    const previous = contrastRatio("#ffffff", greys[i - 1]);
    const current = contrastRatio("#ffffff", greys[i]);
    assert(
      current > previous,
      `${greys[i]} should contrast less with white than ${greys[i - 1]}`,
    );
  }
});
Deno.test("parseColor reads oklch black, white and mid grey exactly", () => {
  assertEquals(parseColor("oklch(0% 0 0)"), { r: 0, g: 0, b: 0, a: 1 });
  assertEquals(parseColor("oklch(100% 0 0)"), {
    r: 255,
    g: 255,
    b: 255,
    a: 1,
  });
  assertEquals(parseColor("oklch(0.5 0 0)"), { r: 99, g: 99, b: 99, a: 1 });
});
Deno.test("parseColor reads oklch red and keeps its alpha", () => {
  const red = parseColor("oklch(62.796% 0.25768 29.231)");
  assert(red.r >= 250, `red channel too low: ${red.r}`);
  assert(red.g <= 10, `green channel too high: ${red.g}`);
  assert(red.b <= 10, `blue channel too high: ${red.b}`);
  assertEquals(
    parseColor("oklch(50% 0 120deg)").g,
    parseColor("oklch(50% 0 120)").g,
  );
  assertEquals(parseColor("oklch(50% 0 0 / 50%)").a, 0.5);
});
Deno.test("parseColor reads oklab and display-p3 primaries", () => {
  assertEquals(parseColor("oklab(0 0 0)"), { r: 0, g: 0, b: 0, a: 1 });
  assertEquals(parseColor("oklab(1 0 0)"), { r: 255, g: 255, b: 255, a: 1 });
  assertEquals(parseColor("color(display-p3 1 0 0)"), {
    r: 255,
    g: 0,
    b: 0,
    a: 1,
  });
  assertEquals(parseColor("color(display-p3 1 1 1)"), {
    r: 255,
    g: 255,
    b: 255,
    a: 1,
  });
});
Deno.test("parseColor rejects malformed modern color syntax", () => {
  assertThrows(() => parseColor("oklch(50%)"), SyntaxError);
  assertThrows(() => parseColor("oklch(50% 0 0.5turn)"), SyntaxError);
  assertThrows(() => parseColor("oklab(1 0)"), SyntaxError);
  assertThrows(() => parseColor("color(display-p3 1 0)"), SyntaxError);
});
Deno.test("contrastRatio works on ported oklch theme values", () => {
  const ratio = contrastRatio("oklch(13% 0.008 220)", "#f8fafc");
  assert(ratio > 10, `console text unreadable: ${ratio}`);
});

Deno.test("isColor answers without throwing on anything", () => {
  // The validator calls this on every `color` token, including values a theme
  // author typed by hand, so "does it throw" is part of its contract.
  assert(isColor("#abc"));
  assert(isColor("#aabbcc"));
  assert(isColor("oklch(0.6 0.2 30)"));
  assert(isColor("rgb(1 2 3)"));
  assert(!isColor("#gggggg"));
  assert(!isColor("chocolate"), "a named colour is not a hex literal");
  assert(!isColor(""), "empty is not a colour");
  assert(!isColor(undefined), "and neither is nothing");
});

Deno.test("isTokenType narrows the closed vocabulary", () => {
  assert(isTokenType("color"));
  assert(isTokenType("textTransform"));
  assert(
    !isTokenType("string"),
    "the vocabulary does not accept arbitrary text",
  );
  assert(!isTokenType("Color"), "and it is case-sensitive");
  assert(!isTokenType(undefined));
});
