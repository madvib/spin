/**
 * The named-type typography: the styles a theme declares.
 *
 * A shared scale is a decision the whole system shares — spacing, type,
 * radius, shadow. A named STYLE is a complete tuple the theme declares under
 * `font.style.<name>`: the face, the size, the weight, the tracking, the
 * leading, and the ink. Elements read their `element.<tag>.type` alias by
 * default; authors change style by changing element or by re-pointing the
 * alias — never by per-field element overrides, which TYPE-c deleted.
 *
 * The styles are REQUIRED (see the owned set below); the scales are the style
 * author's library — styles alias `{font.size.md}` instead of writing
 * `1rem` fourteen times. A theme with literal-valued styles and no scales
 * is complete.
 *
 * The style paths are `font.style.<name>.<field>`; a style's fields are
 * aliases into the scales the tuple is built from, so moving a step moves
 * every style built from it.
 */

import { parseTokens } from "../pipeline/parse.ts";
import { silkTheme } from "../themes/index.ts";


/**
 * What one named style is made of.
 *
 * The complete tuple: the face, the size, the weight, the tracking, the
 * leading, and the ink. Every field is an alias into the scale it is built
 * from, so the tuple never drifts from the ladders.
 */
export type NamedStyleField =
  | "family"
  | "size"
  | "weight"
  | "tracking"
  | "leading"
  | "ink";
/** The fields every owned style carries, as a type. */

/**
 * The styles a theme owes: the styles the baseline implements.
 *
 * The names are stable API — a theme that renames one breaks every consumer
 * of that name — so trimming below this set fails completeness. The tuple
 * each name carries is the theme's own: shared keys, free values. Derived
 * from the baseline document, in the order it states them, so the set is
 * what the theme ships rather than what a table remembered.
 */
let ownedNames: readonly string[] | undefined;

/** The owned names, in the order the baseline states them. */
export function ownedStyleNames(): readonly string[] {
  if (ownedNames === undefined) {
    const parsed = parseTokens(silkTheme);
    if (!parsed.ok) throw new Error(`contract: baseline does not parse: ${parsed.error}`);
    const names: string[] = [];
    const visit = (nodes: readonly unknown[]): void => {
      for (const node of nodes) {
        const n = node as {
          kind: string;
          name: string;
          path: readonly string[];
          children?: readonly unknown[];
        };
        if (n.kind === "group" && n.path.join(".") === "font.style") {
          for (const child of n.children ?? []) {
            names.push((child as { name: string }).name);
          }
          return;
        }
        if (n.kind === "group" && n.children !== undefined) visit(n.children);
      }
    };
    visit(parsed.tree as readonly unknown[]);
    ownedNames = names;
  }
  return ownedNames;
}

/** The fields every owned style carries: the complete tuple. */
export function ownedStyleFields(): readonly NamedStyleField[] {
  return ["family", "size", "weight", "tracking", "leading"];
}


