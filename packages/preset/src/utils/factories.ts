import { FRACTIONS, INSET_KEYWORDS } from "./vocabulary.ts";
import type { ThemeRef } from "./theme-ref.ts";
import { named, namesIn, type SpinRule, type ThemeContext } from "./lookup.ts";
import { carriesRawColor } from "./color.ts";

/**
 * An alternation of a family's names, for autocomplete templates.
 *
 * Read from the same map the rules resolve against, so a suggestion can never
 * name something the theme does not carry.
 */
export function orGroup(theme: ThemeRef, family: string): string {
  return "(" + namesIn(theme, family).join("|") + ")";
}

const LIST_CONTAINERS: Record<string, true> = {
  flex: true,
  "inline-flex": true,
  grid: true,
  "inline-grid": true,
};

export function staticRules(
  names: readonly string[],
  decls: Record<string, Record<string, string>>,
): SpinRule[] {
  return names.map((name): SpinRule => {
    if (!LIST_CONTAINERS[name]) {
      return [name, decls[name] as Record<string, string>];
    }
    return [
      new RegExp(`^${name}$`),
      function* (_m, ctx) {
        yield decls[name] as Record<string, string>;
        yield {
          [ctx.symbols.selector]: () => `:where(ul, ol).${name}`,
          "list-style-type": "none",
          "padding-inline-start": "0",
        };
        yield {
          [ctx.symbols.selector]: () => `.${name} > li + li`,
          "margin-block-start": "0",
        };
        if (name === "flex" || name === "inline-flex") {
          yield {
            [ctx.symbols.selector]: () =>
              `:where(label).${name}:where(:not(.flex-col):not(.flex-col-reverse))`,
            "flex-direction": "row",
          };
        }
      },
      { autocomplete: name },
    ];
  });
}

export function spacingRule(
  pattern: RegExp,
  props: string[],
  autocomplete: string,
): SpinRule {
  return [
    pattern,
    ([, name]: string[], ctx?: ThemeContext) => {
      // Dynamic: step comes from the spacing class suffix.
      const ref = named(ctx, "spacing", name);
      if (!ref) return undefined;
      return Object.fromEntries(props.map((prop) => [prop, ref]));
    },
    { autocomplete },
  ];
}

/**
 * The atoms an arbitrary value may be built from.
 *
 * A signed number, and the CSS length units plus `%`. `%` is a unit here so a
 * percentage is not a second case to remember: `50%` and `13rem` are the same
 * shape, and the browser agrees.
 */
const NUMBER = String.raw`-?(?:\d+(?:\.\d+)?|\.\d+)`;
const UNIT = "(?:px|rem|em|ex|ch|cap|ic|lh|rlh|cm|mm|in|pt|pc|q|" +
  "vh|vw|vi|vb|vmin|vmax|" +
  "svh|svw|svmin|svmax|lvh|lvw|lvmin|lvmax|dvh|dvw|dvmin|dvmax|" +
  "cqw|cqb|cqi|cqh|cqmin|cqmax|%)";
