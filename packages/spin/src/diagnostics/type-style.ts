/**
 * The style a removed raw type utility means.
 *
 * `text-*` sizes and `font-*` families/weights are no longer vocabulary, but
 * the lint must say what to write instead of just saying no: the remedy names
 * the declared style that reads the way the removed class did. The ranking is
 * by value — the style whose tuple carries the removed utility's own value in
 * the same dimension — with the element's default style breaking ties, and the
 * first style in reading order as the last resort. Every removed utility
 * carries a suggestion whenever the theme declares any style at all.
 */

import { ELEMENT_STYLE_DEFAULTS } from "../theme/index.ts";

/** One declared style, with the tuple values the theme resolved for it. */
export interface StyleTuple {
  /** The style's name, as `type-<name>` spends it. */
  readonly name: string;
  /** The resolved family/size/weight values, by tuple field. */
  readonly values: ReadonlyMap<string, string>;
}

/**
 * Whether a class is a removed raw type utility: a `text-*` size, a `font-*`
 * family/weight, or a `tracking-*`/`leading-*` atom the named-style system
 * replaced (TYPE-c: the ladder is dead as a spend path).
 *
 * The colour branch of `text-*` is vocabulary and stays silent here:
 * `text-primary` names the palette, not the scale.
 */
export function isRemovedTypeUtility(cls: string): boolean {
  if (cls.startsWith("text-")) {
    const rest = cls.slice("text-".length);
    // A colour (or the keywords the colour rules answer) is the palette's,
    // not the scale's — only a bare scale step is removed.
    if (rest.length === 0 || rest.includes("/") || rest.includes("[")) {
      return false;
    }
    return true;
  }
  if (cls.startsWith("leading-")) return cls.slice("leading-".length).length > 0;
  if (cls.startsWith("tracking-")) return cls.slice("tracking-".length).length > 0;
  return cls.startsWith("font-") && cls.slice("font-".length).length > 0;
}

/**
 * The dimension a removed utility sets, and the step it names: a size sets
 * the tuple's size, a family the face, a weight the weight, a tracking the
 * tracking, a leading the leading. A step the theme declares under neither
 * family is a typo wearing a familiar prefix, not a removed utility, so
 * there is nothing to suggest.
 */
export function removedTypeDimension(
  cls: string,
  values: ReadonlyMap<string, string>,
): { field: string; family: string; step: string } | undefined {
  if (!isRemovedTypeUtility(cls)) return undefined;
  if (cls.startsWith("text-")) {
    const step = cls.slice("text-".length);
    if (!values.has(`--font-size-${step}`)) return undefined;
    return { field: "size", family: "--font-size", step };
  }
  if (cls.startsWith("tracking-")) {
    return { field: "tracking", family: "--font-tracking", step: cls.slice("tracking-".length) };
  }
  if (cls.startsWith("leading-")) {
    return { field: "leading", family: "--font-leading", step: cls.slice("leading-".length) };
  }
  const step = cls.slice("font-".length);
  for (
    const [field, family] of [["family", "--font-family"], ["weight", "--font-weight"]] as const
  ) {
    if (values.has(`${family}-${step}`)) return { field, family, step };
  }
  return undefined;
}

/**
 * The declared styles in a flat values map, folded back to names.
 *
 * A style is five leaves under one name — `font-style-body-size` and its
 * siblings — and the utility is the name alone, so the leaves fold here the
 * way `styleNames` folds them for the catalog.
 */
export function stylesIn(values: ReadonlyMap<string, string>): StyleTuple[] {
  const names = new Set<string>();
  for (const key of values.keys()) {
    if (!key.startsWith("--font-style-")) continue;
    const rest = key.slice("--font-style-".length);
    const dash = rest.lastIndexOf("-");
    if (dash > 0) names.add(rest.slice(0, dash));
  }
  return [...names].sort().map((name) => ({
    name,
    values: new Map(
      ["family", "size", "weight", "tracking", "leading"]
        .filter((field) => values.has(`--font-style-${name}-${field}`))
        .map((field) => [field, values.get(`--font-style-${name}-${field}`) as string]),
    ),
  }));
}

/**
 * The style a removed utility means, as the utility to write instead.
 *
 * An element that reads a style by default keeps it: an author on a
 * paragraph who wrote raw type means the paragraph's style, and the size
 * the class named is already the size that style reads. Past the element's
 * own, the style whose tuple carries the removed value in the same
 * dimension wins, and past that the first style in reading order answers —
 * so the suggestion is total whenever the theme declares any style.
 */
export function suggestTypeStyle(
  cls: string,
  values: ReadonlyMap<string, string>,
  tag?: string,
): string | undefined {
  const dimension = removedTypeDimension(cls, values);
  if (dimension === undefined) return undefined;
  const styles = stylesIn(values);
  if (styles.length === 0) return undefined;
  if (tag !== undefined) {
    const own = ELEMENT_STYLE_DEFAULTS[tag];
    if (own !== undefined && styles.some((style) => style.name === own)) {
      return `type-${own}`;
    }
  }
  const removed = values.get(`${dimension.family}-${dimension.step}`);
  const carrying =
    removed === undefined
      ? []
      : styles.filter((style) => style.values.get(dimension.field) === removed);
  const ranked = carrying.length > 0 ? carrying : styles;
  return `type-${(ranked[0] as StyleTuple).name}`;
}
