import type { Rule } from "@unocss/core";
import {
  FRACTIONS,
  HEIGHT_KEYWORDS,
  WIDTH_KEYWORDS,
} from "../utils/vocabulary.ts";
import { arbitraryValue } from "../utils/factories.ts";
import { extendedTheme, type ThemeContext, themeOf } from "../utils/lookup.ts";

/**
 * The sizing names that do not depend on the theme.
 *
 * `w-<spacing>` and `h-<spacing>` come from the theme's scale, so they are not
 * here. The fractions and content keywords are the rule's own vocabulary, and
 * `min-w-screen` / `max-w-screen` are absent by the rule's design: a width
 * that moves with the viewport is a measure, not a minimum.
 */
export const SIZING_NAMES: readonly string[] = [
  ...Object.keys(FRACTIONS).map((fraction) => `w-${fraction}`),
  ...Object.keys(WIDTH_KEYWORDS).map((keyword) => `w-${keyword}`),
  ...Object.keys(FRACTIONS).map((fraction) => `h-${fraction}`),
  ...Object.keys(HEIGHT_KEYWORDS).map((keyword) => `h-${keyword}`),
  ...["min", "max"].flatMap((edge) =>
    Object.keys(WIDTH_KEYWORDS)
      .filter((keyword) => keyword !== "screen")
      .map((keyword) => `${edge}-w-${keyword}`)
  ),
  ...["min", "max"].flatMap((edge) =>
    Object.keys(HEIGHT_KEYWORDS).map((keyword) => `${edge}-h-${keyword}`)
  ),
  ...["min", "max"].flatMap((edge) =>
    ["w", "h"].map((axis) => `${edge}-${axis}-0`)
  ),
];
export function sizingRules(): Rule[] {
  return [
    [
      /^w-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        // The ONE place a hardcoded literal is correct. Every other width here
        // is a theme token — the spacing scale, a fraction, a content keyword
        // — and one the theme does not carry means the rule omits itself. An
        // arbitrary value is the CALLER supplying the number: the theme has no
        // opinion about 13rem, so `w-[13rem]` is not a themed value and must
        // not pretend to be one. Emitted as written, or not at all.
        const literal = arbitraryValue(name);
        if (literal !== undefined) return { width: literal };
        const token = themeOf(ctx)?.spacing[name];
        if (token) return { width: token };
        const fraction = FRACTIONS[name];
        if (fraction) return { width: fraction };
        const keyword = WIDTH_KEYWORDS[name];
        if (keyword) return { width: keyword };
        const extra = extendedTheme(ctx, ["spacing"], name);
        if (extra) return { width: extra };
        return undefined;
      },
      { autocomplete: "w-$spacing" },
    ],
    [
      /^h-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        // As `w-`: the escape hatch, and the only height that is not a token.
        const literal = arbitraryValue(name);
        if (literal !== undefined) return { height: literal };
        const token = themeOf(ctx)?.spacing[name];
        if (token) return { height: token };
        const fraction = FRACTIONS[name];
        if (fraction) return { height: fraction };
        const keyword = HEIGHT_KEYWORDS[name];
        if (keyword) return { height: keyword };
        const extra = extendedTheme(ctx, ["spacing"], name);
        if (extra) return { height: extra };
        return undefined;
      },
      { autocomplete: "h-$spacing" },
    ],
    // `min-` and `max-` on width and height.
    //
    // Three sources, tried in order: a content keyword (`full`, `screen`,
    // `fit`), a breakpoint (`max-w-lg` — "no wider than the layout changes"),
    // and the spacing scale (`max-w-64rem`). The breakpoint case is the
    // useful one and it is why this is worth having: a page's measure was
    // `max-width: calc(80 * 1rem)` in a component, because there was no
    // utility for it and a number in no token was the only way to say it.
    //
    // `min-w-` deliberately does NOT read the breakpoint scale: a minimum
    // width that changes with the viewport is a contradiction, not a utility.
    [
      /^(min|max)-([wh])-(.+)$/,
      ([, edge, axis, name]: string[], ctx?: ThemeContext) => {
        const prop = `${edge === "min" ? "min-" : "max-"}${
          axis === "w" ? "width" : "height"
        }`;
        const keywords = axis === "w" ? WIDTH_KEYWORDS : HEIGHT_KEYWORDS;
        // As `w-`: an arbitrary value is the CALLER naming the measure, not a
        // token the theme is expected to carry — `max-h-[42vh]` is a page's
        // own bound, and a theme has no opinion about it. Emitted as written.
        const literal = arbitraryValue(name);
        if (literal !== undefined) return { [prop]: literal };

        if (name === "screen" && axis === "w") return undefined;

        if (name === "0") return { [prop]: "0" };
        const keyword = keywords[name];
        if (keyword) return { [prop]: keyword };

        // `max-w-screen-<bp>` is the viewport width AT that breakpoint, which
        // is not the same value as `max-w-<bp>` — one is a measure, the other
        // is a window. Both are real and the catalog names both.
        if (name.startsWith("screen-")) {
          if (edge !== "max" || axis !== "w") return undefined;
          const at = name.slice("screen-".length);
          const point = themeOf(ctx)?.breakpoint[at];
          if (point) return { [prop]: point };
          const extra = extendedTheme(ctx, ["breakpoint", "breakpoints"], at);
          if (extra) return { [prop]: extra };
          return undefined;
        }

        // A viewport breakpoint is a MEASURE, so it is a maximum and nothing
        // else. `min-w-lg` would mean a floor that moves as the window does.
        if (edge === "max" && axis === "w" && /^[a-z]+$/.test(name)) {
          const point = themeOf(ctx)?.breakpoint[name];
          if (point) return { [prop]: point };
          const extra = extendedTheme(ctx, ["breakpoint", "breakpoints"], name);
          if (extra) return { [prop]: extra };
        }

        // And the spacing scale, so an exact measure is one step away rather
        // than an inline style.
        const step = themeOf(ctx)?.spacing[name];
        if (step) return { [prop]: step };
        const extra = extendedTheme(ctx, ["spacing"], name);
        if (extra) return { [prop]: extra };

        return undefined;
      },
      { autocomplete: "(min|max)-(w|h)-$spacing" },
    ],
  ];
}