/** A number with a unit, in full: `13rem`, `50%`, `-.5vh`. */
const MEASURED = new RegExp(`^${NUMBER}${UNIT}$`);
/** A number that may stand alone, which inside an expression may be unitless. */
const ATOM = new RegExp(`^${NUMBER}(?:${UNIT})?`);
/** A fraction, which is a length only once the scale has said so. */
const FRACTION = new RegExp(`^${NUMBER}/${NUMBER}$`);
/** A number that IS a length without a unit, because it is zero. */
const ZERO = /^[-+]?0+(?:\.0+)?$/;
/** The functions an arbitrary value may be written as. */
const CALL = /^(?:calc|min|max|clamp)\(/i;

function skipSpace(source: string, at: number): number {
  let i = at;
  while (i < source.length && /\s/.test(source[i] as string)) i++;
  return i;
}

/**
 * One term: a nested call, a parenthesised sum, or a number.
 *
 * The recursion is the point — it is what makes `calc(min(100%, 30rem) - 1rem)`
 * safe rather than merely plausible. Every character a value can contain is
 * typed here, so `var(`, `url(` and a bare identifier all fail to parse and the
 * whole value is refused, instead of being sanitised after the fact.
 */
function readTerm(source: string, at: number): number | undefined {
  const start = skipSpace(source, at);
  const call = CALL.exec(source.slice(start));
  let inner: number | undefined;
  if (call !== null) {
    inner = readSum(source, start + call[0].length);
  } else if (source[start] === "(") {
    inner = readSum(source, start + 1);
  } else {
    const atom = ATOM.exec(source.slice(start));
    if (atom === null) return undefined;
    return start + atom[0].length;
  }
  if (inner === undefined) return undefined;
  const close = skipSpace(source, inner);
  return source[close] === ")" ? close + 1 : undefined;
}

/** Terms joined by arithmetic operators. */
function readSum(source: string, at: number): number | undefined {
  let i = readTerm(source, at);
  if (i === undefined) return undefined;
  for (;;) {
    const next = skipSpace(source, i);
    // A comma separates the arguments of `min()`, `max()` and `clamp()`,
    // which take a list rather than a sum, and it is the only place one may
    // appear.
    if (source[next] === ",") {
      const after = readTerm(source, next + 1);
      if (after === undefined) return undefined;
      i = after;
      continue;
    }
    if (
      source[next] === undefined || !"+-*/".includes(source[next] as string)
    ) {
      return next;
    }
    const after = readTerm(source, next + 1);
    if (after === undefined) return undefined;
    i = after;
  }
}

/**
 * An arbitrary value's literal, or `undefined` when the capture is not one.
 *
 * The ONE place a hardcoded literal is correct. Every other declaration a rule
 * emits is a theme token it read, and a token the theme does not carry means
 * the rule omits itself. An arbitrary value is the CALLER supplying the
 * number — the theme has no opinion about 13rem, so `w-[13rem]` is not a
 * themed value and must not pretend to be one. It is emitted as written, or
 * not at all.
 *
 * Author input lands verbatim in a stylesheet, so the value is matched against
 * a GRAMMAR rather than cleaned up afterwards: a length, a percentage, a
 * bare zero, a fraction from the rule's own scale, or a `calc()`/`min()`/
 * `max()`/`clamp()` expression built from those same atoms. A `;`, a brace or
 * a quote is not a character this grammar can produce, so there is nothing
 * left to strip — anything else simply emits no rule.
 *
 * `_` is a space, so a value written `calc(100%_-_1rem)` reaches the sheet as
 * the sum it means; a class name cannot carry a literal space.
 */
export function arbitraryValue(name: string): string | undefined {
  const wrapped = /^\[(.+)\]$/.exec(name);
  if (wrapped === null) return undefined;
  const source = (wrapped[1] as string).replace(/_/g, " ").trim();
  if (source === "") return undefined;
  // A raw colour is a design decision, and a design decision in this system
  // is a TOKEN. The hatch is for numbers — a length, a percentage, a time,
  // an expression of those — and a colour is not one of them: it belongs to
  // the theme's palette. So the hatch refuses it, and the class that
  // carried it is DEAD ON ARRIVAL: it produces no CSS at all, and the
  // ordinary vocabulary rule catches it the way it catches a typo.
  if (carriesRawColor(source)) return undefined;
  // A fraction is the scale's own vocabulary spelled inside brackets, so it
  // resolves through the same table `w-1/2` reads rather than emitting `1/2`,
  // which is not a width.
  if (FRACTION.test(source)) return FRACTIONS[source];
  const end = readSum(source, 0);
  if (end === undefined || skipSpace(source, end) !== source.length) {
    return undefined;
  }
  // At the top level a bare number is a length only when it is zero: `top-[3]`
  // is not three of anything, it is nothing at all.
  if (
    !CALL.test(source) && !MEASURED.test(source) && !ZERO.test(source)
  ) {
    return undefined;
  }
  return source;
}

export function insetRule(
  pattern: RegExp,
  props: string[],
  autocomplete: string,
): SpinRule {
  return [
    pattern,
    ([, name]: string[], ctx?: ThemeContext) => {
      // The ONE place a hardcoded literal is correct. Every other value the
      // inset resolves is a theme token — spacing, a fraction, a keyword —
      // and one the theme does not carry means the rule omits itself. An
      // arbitrary value is the CALLER supplying the number, which is the
      // escape hatch's entire purpose, so it is emitted as written or not at
      // all.
      const literal = arbitraryValue(name);
      if (literal !== undefined) {
        return Object.fromEntries(props.map((prop) => [prop, literal]));
      }
      // Dynamic: step comes from the inset class suffix.
      const ref = named(ctx, "spacing", name) ?? FRACTIONS[name] ??
        INSET_KEYWORDS[name];
      if (!ref) return undefined;
      return Object.fromEntries(props.map((prop) => [prop, ref]));
    },
    { autocomplete },
  ];
}

export function divideChildren(selector: string): string {
  return `${selector} > :not([hidden]) ~ :not([hidden])`;
}
