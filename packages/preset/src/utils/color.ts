import { COLOR_KEYWORDS } from "./vocabulary.ts";

/**
 * What a colour is, and therefore what a rule must refuse.
 *
 * A colour written by hand is a design decision, and a design decision in
 * this system is a TOKEN. The theme's palette is where colours live; a
 * colour typed into a class is the theme refusing to have an opinion about
 * one. So the question this file answers is narrow — "is this value a
 * colour?" — and the answer is what decides whether a rule emits a value or
 * refuses it.
 *
 * The list is CSS's, not ours: the browser's colour syntax is what makes a
 * value a colour, and no vocabulary of ours can narrow that. What we own is
 * the other half of the decision — whether the value may be written at all.
 *
 * The CSS-wide keywords are not a second copy of a list: the theme owns
 * them, the preset's own vocabulary table reads them from there, and this
 * file reads them from the table. One list, one owner.
 */

/**
 * The colour functions CSS defines.
 *
 * `color-mix()` is here with the rest: it is how a colour is written when
 * two other colours meet, and it is still a colour written by hand.
 */
const COLOR_FUNCTIONS: readonly string[] = [
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
  "color-mix",
];

/**
 * The named colours CSS defines.
 *
 * A closed list — CSS Color 4's own — because "is this a colour" has to be
 * answerable without a browser in the room. `gray` and `grey` are both here
 * because CSS spells both, and `rebeccapurple` is here because CSS has
 * spelled it since 2014 and it is not going away.
 */
const NAMED_COLORS: ReadonlySet<string> = new Set(
  `
  aliceblue antiquewhite aqua aquamarine azure beige bisque black
  blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse
  chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
  darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta
  darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet
  deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite
  forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green
  greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender
  lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink
  lightsalmon lightseagreen lightskyblue lightslategray lightslategrey
  lightsteelblue lightyellow lime limegreen linen magenta maroon
  mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
  mediumslateblue mediumspringgreen mediumturquoise mediumvioletred
  midnightblue mintcream mistyrose moccasin navajowhite navy oldlace
  olive olivedrab orange orangered orchid palegoldenrod palegreen
  paleturquoise palevioletred papayawhip peachpuff peru pink plum
  powderblue purple rebeccapurple red rosybrown royalblue saddlebrown
  salmon sandybrown seagreen seashell sienna silver skyblue slateblue
  slategray slategrey snow springgreen steelblue tan teal thistle tomato
  turquoise violet wheat white whitesmoke yellow yellowgreen
  `
    .trim()
    .split(/\s+/),
);

/**
 * The CSS-wide colour keywords, lowercased for comparison.
 *
 * `transparent` and `currentColor` are the two CSS spells of "no colour of
 * my own" and "the colour I inherited". They are VOCABULARY rather than
 * tokens — `bg-transparent` says exactly what it means — but a value that
 * carries one is still carrying a colour, and the rules that spend them say
 * so plainly.
 */
const KEYWORDS: ReadonlySet<string> = new Set(
  COLOR_KEYWORDS.map((keyword) => keyword.toLowerCase()),
);

/**
 * A hex colour: `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`.
 *
 * Three to eight digits, which covers every length CSS defines and the two
 * in between that a browser would reject — a value the browser will not
 * paint is still a colour written by hand, and it is still refused.
 */
const HEX = /#[0-9a-f]{3,8}(?![0-9a-f])/i;

/**
 * An identifier inside a value: a word, or a function's name.
 *
 * The boundaries matter. `red-500` is one identifier and not the colour
 * `red` — a theme's step is a token, not a raw colour — while `red` on its
 * own is the colour. So an identifier is delimited by anything that is not
 * part of one.
 */
const IDENTIFIER = /(?<![\w-])([a-z][a-z0-9-]*)(?![\w-])/gi;

/** A quoted string: text, and never a colour. */
const QUOTED = /"[^"]*"|'[^']*'/g;

/**
 * Whether a value carries a colour written by hand.
 *
 * The whole value need not BE a colour. A shadow whose colour is written by
 * hand — `0 0 10px red` — carries one just as surely as `red` does, and it
 * lands in the same sheet, so it is refused for the same reason.
 *
 * `_` is a space in an arbitrary value, so `rgb(0_0_0)` and `rgb(0 0 0)` are
 * the same value and are read the same way.
 */
export function carriesRawColor(value: string): boolean {
  const text = value.replace(/_/g, " ").replace(QUOTED, " ");
  if (HEX.test(text)) return true;
  for (const match of text.matchAll(IDENTIFIER)) {
    const word = (match[1] as string).toLowerCase();
    const after = text[(match.index as number) + match[0].length];
    // A function call is a call: `color` in `var(--color-primary)` is part of
    // a variable's name, and `color(...)` is the colour function.
    if (after === "(") {
      if (COLOR_FUNCTIONS.includes(word)) return true;
      continue;
    }
    if (NAMED_COLORS.has(word)) return true;
    if (KEYWORDS.has(word)) return true;
  }
  return false;
}

/**
 * Whether a class carries an arbitrary value that is a colour.
 *
 * The bracket is where an arbitrary value lives — `fill-[#000]` — and a
 * colour inside one is a colour written by hand. A class that carries it is
 * DEAD ON ARRIVAL: it produces no CSS at all, and the ordinary vocabulary
 * rule catches it the way it catches a typo.
 */
export function hasRawColor(token: string): boolean {
  for (const match of token.matchAll(/\[([^\]]*)\]/g)) {
    if (carriesRawColor(match[1] as string)) return true;
  }
  return false;
}
