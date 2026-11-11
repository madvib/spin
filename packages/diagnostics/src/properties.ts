/**
 * The properties the decisions are made of.
 *
 * A DECISION is the theme's word for one thing about an element's look — its
 * fill, its edge, its corner, the scale its text is read in. The primitives
 * own decisions, and the manifest says which element owns which. A utility
 * MAKES a decision, and the catalog's own grouping says which.
 *
 * Comparing a class with an element means comparing the same property twice,
 * and the two sides rarely spell it the same way: the theme writes
 * `margin-block-end` and the utility writes `margin-bottom`, and the theme
 * writes `border: 1px solid red` where the utility writes `border-width` and
 * `border-style`. So both sides are brought to ONE spelling before they are
 * compared — the longhands of a shorthand, and the physical name of a logical
 * property — and only then are they equal or not.
 */

/**
 * The decisions an element's look is made of.
 *
 * The names are the primitives' own — the same words the manifest's scope
 * table uses — so the checks and the theme speak one language. Stated here
 * rather than imported so the checks never reach into the engine, even for
 * types: a decision the primitives stop knowing is a decision the tier and
 * paint maps beside this list stop naming, visibly, in one place.
 */
export type Decision =
  | "background"
  | "ink"
  | "edge"
  | "corner"
  | "elevation"
  | "face"
  | "weight"
  | "size"
  | "tracking"
  | "case"
  | "decoration"
  | "opacity";

/**
 * The decisions that are the text's own shape.
 *
 * A type scale, a weight, a family, a capitalisation and a tracking are
 * decisions about how the text is read. The rest — colour, background,
 * border, radius, shadow, opacity — are decisions about the box around it.
 *
 * The split is the lint's stance: an element the theme types has its text
 * set by the theme, and a one-off override of that text is a second opinion
 * about the scale. The painted look is the element's own, and a one-off
 * override of that is a second opinion about the fill.
 */
export const TYPOGRAPHY: ReadonlySet<Decision> = new Set([
  "size",
  "weight",
  "face",
  "tracking",
  "case",
]);

/** Whether a decision is about the text rather than about the painted box. */
export function isTypography(decision: Decision): boolean {
  return TYPOGRAPHY.has(decision);
}

/**
 * The properties that hold a block's spacing.
 *
 * Margin and padding are where a box sits — layout, and the author's — with
 * one exception the theme makes: on an element the theme types, the space
 * between blocks is the document's rhythm, and the theme states it.
 */
export const SPACING: ReadonlySet<string> = new Set([
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "margin-block-start",
  "margin-block-end",
  "margin-inline-start",
  "margin-inline-end",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "padding-block-start",
  "padding-block-end",
  "padding-inline-start",
  "padding-inline-end",
]);

/** Whether a property holds spacing. */
export function isSpacing(property: string): boolean {
  return SPACING.has(property);
}

/**
 * The value a custom property reference resolves to.
 *
 * A reference is `var(--name)` or `var(--name, fallback)`. The theme's own
 * value answers it; the fallback answers it when the theme says nothing.
 * The answer may itself be a reference, so the walk continues — to a depth,
 * because a theme that refers to itself would otherwise never end.
 */
export function resolve(
  value: string,
  values: ReadonlyMap<string, string>,
  depth = 8,
): string {
  if (depth <= 0) return value;
  return value.replace(
    /var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/gi,
    (whole, name: string, fallback?: string) => {
      const resolved = values.get(name);
      if (resolved !== undefined) return resolve(resolved, values, depth - 1);
      if (fallback !== undefined) return resolve(fallback.trim(), values, depth - 1);
      return whole;
    },
  );
}

/**
 * Whether two values are the same value.
 *
 * The comparison is on the values the theme resolves to, not on the values as
 * written: `1px` and `var(--border-width)` are the same value when the
 * theme's border is a pixel wide, and they are the lint's business only when
 * they are.
 */
export function sameValue(
  a: string,
  b: string,
  values: ReadonlyMap<string, string>,
): boolean {
  // A zero is a zero whatever unit it wears: `0`, `0px` and `0rem` are the
  // same used length, and the reset writes `0` where utilities write `0px`.
  const zero = /^(-?0+(?:\.0+)?)(px|r?em|%|vh|vw|vmin|vmax|ch|ex|cap|ic|lh|rlh|vi|vb|svw|svh|lvw|lvh|dvw|dvh|cqw|cqh|cqi|cqb|cqmin|cqmax)?$/;
  const canon = (value: string): string => {
    const match = zero.exec(resolve(value, values).trim());
    return match === null ? resolve(value, values) : "0";
  };
  return canon(a) === canon(b);
}

/**
 * The decision a CSS property belongs to.
 *
 * A property that paints nothing a primitive owns — a margin, a display —
 * has no decision: it is layout, and layout is the author's call. Stated
 * here beside `Decision` so the checks map properties without reaching
 * into the engine.
 */
export function decisionOf(property: string): Decision | undefined {
  if (property === "border-radius") return "corner";
  if (property.startsWith("border")) return "edge";
  if (property.startsWith("outline")) return "edge";
  if (property.startsWith("text-decoration")) return "decoration";
  if (property === "text-underline-offset") return "decoration";
  if (property === "background-color") return "background";
  if (property === "color") return "ink";
  if (property === "box-shadow") return "elevation";
  if (property === "font-family") return "face";
  if (property === "font-weight") return "weight";
  if (property === "font-size") return "size";
  if (property === "letter-spacing") return "tracking";
  if (property === "text-transform") return "case";
  if (property === "opacity") return "opacity";
  return undefined;
}
