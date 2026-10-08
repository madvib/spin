/**
 * The sample each catalog group is demonstrated with.
 *
 * One box for everything was the first version's mistake, and it is why the
 * reference read as a column of identical rows: padding on an empty box shows
 * almost nothing, `top-1/2` on a static panel does nothing at all, and a cursor
 * cannot be photographed. A sample has to be the thing the utility acts on, and
 * it has to be a situation where the effect is LEGIBLE — three items and not
 * one, because one item cannot demonstrate a distribution; three overlapping
 * cards and not one, because one card has no "above".
 *
 * So a group names the sample, and the sample is what makes the family legible
 * rather than merely present. Nothing here is CSS or markup: the reference owns
 * the rendering, and this file owns which sample a family gets.
 */

/**
 * A demonstrable sample, named for what the family acts on rather than for what
 * it looks like. `row` is three items because one cannot show a distribution;
 * `said` is text, because a cursor cannot be shown.
 */
export type Demo =
  /** A mark inside a bordered panel, so the gap reads on all four sides. */
  | "inset"
  /** Two panels of different declared sizes, side by side. */
  | "sizes"
  /** Three items in a row: distribution and alignment are the point. */
  | "row"
  /** A grid of N cells, with the column count itself visible. */
  | "cells"
  /** Three overlapping cards, because an order needs something to order. */
  | "stack"
  /** A run of prose, because type is read rather than seen. */
  | "prose"
  /** The filled element itself, wearing the foreground its fill declares. */
  | "fill"
  /** An elevated panel over a contrasting backdrop, so the shadow has air. */
  | "lifted"
  /** A fill at the given alpha over stripes, so partial opacity is legible. */
  | "faded"
  /** Two elements, one of them moving: motion is the point. */
  | "motion"
  /** A panel with a visible edge, and a second panel to measure the offset. */
  | "edge"
  /** A panel holding two marked rows, so the rule BETWEEN them is visible. */
  | "ruled"
  /** Content larger than its own box, because the clipping is the demo. */
  | "clipped"
  /** Text saying what it is. */
  | "said";

/**
 * What each sample IS, and why that sample and not another. Carried as data so
 * the reference can label a column without a second hand-written list drifting
 * away from this one.
 */
export const DEMO_SAMPLE: Readonly<Record<Demo, string>> = {
  inset:
    "A marked element inside a bordered panel, so the gap reads on all four sides.",
  sizes:
    "Two panels of different declared sizes, side by side, so the sizes compare.",
  row:
    "Three items in a row, because a distribution needs more than one item to show.",
  cells:
    "A grid of as many cells as the class declares columns for, so the column count is visible.",
  stack:
    "Three overlapping cards, so the order has something to order.",
  prose:
    "A run of prose, because type is read rather than seen.",
  fill:
    "The filled element itself, with its label in the `on-*` foreground the theme pairs with that fill.",
  lifted:
    "An elevated panel over a contrasting backdrop, so the shadow has air.",
  faded:
    "A fill at the class's own alpha over a striped backdrop, so partial opacity reads as partial.",
  motion:
    "Two elements, one of them moving, so the movement is visible.",
  edge:
    "A panel with a visible edge beside a second panel, so the ring or outline reads against what it is drawn outside of.",
  ruled:
    "A panel holding two marked rows, so the rule between them is visible.",
  clipped:
    "Content larger than its box, so the clipping is visible.",
  said:
    "The utility's name as words, because the family acts on the pointer, the selection, or the scroller.",
};

/**
 * The sample per catalog group.
 *
 * Keyed by the ids `describeCatalog` publishes, so a family that gains a group
 * is mapped by adding a row here and nowhere else. A group with no row returns
 * `undefined`: an unmapped family is a hole to see, and a wrong sample would be
 * worse than an absent one.
 */
const GROUP_DEMO: Readonly<Record<string, Demo>> = {
  // Colour: the element IS the swatch, and its foreground comes from the theme.
  background: "fill",
  tones: "fill",
  // Text colour is read, not seen: a swatch says nothing about a paragraph.
  "text-color": "prose",

  // Spacing. `gap` is the space BETWEEN items, so it needs the three-item row;
  // padding and margin are read against a panel's edge on all four sides.
  padding: "inset",
  margin: "inset",
  gap: "row",
  divide: "ruled",

  // Type is read, so every family that changes a glyph gets prose.
  "type-size": "prose",
  font: "prose",
  text: "prose",
  typography: "prose",
  "text-decoration": "prose",

  // Edges, corners, and the elevation that separates them.
  border: "edge",
  radius: "edge",
  shadow: "lifted",

  // Layout: distribution, alignment, and how children stack at all.
  layout: "row",
  display: "row",
  grid: "cells",
  sizing: "sizes",
  position: "stack",

  opacity: "faded",
  overflow: "clipped",
  transitions: "motion",

  // Pointer behaviour and state prefixes.
  interactivity: "said",
  variants: "said",
};

/**
 * The sample a catalog group is demonstrated with, or `undefined` when the
 * group is not one this file knows about.
 */
export function demoFor(group: string): Demo | undefined {
  return GROUP_DEMO[group];
}

/**
 * A value that SHOWS what a family does.
 *
 * `translate-x-1` is a quarter of a rem, which on a mark under three rem wide
 * is invisible — correct, and useless as a demonstration. A reference entry has
 * to make the difference legible, so a utility whose effect cannot be seen at
 * its smallest step is shown at a step where it can. This is not the utility
 * being demonstrated; it is the family's EFFECT, and the entry still names the
 * real class and shows what it really emits.
 *
 * Every row states why the named value is more visible than the smallest step
 * of the same family. A value that needs no such argument is the utility
 * itself, and belongs in the catalog rather than here.
 */
export const DEMO_VALUE: Readonly<Record<string, string>> = {
  // A translation of a quarter rem is a quarter rem; at two rem it is a move.
  "translate-x-1": "translate-x-8",
  "translate-y-1": "translate-y-8",
  // Five and ten percent of an alpha over stripes is a hairline; three quarters
  // of the stripes showing through is unmistakable, and it is the same fill.
  "opacity-5": "opacity-75",
  "opacity-10": "opacity-75",
  // -0.05em is under a pixel at 1rem, and -0.025em is half of that. Widening is
  // the same axis read in the other direction, at a size an eye catches.
  "tracking-tighter": "tracking-widest",
  "tracking-tight": "tracking-wider",
};

/** The class a demo shows, which is not always the class it names. */
export function demoClass(name: string): string {
  return DEMO_VALUE[name] ?? name;
}

/**
 * What a group cannot show in a picture, said plainly.
 *
 * These families are not missing a sample — they are effects that only exist
 * while something is happening to them: a pointer over the element, a
 * selection being dragged, a scroller moving, a state prefix matching. A
 * rendered swatch for `cursor-not-allowed` would be a picture of a box with a
 * cursor drawn next to it, which proves nothing and looks like a feature. So
 * the reference says what it cannot show instead of faking it.
 */
const NOT_IN_A_PICTURE: Readonly<Record<string, string>> = {
  interactivity:
    "A cursor, a selection, a pointer-event and a scroller each need an interaction to be seen.",
  variants:
    "A variant applies only while its prefix matches, such as hover or focus.",
  transitions:
    "A transition needs two states to move between.",
};

/**
 * The sentence a group owes the reader when its effect cannot be rendered, or
 * `undefined` when the sample already shows the truth.
 */
export function noteFor(group: string): string | undefined {
  return NOT_IN_A_PICTURE[group];
}