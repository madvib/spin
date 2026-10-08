/**
 * The organization — how a reader thinks about the surface, over what the
 * catalog happens to be divided into.
 *
 * The catalog's groups are which FILE a rule lives in, which is an
 * implementation fact: `text-color`, `type-size`, `text` and `typography` are
 * all `text.ts`. A reader looking for "how do I set my line height" does not
 * know or care that it shares a file with text colour.
 *
 * So the reference is organized by INTENT, and this is the single declaration
 * of that. Not the sidebar — the sidebar reads it, the studio will read it, and
 * an MCP client asking "what does text mean in spin" should get this and not a
 * re-derivation of it that happens to agree today.
 *
 * It is authored rather than derived, and that is the point: the grouping is a
 * DECISION, and a decision cannot be read off the code. What is derived is the
 * membership — `groups` names catalog groups, so a section cannot reference a
 * group that stopped existing, and a group nothing claims is visible rather
 * than silently orphaned.
 */

/** One catalog group, as the catalog emits it. */
export type CatalogGroupId = string;

/** A section of the reference: what a reader is looking for. */
export interface Section {
  /** The URL segment. Stable, because it is a link. */
  readonly id: string;
  /** The heading. */
  readonly title: string;
  /** What this covers, in one line, for someone scanning the rail. */
  readonly blurb: string;
  /** The catalog groups it draws from. Order is preserved. */
  readonly groups: readonly CatalogGroupId[];
  /**
   * How a utility in this section is DEMONSTRATED.
   *
   * Presentational, and the reason a fixed preview box was useless: padding on
   * an empty box shows nothing, `top-1/2` on a static panel does nothing, and
   * a swatch is the only honest sample for a colour. This is the one place the
   * surface stops being derived, and it is worth it.
   */
  readonly sample?: Sample;
}

/**
 * How a section's utilities are shown.
 *
 * `box`   — a panel with a mark in it. Right for spacing, sizing, border,
 *           radius, shadow, opacity, and anything that moves or resizes it.
 * `swatch`— the element itself, filled. The only honest sample for a colour.
 * `text`  — a run of prose carrying the class. For type, weight, alignment,
 *           decoration and anything else read rather than seen.
 * `stack` — a row of them, for the layout families where one panel proves
 *           nothing and adjacency is the whole point.
 */
export type Sample = "box" | "swatch" | "text" | "stack";

/**
 * The reference's sections, in reading order.
 *
 * Colours are ONE section rather than three. `background`, `text-color` and
 * `border` are the same palette reaching three properties, and a reader asking
 * "what colours are there" should get one answer, not three lists that overlap.
 */
export const SECTIONS: readonly Section[] = [
  {
    id: "colors",
    title: "Colors",
    blurb: "The palette and the roles built on it. One fill, several properties.",
    groups: ["background", "text-color"],
    sample: "swatch",
  },
  {
    id: "layout",
    title: "Layout",
    blurb: "Display, position, and the flex and grid containers.",
    groups: ["layout", "display", "position", "grid", "overflow"],
    sample: "stack",
  },
  {
    id: "sizing",
    title: "Sizing",
    blurb: "Width, height, min and max — including the measure.",
    groups: ["sizing"],
    sample: "box",
  },
  {
    id: "spacing",
    title: "Spacing",
    blurb: "Padding, margin, gap, and the divide rule.",
    groups: ["padding", "margin", "gap", "divide"],
    sample: "box",
  },
  {
    id: "typography",
    title: "Typography",
    blurb: "Size, family, weight, alignment, decoration and case.",
    groups: ["type-size", "font", "text", "typography", "text-decoration"],
    sample: "text",
  },
  {
    id: "borders",
    title: "Borders & radius",
    blurb: "Edges, corners, and the shadows that lift them.",
    groups: ["radius", "shadow", "border"],
    sample: "box",
  },
  {
    id: "effects",
    title: "Effects",
    blurb: "Opacity, and the states a control can be in.",
    groups: ["opacity", "interactivity", "variants"],
    sample: "box",
  },
  {
    id: "transitions",
    title: "Transitions",
    blurb: "What moves, and for how long.",
    groups: ["transitions"],
    sample: "box",
  },
];

/** Every catalog group this organization claims, for the orphan check. */
export function claimedGroups(): Set<string> {
  return new Set(SECTIONS.flatMap((s) => [...s.groups]));
}

/** The section a catalog group belongs to, or undefined if none claims it. */
export function sectionFor(group: string): Section | undefined {
  return SECTIONS.find((s) => s.groups.includes(group));
}

/**
 * The utilities a section draws, in catalog order.
 *
 * `ordered` is why grouping by intent is safe: a utility keeps the order its
 * own scale gives it, so `p-0` through `p-16` still read as a scale inside
 * whichever section ends up holding them.
 */
export function utilitiesFor(
  section: Section,
  catalog: ReadonlyArray<{ id: string; utilities: readonly string[] }>,
): string[] {
  const out: string[] = [];
  for (const id of section.groups) {
    const group = catalog.find((g) => g.id === id);
    if (group === undefined) continue;
    out.push(...group.utilities);
  }
  return out;
}
