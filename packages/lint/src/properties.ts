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
 * table uses — so the lint and the theme speak one language.
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
 * The logical spellings, and the physical name each one means.
 *
 * A document is written left to right, top to bottom, so a block's start is
 * its top and its inline start is its left. The theme writes the logical
 * name because it is the one that survives a right-to-left document; the
 * utilities write the physical one because that is what the class names say.
 * For the lint they are the same property, so they get the same name.
 */
const PHYSICAL: Readonly<Record<string, string>> = {
  "margin-block-start": "margin-top",
  "margin-block-end": "margin-bottom",
  "margin-inline-start": "margin-left",
  "margin-inline-end": "margin-right",
  "padding-block-start": "padding-top",
  "padding-block-end": "padding-bottom",
  "padding-inline-start": "padding-left",
  "padding-inline-end": "padding-right",
  "border-block-start-width": "border-top-width",
  "border-block-end-width": "border-bottom-width",
  "border-inline-start-width": "border-left-width",
  "border-inline-end-width": "border-right-width",
  "border-block-start-style": "border-top-style",
  "border-block-end-style": "border-bottom-style",
  "border-inline-start-style": "border-left-style",
  "border-inline-end-style": "border-right-style",
  "border-block-start-color": "border-top-color",
  "border-block-end-color": "border-bottom-color",
  "border-inline-start-color": "border-left-color",
  "border-inline-end-color": "border-right-color",
};

/** The physical name of a property. */
export function canonical(property: string): string {
  return PHYSICAL[property] ?? property;
}

/**
 * The longhands a shorthand stands for.
 *
 * A shorthand is a way of writing several properties at once, and the way it
 * writes them depends on how many values it carries: `padding: 1rem` pads
 * every side, `padding: 1rem 2rem` pads top and bottom with the first and
 * left and right with the second. So the expansion needs the value, not just
 * the name.
 */
/** The longhands of the box shorthands, in the order CSS gives them. */
const BOX: Readonly<Record<string, readonly string[]>> = {
  padding: ["padding-top", "padding-right", "padding-bottom", "padding-left"],
  margin: ["margin-top", "margin-right", "margin-bottom", "margin-left"],
};

/** The longhands of the border shorthands. */
const BORDER: Readonly<Record<string, readonly string[]>> = {
  border: ["border-width", "border-style", "border-color"],
  "border-top": ["border-top-width", "border-top-style", "border-top-color"],
  "border-right": [
    "border-right-width",
    "border-right-style",
    "border-right-color",
  ],
  "border-bottom": [
    "border-bottom-width",
    "border-bottom-style",
    "border-bottom-color",
  ],
  "border-left": [
    "border-left-width",
    "border-left-style",
    "border-left-color",
  ],
  "border-block": [
    "border-block-start-width",
    "border-block-start-style",
    "border-block-start-color",
    "border-block-end-width",
    "border-block-end-style",
    "border-block-end-color",
  ],
  "border-block-start": [
    "border-block-start-width",
    "border-block-start-style",
    "border-block-start-color",
  ],
  "border-block-end": [
    "border-block-end-width",
    "border-block-end-style",
    "border-block-end-color",
  ],
  "border-inline": [
    "border-inline-start-width",
    "border-inline-start-style",
    "border-inline-start-color",
    "border-inline-end-width",
    "border-inline-end-style",
    "border-inline-end-color",
  ],
  "border-inline-start": [
    "border-inline-start-width",
    "border-inline-start-style",
    "border-inline-start-color",
  ],
  "border-inline-end": [
    "border-inline-end-width",
    "border-inline-end-style",
    "border-inline-end-color",
  ],
};

/**
 * The values a shorthand carries, split apart.
 *
 * A value may hold a function with spaces in it — `calc(1rem / 2)` — so the
 * split counts parentheses rather than cutting at every space.
 */
function parts(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth === 0 && /\s/.test(ch)) {
      if (current !== "") out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current !== "") out.push(current);
  return out;
}

/**
 * The four values a box shorthand spreads over its sides.
 *
 * One value is every side; two are top-and-bottom and left-and-right; three
 * are top, left-and-right and bottom; four are each side.
 */
function boxValues(
  values: readonly string[],
): [string, string, string, string] {
  const [a, b, c, d] = values;
  if (b === undefined) return [a ?? "0", a ?? "0", a ?? "0", a ?? "0"];
  if (c === undefined) return [a ?? "0", b, a ?? "0", b];
  if (d === undefined) return [a ?? "0", b, c ?? "0", b];
  return [a ?? "0", b, c ?? "0", d];
}

/**
 * The declarations a property and its value stand for.
 *
 * A property that is not a shorthand stands for itself. A shorthand stands
 * for its longhands, each with the value CSS gives it.
 */
export function declarations(
  property: string,
  value: string,
): [string, string][] {
  const box = BOX[property];
  if (box !== undefined) {
    const [top, right, bottom, left] = boxValues(parts(value));
    return box.map((name, index) =>
      [name, [top, right, bottom, left][index] as string] as [string, string]
    );
  }
  const border = BORDER[property];
  if (border !== undefined) {
    const values = parts(value);
    if (border.length === 3) {
      // The border shorthand: width, style and colour, in that order, with
      // the style optional (`border: 1px` is a width and a style).
      const width = values[0] ?? "";
      const style = values[1] ?? "";
      const color = values[2] ?? "";
      return [
        [border[0] as string, width],
        [border[1] as string, style],
        [border[2] as string, color],
      ];
    }
    const [startWidth, startStyle, startColor, endWidth, endStyle, endColor] =
      values;
    return border.map((name, index) => {
      const group = [
        startWidth ?? "",
        startStyle ?? "",
        startColor ?? "",
        endWidth ?? "",
        endStyle ?? "",
        endColor ?? "",
      ];
      return [name, group[index] ?? ""] as [string, string];
    });
  }
  return [[property, value]];
}

/**
 * A declaration map, brought to one spelling per property.
 *
 * The keys are canonical (physical) names; the values are the values as
 * written. A property that is written twice — a shorthand and a longhand —
 * keeps the last one, because that is the one the cascade would apply.
 */
export function canonicalMap(
  entries: Iterable<readonly [string, string]>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const [property, value] of entries) {
    for (const [name, spelled] of declarations(property, value)) {
      out.set(canonical(name), spelled);
    }
  }
  return out;
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
      if (fallback !== undefined) return fallback.trim();
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
  return resolve(a, values) === resolve(b, values);
}
