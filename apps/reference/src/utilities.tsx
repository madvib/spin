import { createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
  buildScale,
  type BuiltScale,
  describeCatalog,
  EDGE_AXES,
  scaleClass,
  type Section,
  SECTIONS,
  utilitiesFor,
} from "@spinjs/preset";
import {
  designLanguages,
  indexTree,
  inkTokens,
  isDesignLanguage,
  LOOP_STEP,
  parseTokens,
  resolveAliases,
  type TokenTree,
} from "@spinjs/theme";

/* ──────────────────────────────────────────────────────────────────────────
 * THE UTILITIES SURFACE.
 *
 * A section is a set of catalog groups, and a group is a set of utilities with
 * one mechanism between them. Each group gets: what it is, why this sample,
 * a working before-and-after of the idea, and then every one of its names
 * shown. Nothing is summarised away and nothing is listed without being
 * demonstrated.
 *
 * Everything the page wears is a utility our own surface carries, so the
 * chrome around a demonstration is drawn by the surface being demonstrated:
 * if a utility breaks, the showcase's own chrome breaks with it.
 * ────────────────────────────────────────────────────────────────────────── */

/** The theme's own tree, parsed once and shared across every render. */
let themeTree: TokenTree | undefined;
function themeTreeOrParse(): TokenTree {
  if (themeTree === undefined) {
    const parsed = parseTokens(
      designLanguages.minimal,
    );
    if (!parsed.ok) throw new Error(parsed.error);
    themeTree = parsed.tree;
  }
  return themeTree;
}

/**
 * Each color token's value, by the name the catalog spells it, for one theme
 * and one mode.
 *
 * A swatch is a color a reader can identify, so its label carries the value it
 * resolves to rather than the reference it is declared with: `bg-text` holds
 * `var(--color-text)`, which is a name and not a color, while the value it
 * lands on is the whole point of the row. Aliases are followed, so a role
 * derived from the ramp shows the ramp's step. The theme's base value is the
 * one named: a mode's override is the same token rendered another way, so the
 * `dark` group is read first and the base value is what a token the dark group
 * does not restate keeps. A theme with no dark group overrides nothing.
 */
function colorValues(
  theme: string,
  mode: string,
): Readonly<Record<string, string>> {
  if (!isDesignLanguage(theme)) return {};
  const doc = designLanguages[theme];
  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);
  const index = indexTree(resolveAliases(parsed.tree).tree);
  const out: Record<string, string> = {};
  for (const leaf of Object.values(index.leaves)) {
    if (leaf.path[0] !== "color") continue;
    if (typeof leaf.value !== "string") continue;
    // The mode's own restatement of this token, by its path in the dark group.
    const dark = index.leaves[`dark.${leaf.path.join(".")}`];
    out[leaf.path.slice(1).join("-")] = mode === "dark" &&
        dark !== undefined && typeof dark.value === "string"
      ? dark.value
      : leaf.value;
  }
  return out;
}

/** The values the utilities pages read, for the theme they demonstrate. */
const COLOR_VALUES: Readonly<Record<string, string>> = colorValues(
  "minimal",
  "base",
);

/* ──────────────────────────────────────────────────────────────────────────
 * SAMPLES — what a utility acts ON, decided per family.
 *
 * Every sample is built from our own utilities, which is the point of the
 * whole exercise. A sample has to be the thing the utility acts on, and it
 * has to be a situation where the effect is LEGIBLE — three items and not
 * one, because one item cannot demonstrate a distribution; three overlapping
 * cards and not one, because one card has no "above".
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A demonstrable sample, named for what the family acts on rather than for what
 * it looks like. `row` is three items because one cannot show a distribution;
 * `said` is text, because a cursor cannot be shown.
 */
type Demo =
  | "inset"
  | "sizes"
  | "row"
  | "cells"
  | "stack"
  | "prose"
  | "fill"
  | "lifted"
  | "faded"
  | "motion"
  | "edge"
  | "ruled"
  | "clipped"
  | "said";

/** What each sample IS, and why that sample and not another. */
const DEMO_SAMPLE: Readonly<Record<Demo, string>> = {
  inset:
    "A marked element inside a bordered panel, so the gap reads on all four sides.",
  sizes:
    "Two panels of different declared sizes, side by side, so the sizes compare.",
  row:
    "Three items in a row, because a distribution needs more than one item to show.",
  cells:
    "A grid of as many cells as the class declares columns for, so the column count is visible.",
  stack: "Three overlapping cards, so the order has something to order.",
  prose: "A run of prose, because type is read rather than seen.",
  fill:
    "The filled element itself, with its label in the `on-*` foreground the theme pairs with that fill.",
  lifted:
    "An elevated panel over a contrasting backdrop, so the shadow has air.",
  faded:
    "A fill at the class's own alpha over a striped backdrop, so partial opacity reads as partial.",
  motion: "Two elements, one of them moving, so the movement is visible.",
  edge:
    "A panel with a visible edge beside a second panel, so the ring or outline reads against what it is drawn outside of.",
  ruled:
    "A panel holding two marked rows, so the rule between them is visible.",
  clipped: "Content larger than its box, so the clipping is visible.",
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
  background: "fill",
  tones: "fill",
  "text-color": "prose",

  padding: "inset",
  margin: "inset",
  gap: "row",
  divide: "ruled",

  "font-style": "prose",
  text: "prose",
  typography: "prose",
  "text-decoration": "prose",

  border: "edge",
  radius: "edge",
  shadow: "lifted",

  layout: "row",
  display: "row",
  grid: "cells",
  sizing: "sizes",
  position: "stack",

  opacity: "faded",
  overflow: "clipped",
  transitions: "motion",

  interactivity: "said",
  variants: "said",
};

/** The sample a catalog group is demonstrated with, or `undefined`. */
function demoFor(group: string): Demo | undefined {
  return GROUP_DEMO[group];
}

/**
 * A value that SHOWS what a family does.
 *
 * A utility whose effect cannot be seen at its smallest step is shown at a step
 * where it can. This is not the utility being demonstrated; it is the family's
 * EFFECT, and the entry still names the real class.
 */
const DEMO_VALUE: Readonly<Record<string, string>> = {
  "translate-x-1": "translate-x-8",
  "translate-y-1": "translate-y-8",
  "opacity-5": "opacity-75",
  "opacity-10": "opacity-75",
};

/** The class a demo shows, which is not always the class it names. */
function demoClass(name: string): string {
  return DEMO_VALUE[name] ?? name;
}

/**
 * What a group cannot show in a picture, said plainly.
 *
 * These families are effects that only exist while something is happening to
 * them, so the reference says what it cannot show instead of faking it.
 */
const NOT_IN_A_PICTURE: Readonly<Record<string, string>> = {
  interactivity:
    "A cursor, a selection, a pointer-event and a scroller each need an interaction to be seen.",
  variants:
    "A variant applies only while its prefix matches, such as hover or focus.",
  transitions: "A transition needs two states to move between.",
};

/** The sentence a group owes the reader when its effect cannot be rendered. */
function noteFor(group: string): string | undefined {
  return NOT_IN_A_PICTURE[group];
}

/* ──────────────────────────────────────────────────────────────────────────
 * SCALES — which catalog groups are scales, and how each is shaped.
 *
 * The shape is a prefix and its axes, which is what lets a group be split into
 * steps and modifiers without anyone listing forty-two names.
 * ────────────────────────────────────────────────────────────────────────── */

const SCALE_SHAPES: Record<
  string,
  {
    title: string;
    blurb: string;
    axes?: readonly { key: string; label: string }[];
  }
> = {
  padding: {
    title: "Padding",
    blurb:
      "Space inside an element. Seven steps, and each step applies to any edge.",
    axes: EDGE_AXES,
  },
  margin: {
    title: "Margin",
    blurb: "Space outside an element. Same steps as padding, the same edges.",
    axes: EDGE_AXES,
  },
  gap: {
    title: "Gap",
    blurb:
      "Space between items in a flex or grid row, or between rows. The x and " +
      "y axes live below the preview, because a single value cannot name both.",
  },
  radius: {
    title: "Radius",
    blurb: "Corner rounding, from square to a full pill.",
  },
  opacity: {
    title: "Opacity",
    blurb: "How solid an element is. Read against stripes, because a partial " +
      "opacity over a flat fill looks like a bug rather than a step.",
  },
};

const SCALE_PREFIX: Record<string, string> = {
  padding: "p",
  margin: "m",
  gap: "gap",
  radius: "rounded",
  opacity: "opacity",
};

/** The axis a scale with no modifiers is drawn on: the prefix itself. */
const ONE_AXIS: readonly { key: string; label: string }[] = [
  { key: "", label: "only" },
];

/** The scale for a catalog group, or undefined if it is not one. */
function scaleFor(
  group: string,
  raw: { id: string; utilities: readonly string[] },
): BuiltScale | undefined {
  const shape = SCALE_SHAPES[group];
  const prefix = SCALE_PREFIX[group];
  if (shape === undefined || prefix === undefined) return undefined;
  // A scale with no axes still has one: `buildScale` only accepts an axis it
  // has been told about, so an omitted list matches nothing and the scale
  // renders with zero steps. Saying so is both the truth and the fix.
  return buildScale(raw, { prefix, axes: shape.axes ?? ONE_AXIS }, {
    title: shape.title,
    blurb: shape.blurb,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * THE LAYOUT SURFACE — mechanisms, not a matrix.
 *
 * None of these utilities is visible on its own — `justify-between` is a line
 * with three items ON it, `top-4` is a distance FROM something. So the section
 * is cut by MECHANISM: what an element can be told to do.
 * ────────────────────────────────────────────────────────────────────────── */

/** CSS `display` and `visibility`, spelled the way a utility spells them. */
const DISPLAY_KEYWORD =
  /^(?:block|inline|flex|grid|contents)(?:-(?:block|inline|flex|grid))?$|^(?:hidden|visible|invisible|collapse)$/;

/** CSS `position`: five values, and every one of them is a bare name. */
const POSITION_KEYWORD = /^(?:static|relative|absolute|fixed|sticky)$/;

/** PREFIX to mechanism. The lookup decides which prefix is longest. */
const PREFIX_MECHANISM: Readonly<Record<string, string>> = {
  inset: "inset",
  top: "inset",
  right: "inset",
  bottom: "inset",
  left: "inset",
  grow: "grow-shrink",
  shrink: "grow-shrink",
  order: "order",
  "grid-cols": "grid-columns",
  "grid-rows": "grid-rows",
  "grid-flow": "grid-flow",
  col: "grid-placement",
  row: "grid-placement",
  justify: "justify",
  content: "align-content",
  items: "align-items",
  self: "align-self",
  overflow: "overflow",
  z: "position",
};

/** Prefixes that name a PROPERTY FAMILY rather than a property. */
const SEGMENT_MECHANISM: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  flex: {
    row: "flex-direction",
    col: "flex-direction",
    wrap: "flex-wrap",
    nowrap: "flex-wrap",
    basis: "sizing-basis",
    grow: "grow-shrink",
    shrink: "grow-shrink",
    "1": "sizing-basis",
    auto: "sizing-basis",
    initial: "sizing-basis",
    none: "sizing-basis",
  },
};

/** Where a name goes when no mechanism claims it. */
const UNCLAIMED = "unclaimed";

/** The mechanism that owns a utility name, DERIVED from the shape of the name. */
function mechanismOf(name: string): string {
  if (DISPLAY_KEYWORD.test(name)) return "display";
  if (POSITION_KEYWORD.test(name)) return "position";
  const segments = name.split("-");
  const prefix = segments[0];
  const longer = segments.slice(0, 2).join("-");
  const byProperty = PREFIX_MECHANISM[longer] ?? PREFIX_MECHANISM[prefix];
  if (byProperty !== undefined) return byProperty;
  const bySegment = SEGMENT_MECHANISM[prefix];
  if (bySegment !== undefined) return bySegment[segments[1]] ?? UNCLAIMED;
  return UNCLAIMED;
}

const CAP = "type-code text-muted";

/** Three distinct fills, so which item is which is never a guess. */
const FILL = ["bg-surface-sunken", "bg-primary text-on-primary", "bg-secondary text-on-secondary"] as const;

/**
 * Sizes here are SCALE steps, not wind4's. Our spacing scale is
 * `0,1,2,4,8,16` — `w-64` and `h-32` are not utilities and generate nothing,
 * so a frame sized in them collapses to its content.
 */
const BOX =
  "relative h-16 w-1/3 shrink-0 rounded-sm border bg-surface-raised p-1";
const TALL =
  "relative h-16 w-1/4 shrink-0 rounded-sm border bg-surface-raised p-1";
const NARROW =
  "relative h-16 w-16 shrink-0 rounded-sm border bg-surface-raised p-1";
const FLEXBOX = `${BOX} flex`;
const TALLFLEX = `${TALL} flex`;
const NARROWFLEX = `${NARROW} flex`;
const TALLGRID = `${TALL} grid`;
const LINES = `${NARROW} flex flex-col flex-wrap`;
const CARD = "absolute h-8 w-16 rounded-sm border";

/** Three items, because one item cannot show a distribution. */
function Tiles(props: { n: number; cls?: string; size?: string }) {
  return (
    <For each={Array.from({ length: props.n }, (_, i) => i)}>
      {(i) => (
        <b
          class={`block ${props.size ?? "h-4 w-8"} shrink-0 rounded-sm ${
            FILL[i % FILL.length]
          } ${props.cls ?? ""}`}
        />
      )}
    </For>
  );
}

/** Three items, each wearing its own class, so a mechanism can act on a MIDDLE
 *  item while its neighbours stay the control. */
function Trio(props: { first: string; mid: string; last: string }) {
  return (
    <For each={[props.first, props.mid, props.last]}>
      {(c, i) => (
        <b
          class={`block h-4 w-8 shrink-0 rounded-sm ${
            FILL[i() % FILL.length]
          } ${c}`}
        />
      )}
    </For>
  );
}

/** Three items with their names in them, for the mechanisms where WHICH item
 *  moved is the whole demonstration. */
function Spelled(props: { n: number; cls?: readonly string[] }) {
  return (
    <For each={Array.from({ length: props.n }, (_, i) => i)}>
      {(i) => (
        <b
          class={`block h-4 w-8 shrink-0 rounded-sm bg-surface-sunken text-center type-code ${
            props.cls?.[i] ?? ""
          }`}
        >
          {"abc"[i]}
        </b>
      )}
    </For>
  );
}

/** The six items of a grid demonstration, the first one placed. */
function Placed(props: { cls: string }) {
  return (
    <>
      <b class={`h-4 rounded-sm bg-accent text-on-accent ${props.cls}`} />
      <Tiles n={6} size="h-4" />
    </>
  );
}

/** Three items of different heights, because equal ones align identically. */
function Mixed() {
  return (
    <For each={["h-2", "h-8", "h-16"]}>
      {(h, i) => (
        <b
          class={`block w-8 shrink-0 rounded-sm ${
            FILL[i() % FILL.length]
          } ${h}`}
        />
      )}
    </For>
  );
}

/** One mechanism demonstrated: a labelled box wearing the class under test. */
function Figure(props: {
  cls: string;
  label: string;
  box?: string;
  overflow?: string;
  children: JSX.Element;
}) {
  return (
    <figure
      class={`flex w-1/3 shrink-0 min-w-0 flex-col items-start gap-1 ${
        props.overflow ?? "overflow-hidden"
      }`}
    >
      <div class={`${props.box ?? BOX} ${props.cls}`}>{props.children}</div>
      <code class={CAP}>{props.label}</code>
    </figure>
  );
}

/** A frame with items competing for one spot — the only arrangement in which
 *  the positioning schemes differ from each other. */
function Frame(props: { children: JSX.Element }) {
  return (
    <div class="relative h-16 w-1/2 min-w-0 rounded-sm border border-dashed bg-surface">
      {props.children}
    </div>
  );
}

/** Three cards in one frame, each wearing the same class under test. */
function Cards(props: { extra: string; offsets: readonly string[] }) {
  return (
    <Frame>
      <For each={props.offsets}>
        {(o, i) => (
          <b
            class={`${CARD} ${FILL[i() % FILL.length]} ${o} ${props.extra}`}
          />
        )}
      </For>
    </Frame>
  );
}

interface Mechanism {
  readonly id: string;
  readonly title: string;
  readonly blurb: string;
  /** The sample its name rail is drawn in. */
  readonly demo: Demo;
  /** One working demonstration, or `null` when the mechanism owns no vocabulary. */
  readonly sample: () => JSX.Element | null;
}

const OVERFLOW_BOX =
  "relative flex h-16 w-1/4 shrink-0 rounded-sm border bg-surface-raised p-1";

const MECHANISMS: readonly Mechanism[] = [
  {
    id: "display",
    title: "Display",
    blurb:
      "What kind of box an element generates, and therefore which of the " +
      "mechanisms below it can act at all. A block takes the full width, a " +
      "flex or grid box becomes a container and hands its children to a " +
      "distribution, contents gives its own box away so the parent adopts its " +
      "children, and hidden takes the element off the page entirely.",
    demo: "row",
    sample: () => (
      <>
        <Figure cls="block" label="block — the items stack">
          <Tiles n={3} />
        </Figure>
        <Figure
          cls="inline-flex items-center gap-2"
          label="inline-flex — one line, side by side"
        >
          <Tiles n={3} />
        </Figure>
        <Figure cls="grid grid-cols-3 gap-1" label="grid — one track per item">
          <Tiles n={3} />
        </Figure>
        <Figure cls="hidden" label="hidden — no box, and no items either">
          <Tiles n={3} />
        </Figure>
        <Figure
          cls="contents"
          label="contents — no box at all; the items join the row around it"
        >
          <Tiles n={3} />
        </Figure>
      </>
    ),
  },
  {
    id: "position",
    title: "Position",
    blurb:
      "Whether an element is placed by the flow, taken out of it, or pinned " +
      "to something else — and, when several compete for the same spot, which " +
      "of them the reader sees. `static` ignores every offset, `relative` " +
      "offsets from where the flow would have put it, `absolute` is out of " +
      "the flow and offsets from its nearest positioned ancestor, and `z-*` " +
      "orders the overlap.",
    demo: "stack",
    sample: () => (
      <>
        <Figure
          cls=""
          label="static — the offsets are ignored, so the flow stacks them"
        >
          <Cards extra="static" offsets={["inset-1", "inset-2", "inset-4"]} />
        </Figure>
        <Figure
          cls=""
          label="relative — each offsets from where the flow would have put it"
        >
          <Cards extra="relative" offsets={["inset-1", "inset-2", "inset-4"]} />
        </Figure>
        <Figure
          cls=""
          label="absolute — out of the flow, each offset from the frame"
        >
          <Cards extra="absolute" offsets={["inset-1", "inset-2", "inset-4"]} />
        </Figure>
        <Figure
          cls=""
          label="z-modal on all three — equal z means DOM order, so the last wins"
        >
          <Cards extra="z-modal" offsets={["inset-1", "inset-2", "inset-1"]} />
        </Figure>
      </>
    ),
  },
  {
    id: "inset",
    title: "Inset",
    blurb:
      "How far an element sits from the edges of whatever it is positioned " +
      "against, measured on the axis the name gives it: `inset-4` is all four " +
      "edges, `inset-x-4` is two of them. An offset only means anything on an " +
      "element that has left the flow or declared itself a containing block.",
    demo: "stack",
    sample: () => (
      <Figure
        cls=""
        label="inset-1 · inset-1/2 · inset-x-2 inset-y-1/2 — an edge, a centre, an axis"
      >
        <Frame>
          <b class={`${CARD} bg-secondary text-on-secondary inset-1`} />
          <b class={`${CARD} bg-accent text-on-accent inset-1/2`} />
          <b class={`${CARD} bg-surface-raised inset-x-2 inset-y-1/2`} />
        </Frame>
      </Figure>
    ),
  },
  {
    id: "flex-direction",
    title: "Flex direction",
    blurb:
      "The axis the container lays its children out on. Row and column are one " +
      "distribution read in two directions, and the `-reverse` forms keep every " +
      "child's place in the DOM while flipping the line.",
    demo: "row",
    sample: () => (
      <>
        <Figure
          cls="flex-row items-center gap-2"
          label="flex-row"
          box={FLEXBOX}
        >
          <Tiles n={3} />
        </Figure>
        <Figure
          cls="flex-row-reverse items-center gap-2"
          label="flex-row-reverse — the line reads c, b, a"
          box={FLEXBOX}
        >
          <Spelled n={3} />
        </Figure>
        <Figure
          cls="flex-col items-center gap-2"
          label="flex-col"
          box={TALLFLEX}
        >
          <Tiles n={3} />
        </Figure>
        <Figure
          cls="flex-col-reverse items-center gap-2"
          label="flex-col-reverse — the same line, running upward"
          box={TALLFLEX}
        >
          <Spelled n={3} />
        </Figure>
      </>
    ),
  },
  {
    id: "flex-wrap",
    title: "Flex wrap",
    blurb:
      "Whether the children stay on one line or fold onto more. The frame " +
      "below is narrower than its three items on purpose, because a wrap is " +
      "invisible on a line with room to spare.",
    demo: "row",
    sample: () => (
      <>
        <Figure cls="flex-wrap items-center" label="flex-wrap" box={NARROWFLEX}>
          <Tiles n={3} />
        </Figure>
        <Figure
          cls="flex-wrap-reverse items-center"
          label="flex-wrap-reverse — the same fold, upward"
          box={NARROWFLEX}
        >
          <Tiles n={3} />
        </Figure>
        <Figure
          cls="flex-nowrap items-center"
          label="flex-nowrap — one line, and the frame loses"
          box={NARROWFLEX}
        >
          <Tiles n={3} />
        </Figure>
      </>
    ),
  },
  {
    id: "sizing-basis",
    title: "Sizing basis",
    blurb:
      "How much of the container an individual item claims before anything is " +
      "distributed at all. `flex-1` grows from a zero basis, while `flex-none` " +
      "takes exactly what it measures and refuses both grow and shrink.",
    demo: "row",
    sample: () => (
      <>
        <Figure
          cls="items-center"
          label="flex-1 — the third item takes what the first two left"
          box={FLEXBOX}
        >
          <Trio first="" mid="flex-1" last="" />
        </Figure>
        <Figure
          cls="items-center"
          label="flex-auto — grows from its own measured size"
          box={FLEXBOX}
        >
          <Trio first="" mid="flex-auto" last="" />
        </Figure>
        <Figure
          cls="items-center"
          label="flex-initial — no grow, no shrink; the space stays unclaimed"
          box={FLEXBOX}
        >
          <Trio first="" mid="flex-initial" last="" />
        </Figure>
        <Figure
          cls="items-center"
          label="flex-none — grow and shrink both refused"
          box={FLEXBOX}
        >
          <Trio first="" mid="flex-none" last="" />
        </Figure>
      </>
    ),
  },
  {
    id: "grow-shrink",
    title: "Grow and shrink",
    blurb:
      "Whether an item may take the space the container has left, and whether " +
      "it may give any back. Growing needs free space to be had; shrinking " +
      "needs a line that has already overflowed.",
    demo: "row",
    sample: () => (
      <>
        <Figure
          cls="items-center"
          label="grow — the middle item claims the free space"
          box={FLEXBOX}
        >
          <Trio first="" mid="grow" last="" />
        </Figure>
        <Figure
          cls="items-center"
          label="grow-0 — the middle one refuses, and the others share it"
          box={FLEXBOX}
        >
          <Trio first="grow" mid="grow-0" last="grow" />
        </Figure>
        <Figure
          cls="items-center"
          label="shrink — three items that do not fit, and all three give way"
          box={NARROWFLEX}
        >
          <Tiles n={3} size="h-4 w-16" />
        </Figure>
        <Figure
          cls="items-center"
          label="shrink-0 — they hold, and the line overflows the frame"
          box={NARROWFLEX}
        >
          <Tiles n={3} cls="shrink-0" size="h-4 w-16" />
        </Figure>
      </>
    ),
  },
  {
    id: "order",
    title: "Order",
    blurb:
      "The order items are laid out in, which is neither the order they are " +
      "written in nor the order they are read in. It changes paint order and " +
      "nothing else — the DOM is untouched.",
    demo: "row",
    sample: () => (
      <>
        <Figure cls="items-center" label="the DOM order: a, b, c" box={FLEXBOX}>
          <Spelled n={3} />
        </Figure>
        <Figure
          cls="items-center"
          label="order-last on a — the row reads c, b, a"
          box={FLEXBOX}
        >
          <Spelled n={3} cls={["order-last", "order-1", "order-1"]} />
        </Figure>
        <Figure
          cls="items-center"
          label="order-first on c alone — a tie keeps the DOM order"
          box={FLEXBOX}
        >
          <Spelled n={3} cls={["order-1", "order-1", "order-first"]} />
        </Figure>
      </>
    ),
  },
  {
    id: "grid-columns",
    title: "Grid template columns",
    blurb:
      "How many column tracks the grid has, and how it fills them. Counts are " +
      "vocabulary because a track size is a decision every theme would " +
      "otherwise have to repeat. The same six items fill every frame below.",
    demo: "cells",
    sample: () => (
      <>
        <Figure cls="grid-cols-2 gap-1" label="grid-cols-2" box={TALLGRID}>
          <Tiles n={6} size="h-4" />
        </Figure>
        <Figure cls="grid-cols-3 gap-1" label="grid-cols-3" box={TALLGRID}>
          <Tiles n={6} size="h-4" />
        </Figure>
        <Figure cls="grid-cols-6 gap-1" label="grid-cols-6" box={TALLGRID}>
          <Tiles n={6} size="h-4" />
        </Figure>
      </>
    ),
  },
  {
    id: "grid-rows",
    title: "Grid template rows",
    blurb:
      "The same decision down the other axis. A grid that names its columns " +
      "but not its rows grows one row per line of items, so a template has to " +
      "be asked for.",
    demo: "cells",
    sample: () => (
      <>
        <Figure
          cls="grid-cols-2 grid-rows-2 gap-1"
          label="grid-rows-2"
          box={TALLGRID}
        >
          <Tiles n={6} size="h-4" />
        </Figure>
        <Figure
          cls="grid-cols-2 grid-rows-3 gap-1"
          label="grid-rows-3"
          box={TALLGRID}
        >
          <Tiles n={6} size="h-4" />
        </Figure>
        <Figure
          cls="grid-cols-2 grid-rows-6 gap-1"
          label="grid-rows-6 — a row per item"
          box={TALLGRID}
        >
          <Tiles n={6} size="h-4" />
        </Figure>
      </>
    ),
  },
  {
    id: "grid-placement",
    title: "Grid placement",
    blurb:
      "How far one item reaches across the tracks the container declared. " +
      "`col-span-2` takes two of them and `col-span-full` takes all of them, " +
      "which is how a header row is written without counting columns.",
    demo: "cells",
    sample: () => (
      <>
        <Figure
          cls="grid-cols-3 grid-rows-2 gap-1"
          label="six items in three tracks, before anything is placed"
          box={TALLGRID}
        >
          <Tiles n={6} size="h-4" />
        </Figure>
        <Figure
          cls="grid-cols-3 grid-rows-2 gap-1"
          label="col-span-2 — the first item reaches across two tracks"
          box={TALLGRID}
        >
          <Placed cls="col-span-2" />
        </Figure>
        <Figure
          cls="grid-cols-3 grid-rows-2 gap-1"
          label="col-span-full — the whole row, without counting it"
          box={TALLGRID}
        >
          <Placed cls="col-span-full" />
        </Figure>
        <Figure
          cls="grid-cols-3 grid-rows-2 gap-1"
          label="row-span-2 — the same reach, down the other axis"
          box={TALLGRID}
        >
          <Placed cls="row-span-2" />
        </Figure>
      </>
    ),
  },
  {
    id: "grid-flow",
    title: "Grid auto flow",
    blurb:
      "Which way the grid places items into the tracks it has, and whether it " +
      "backfills the holes it leaves. Five items in the same two-column grid " +
      "read completely differently packed along the rows and packed down the " +
      "columns.",
    demo: "cells",
    sample: () => (
      <>
        <Figure
          cls="grid-cols-2 gap-1"
          label="the default: filled along the rows"
          box={TALLGRID}
        >
          <Tiles n={5} size="h-4" />
        </Figure>
        <Figure
          cls="grid-cols-2 grid-flow-col gap-1"
          label="grid-flow-col — filled down the columns instead"
          box={TALLGRID}
        >
          <Tiles n={5} size="h-4" />
        </Figure>
        <Figure
          cls="grid-cols-2 grid-flow-row-dense gap-1"
          label="grid-flow-row-dense — the holes are backfilled as they appear"
          box={TALLGRID}
        >
          <Tiles n={5} size="h-4" />
        </Figure>
      </>
    ),
  },
  {
    id: "justify",
    title: "Justify content",
    blurb:
      "Where the free space along the MAIN axis goes — the one mechanism a " +
      "single card could never show. One item starts, centres and spreads " +
      "identically, so every frame below holds three.",
    demo: "row",
    sample: () => (
      <>
        <Figure cls="justify-start" label="justify-start" box={FLEXBOX}>
          <Tiles n={3} />
        </Figure>
        <Figure cls="justify-center" label="justify-center" box={FLEXBOX}>
          <Tiles n={3} />
        </Figure>
        <Figure
          cls="justify-between"
          label="justify-between — the space goes BETWEEN the items"
          box={FLEXBOX}
        >
          <Tiles n={3} />
        </Figure>
        <Figure
          cls="justify-around"
          label="justify-around — each item owns the space around it"
          box={FLEXBOX}
        >
          <Tiles n={3} />
        </Figure>
        <Figure
          cls="justify-evenly"
          label="justify-evenly — the same space, edges included"
          box={FLEXBOX}
        >
          <Tiles n={3} />
        </Figure>
      </>
    ),
  },
  {
    id: "align-content",
    title: "Align content",
    blurb:
      "Where the free space across the CROSS axis goes, and only once the " +
      "container has folded onto more than one LINE. On a single line it does " +
      "nothing at all.",
    demo: "row",
    sample: () => (
      <>
        <Figure cls="content-start" label="content-start" box={LINES}>
          <Tiles n={3} size="h-2 w-8" />
        </Figure>
        <Figure cls="content-center" label="content-center" box={LINES}>
          <Tiles n={3} size="h-2 w-8" />
        </Figure>
        <Figure
          cls="content-between"
          label="content-between — the three LINES spread, not the items"
          box={LINES}
        >
          <Tiles n={3} size="h-2 w-8" />
        </Figure>
      </>
    ),
  },
  {
    id: "align-items",
    title: "Align items",
    blurb:
      "Where the items sit across the cross axis, as one decision for every " +
      "child at once. The items below are three different heights, because " +
      "equal ones align identically whichever way they are pushed.",
    demo: "row",
    sample: () => (
      <>
        <Figure cls="items-start" label="items-start" box={TALLFLEX}>
          <Mixed />
        </Figure>
        <Figure cls="items-center" label="items-center" box={TALLFLEX}>
          <Mixed />
        </Figure>
        <Figure cls="items-end" label="items-end" box={TALLFLEX}>
          <Mixed />
        </Figure>
        <Figure cls="items-stretch" label="items-stretch" box={TALLFLEX}>
          <Mixed />
        </Figure>
        <Figure
          cls="items-baseline"
          label="items-baseline — three labels sitting on one edge"
          box={TALLFLEX}
        >
          <Spelled n={3} />
        </Figure>
      </>
    ),
  },
  {
    id: "align-self",
    title: "Align self",
    blurb:
      "Where ONE item sits across the cross axis, overriding the container's " +
      "default for that child alone. It exists only because `items-*` cannot " +
      "say anything different about one of three.",
    demo: "row",
    sample: () => (
      <>
        <Figure
          cls="items-center"
          label="items-center on the box, self-start on the middle item"
          box={FLEXBOX}
        >
          <Trio first="" mid="self-start" last="" />
        </Figure>
        <Figure
          cls="items-center"
          label="self-end on the middle item"
          box={FLEXBOX}
        >
          <Trio first="" mid="self-end" last="" />
        </Figure>
        <Figure
          cls="items-center"
          label="self-stretch — one item fills the cross axis"
          box={FLEXBOX}
        >
          <Trio first="" mid="self-stretch h-16" last="" />
        </Figure>
        <Figure
          cls="items-center"
          label="self-center on the middle item"
          box={FLEXBOX}
        >
          <Trio first="" mid="self-center" last="" />
        </Figure>
        <Figure
          cls="items-center"
          label="self-auto — the container's default, restated"
          box={FLEXBOX}
        >
          <Trio first="" mid="self-auto" last="" />
        </Figure>
      </>
    ),
  },
  {
    id: "overflow",
    title: "Overflow",
    blurb:
      "What happens to content that does not fit. The three items below are " +
      "wider than their frame on purpose: visible lets them spill over their " +
      "neighbours, and every other value decides how much of that the reader " +
      "is allowed to reach.",
    demo: "clipped",
    sample: () => (
      <>
        <Figure
          cls="overflow-visible"
          label="overflow-visible"
          box={OVERFLOW_BOX}
          overflow="overflow-x-auto"
        >
          <Tiles n={3} size="h-4 w-16" />
        </Figure>
        <Figure
          cls="overflow-hidden"
          label="overflow-hidden"
          box={OVERFLOW_BOX}
          overflow="overflow-x-auto"
        >
          <Tiles n={3} size="h-4 w-16" />
        </Figure>
        <Figure
          cls="overflow-clip"
          label="overflow-clip"
          box={OVERFLOW_BOX}
          overflow="overflow-x-auto"
        >
          <Tiles n={3} size="h-4 w-16" />
        </Figure>
        <Figure
          cls="overflow-auto"
          label="overflow-auto"
          box={OVERFLOW_BOX}
          overflow="overflow-x-auto"
        >
          <Tiles n={3} size="h-4 w-16" />
        </Figure>
        <Figure
          cls="overflow-x-auto"
          label="overflow-x-auto — the axis segment narrows it to one direction"
          box={OVERFLOW_BOX}
          overflow="overflow-x-auto"
        >
          <Tiles n={3} size="h-4 w-16" />
        </Figure>
      </>
    ),
  },
  {
    id: UNCLAIMED,
    title: "Everything else these families declare",
    blurb:
      "Any name in the layout, display, position, grid or overflow groups that " +
      "no mechanism above claimed. It appears in the rail rather than listed, so a " +
      "utility can never be catalogued and quietly go undemonstrated — and if " +
      "this section is ever empty, a mechanism has taken a group it should not " +
      "have.",
    demo: "row",
    sample: () => null,
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * THE SAMPLES — the element that demonstrates a class.
 *
 * Per family, because one sample cannot demonstrate all of them: padding on an
 * empty box shows almost nothing, `top-1/2` on a static panel does nothing, and
 * a cursor is not visible in a picture at all.
 * ────────────────────────────────────────────────────────────────────────── */

/** The themes, so a swatch knows which foregrounds actually exist. */
/**
 * The foreground a fill DECLARES, as a class — or nothing.
 *
 * `bg-primary` -> `text-on-primary`, because the theme pairs them. `neutral` is a
 * RAMP rather than a pairing: eleven steps and no ink for each.
 */
function inkOn(name: string): string {
  // The theme answers which ink goes on which fill: `inkTokens()` is derived
  // from the contrast floors the theme already declares, so a fill's
  // foreground is a question the domain answers rather than a convention the
  // reference invents.
  if (!name.startsWith("bg-")) return "";
  const bare = name.slice(3);
  return inkTokens().includes(`on-${bare}`) ? `text-on-${bare}` : "";
}

/** The column count a grid utility declares, defaulting to three. */
function columnsOf(name: string): number {
  const declared = /^grid-cols-(\d+)$/.exec(name);
  if (declared === null) return 3;
  return Math.min(12, Math.max(1, Number(declared[1])));
}

/**
 * What a bare PREFIX is demonstrated on.
 *
 * `hover:` and `focus:` are catalogue entries and a prefix on its own emits no
 * declaration, so the sample carries a real declaration behind it and the label
 * still says `hover:`.
 */
const PREFIX_TARGET: Record<string, string> = {
  "hover:": "hover:bg-primary hover:text-on-primary",
  "focus:": "focus:bg-primary focus:text-on-primary",
};

/** The element carrying the class under test. */
function UnderTest(props: {
  base: string;
  cls: string;
  tag?: "i" | "p" | "span";
  children?: JSX.Element;
}) {
  return (
    <Dynamic component={props.tag ?? "i"} class={`${props.base} ${props.cls}`}>
      {props.children}
    </Dynamic>
  );
}

/** The element that demonstrates a class, per family. */
function Sample(props: { name: string; demo: Demo; group?: string }) {
  // An accessor, not a snapshot: on a scale the class changes with the step
  // and the axis, and Solid only tracks a read that happens inside the JSX.
  const cls = () => props.name;
  switch (props.demo) {
    /* A mark inside a bordered panel: the space has something to move away
       from, and all four edges read at once. */
    case "inset":
      return (
        <UnderTest
          base="inline-flex h-16 w-1/4 items-center justify-center rounded-sm border bg-surface"
          cls={cls()}
        >
          <b class="block h-4 w-4 rounded-sm bg-accent text-on-accent" />
        </UnderTest>
      );

    /* Two panels of different declared sizes: one panel's size is a claim,
       two panels' sizes are a comparison. */
    case "sizes":
      return (
        <span class="inline-flex items-end gap-2">
          <i class="block h-8 w-8 shrink-0 rounded-sm border bg-surface-raised" />
          <UnderTest
            base="block h-8 w-16 shrink-0 rounded-sm border bg-surface-raised"
            cls={cls()}
          />
        </span>
      );

    /* Three items, because a distribution cannot be demonstrated by one item.
       The container carries no gap and no alignment of its own: `gap-0` and
       `items-end` would otherwise lose to the base on sheet order. */
    case "row":
      return (
        <UnderTest
          base="inline-flex h-16 w-1/3 rounded-sm border bg-surface p-2"
          cls={cls()}
        >
          <b class="block h-4 w-4 shrink-0 rounded-sm bg-surface-raised" />
          <b class="block h-4 w-4 shrink-0 rounded-sm bg-accent text-on-accent" />
          <b class="block h-4 w-4 shrink-0 rounded-sm bg-secondary text-on-secondary" />
        </UnderTest>
      );

    /* As many cells as the class declares columns for, so the column count is
       the thing you count. */
    case "cells": {
      const columns = columnsOf(props.name);
      return (
        <UnderTest
          base="inline-grid w-1/3 gap-1 rounded-sm border bg-surface p-1"
          cls={cls()}
        >
          <For each={Array.from({ length: columns }, (_, i) => i)}>
            {() => <b class="block h-4 w-4 rounded-sm bg-accent text-on-accent" />}
          </For>
        </UnderTest>
      );
    }

    /* Three overlapping cards: an order is only legible when something
       competes for the same space. Each card sits in its own offset wrapper,
       so the class under test moves the CARD and not the wrapper. */
    case "stack":
      return (
        <span class="relative block h-16 w-1/4 shrink-0">
          <b class="absolute top-0 left-0 block">
            <UnderTest
              base="block h-8 w-16 rounded-sm border bg-neutral-300"
              cls={cls()}
            />
          </b>
          <b class="absolute top-2 left-2 block">
            <i class="block h-8 w-16 rounded-sm border bg-secondary text-on-secondary" />
          </b>
          <b class="absolute top-4 left-4 block">
            <i class="block h-8 w-16 rounded-sm border bg-surface-raised" />
          </b>
        </span>
      );

    /* A run of prose. Type is read, not seen. The text-color group drops the
       base ink: both set `color`, and the base would win on sheet
       order and every row would render the same ink. */
    case "prose": {
      const base = props.group === "text-color"
        ? "m-0 block w-1/2"
        : "m-0 block w-1/2";
      return (
        <UnderTest base={base} cls={cls()} tag="p">
          {"Handgloves & 0123 — the quick brown fox jumps over the lazy dog, and the measure is what type is for."}
        </UnderTest>
      );
    }

    /* The filled element itself. Its label takes the `on-*` foreground the
       theme pairs with that fill, and only when the theme declares one. */
    case "fill": {
      const ink = inkOn(props.name);
      const base =
        "inline-flex h-16 w-full min-w-0 items-center justify-center rounded-sm border";
      if (ink !== "") {
        return (
          <span class="block w-full min-w-0">
            <UnderTest base={base} cls={`${cls()} ${ink}`}>
              <span>Aa</span>
            </UnderTest>
          </span>
        );
      }
      return (
        <span class="flex w-full min-w-0 items-center gap-2">
          <UnderTest base={base} cls={cls()} />
          <code class="shrink-0">Aa</code>
        </span>
      );
    }

    /* An elevated panel over a contrasting backdrop: a shadow with nothing
       behind it is a shadow on nothing. */
    case "lifted":
      return (
        <span class="inline-flex h-16 w-full min-w-0 items-center justify-center rounded-md bg-surface p-4">
          <UnderTest
            base="block h-8 w-16 rounded-md border bg-surface-raised"
            cls={cls()}
          />
        </span>
      );

    /* The same fill at the class's own alpha over stripes, so a partial
       opacity reads as partial instead of as a bug. */
    case "faded":
      return (
        <span class="relative block h-16 w-full min-w-0 overflow-hidden rounded-sm border">
          <i class="absolute inset-0 flex">
            <For each={Array.from({ length: 8 }, (_, i) => i)}>
              {(i) => (
                <b
                  class={`block h-full grow rounded-none ${
                    i % 2 === 0 ? "bg-surface-sunken" : "bg-surface"
                  }`}
                />
              )}
            </For>
          </i>
          <UnderTest
            base="absolute inset-0 rounded-sm bg-accent"
            cls={cls()}
          />
        </span>
      );

    /* Two elements, one of them moving. The control carries the same hover
       targets with no transition at all, so it snaps. */
    case "motion":
      return (
        <span class="inline-flex items-center gap-2">
          <i class="block h-8 w-8 shrink-0 rounded-sm bg-surface-raised transition hover:bg-accent hover:text-on-accent hover:translate-x-4" />
          <UnderTest
            base="block h-8 w-8 shrink-0 rounded-sm bg-accent transition hover:bg-accent hover:translate-x-4"
            cls={cls()}
          />
        </span>
      );

    /* A panel beside a panel that already has a visible edge, so a ring, an
       outline or a rounded corner is read against what it is drawn outside. */
    case "edge":
      return (
        <span class="inline-flex items-center gap-2">
          <UnderTest base="block h-8 w-16 bg-surface-raised" cls={cls()} />
          <i class="block h-8 w-16 rounded-sm border bg-surface-raised" />
        </span>
      );

    /* A divide lives BETWEEN siblings, so a sample with one child can never
       show one. Two marked rows, in a column. */
    case "ruled":
      return (
        <UnderTest
          base="inline-flex w-1/3 flex-col overflow-hidden rounded-sm border bg-surface-raised"
          cls={cls()}
        >
          <b class="flex items-center gap-2 px-2 py-2 type-caption">top row</b>
          <b class="flex items-center gap-2 px-2 py-2 type-caption">bottom row</b>
        </UnderTest>
      );

    /* Overflow is a relationship between two sizes, and the small one has to
       lose: the content is deliberately larger than its box. */
    case "clipped":
      return (
        <UnderTest
          base="relative block h-16 w-1/3 rounded-sm border bg-surface-raised"
          cls={cls()}
        >
          <b class="block h-16 w-full rounded-sm bg-accent p-2 type-code text-on-accent">
            This paragraph is deliberately larger than the box around it.
          </b>
        </UnderTest>
      );

    /* Text saying what it is. */
    case "said":
      return (
        <UnderTest
          base="inline-flex w-full min-w-0 items-start gap-2 rounded-sm border p-2 type-caption text-muted"
          cls={cls()}
          tag="span"
        >
          <code>{props.name}</code>
        </UnderTest>
      );
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * THE PAGE'S OWN CLASSES.
 *
 * Every class the reference chrome itself wears, declared once. Everything
 * here is a utility our own surface carries; anything it cannot say is a gap
 * in the surface, not a stylesheet.
 * ────────────────────────────────────────────────────────────────────────── */

const PAGE_HEAD = "mb-8 flex items-start justify-between gap-4";
const KIND = "type-code text-muted";
const BADGE =
  "shrink-0 rounded-lg border bg-surface-raised px-2 py-1 type-code text-muted";
const SECTION = "mb-8";
const SUBHEAD = "mt-8 mb-2 normal-case first:mt-0";
const PROSE = "max-w-screen-md text-muted";
const FAMILY_DEMO =
  "flex flex-wrap items-start gap-4 rounded-lg border bg-surface-raised p-4";
const LEGEND = "mt-2 type-code text-muted";
const RAIL_WRAP = "mt-4 flex flex-wrap items-start gap-2";
const LABEL =
  "mb-1 type-caption-emphasized normal-case text-muted";
const PAIR = "flex flex-col items-start gap-2";
const PAIR_BOX =
  "flex min-h-16 w-1/3 min-w-0 items-center justify-center rounded-md border bg-surface p-4";
const SCALE_STAGE =
  "flex min-h-16 w-full min-w-0 items-center justify-center overflow-hidden rounded-lg border bg-surface-raised p-8";
const SCALE_CONTROLS = "mt-4 flex flex-wrap items-start gap-8";
const SCALE_GROUP = "flex flex-col items-start gap-2";
const SCALE_BUTTONS = "flex flex-wrap gap-1";
const DECL =
  "mt-4 max-w-full overflow-x-auto rounded-md border bg-surface-raised px-2 py-2 type-code text-muted";
const DECL_NAME = "type-code";
const NAME_LIST = "grid grid-cols-4 gap-2";
const SWATCH_GRID = "mt-4 grid grid-cols-4 gap-2";
const NOTE_BOX =
  "mt-4 max-w-screen-md rounded-md border bg-surface-raised p-4 text-muted";
const PANEL =
  "mb-8 rounded-lg border bg-surface p-4";
const MONO_MUTED = "type-code text-muted";
const RAIL_COUNT = "shrink-0 type-code text-muted";
const CHIP =
  "inline-flex min-h-0 items-center gap-1 rounded-full border bg-surface-raised px-2 py-1 type-code normal-case whitespace-nowrap text-muted not-italic shadow-none cursor-pointer hover:border-strong disabled:cursor-not-allowed disabled:opacity-40 aria-[current]:border-strong";

/* ──────────────────────────────────────────────────────────────────────────
 * THE PAGE — families, scales, and the layout surface.
 * ────────────────────────────────────────────────────────────────────────── */

/** The page heading every family page carries. */
function PageHead(props: { title: string; sub: string; badge: string }) {
  return (
    <header class={PAGE_HEAD}>
      <div>
        <h2>{props.title}</h2>
        <div class={KIND}>{props.sub}</div>
      </div>
      <span class={BADGE}>{props.badge}</span>
    </header>
  );
}

/**
 * One swatch: the color, the name that spends it, and the value it resolves
 * to. The name the catalog gives the utility is the row's subject, so it is
 * spelled first and in full ink; the value is the answer a reader came for.
 *
 * The values come in, because the theme is a choice the reader makes: the
 * fill is a class and so follows the theme on its own, but the label names a
 * hex and has to be told which theme's hex it is.
 */
function Swatch(props: {
  name: string;
  values: Readonly<Record<string, string>>;
}) {
  const bare = props.name.startsWith("bg-")
    ? props.name.slice(3)
    : props.name.slice(5);
  return (
    <div class="flex items-center gap-2 rounded-md border bg-surface-raised p-2">
      <i
        class="block h-8 w-8 shrink-0 rounded-sm border"
        style={{ background: props.values[bare] }}
      />
      <span class="min-w-0">
        <code class="block truncate">
          {props.name}
        </code>
        <span class="block truncate type-code text-muted">
          {props.values[bare] ?? ""}
        </span>
      </span>
    </div>
  );
}

/**
 * The palette as a grid rather than a rail of full-width fills.
 *
 * A color utility is a NAME and a VALUE; a box the width of the page showing
 * one fill says the value and nothing else, and thirty-five of them is a wall.
 * A swatch is both, and a grid of them is a palette a reader can scan.
 */
function SwatchGrid(props: { names: readonly string[] }) {
  return (
    <div class={SWATCH_GRID}>
      <For each={props.names}>
        {(name) => <Swatch name={name} values={COLOR_VALUES} />}
      </For>
    </div>
  );
}

/** One cell of a specimen: the sample, and the name of the class on it. */
function Cell(props: { name: string; demo?: Demo; children: JSX.Element }) {
  // overflow-hidden clips the overflow; overflow-x-auto for the clipped demo,
  // where clipping the frame would hide the very escape the utility shows.
  const overflow = props.demo === "clipped"
    ? "overflow-x-auto"
    : "overflow-hidden";
  return (
    <figure
      class={`flex w-1/3 shrink-0 min-w-0 flex-col items-start gap-1 ${overflow}`}
    >
      {props.children}
      <code class={MONO_MUTED}>{props.name}</code>
    </figure>
  );
}

/**
 * The live rail: every one of a family's names, each on its own element.
 *
 * This is where the "one card per utility" failure stops. A rail is the name
 * on a live element and nothing else, so a hundred position utilities cost a
 * hundred small elements instead of a page of furniture.
 */
function NameRail(props: {
  groupId: string;
  demo: Demo;
  names: readonly string[];
}) {
  return (
    <div class={RAIL_WRAP}>
      <For each={props.names}>
        {(name) => {
          const promoted = demoClass(name);
          const shown = promoted.endsWith(":")
            ? PREFIX_TARGET[promoted] ?? promoted
            : promoted;
          return (
            <Cell name={name} demo={props.demo}>
              <Sample name={shown} demo={props.demo} group={props.groupId} />
            </Cell>
          );
        }}
      </For>
    </div>
  );
}

/**
 * The two boxes a family's idea is shown in: the same element with the class
 * off, and the same element with it on. A before and an after, because a
 * reference entry that shows only the result tells a reader nothing they could
 * not get from the source.
 */
function BeforeAfter(props: { group: string; demo: Demo; cls: string }) {
  // For the clipped demo, the frame must not clip the inner element's
  // overflow — that would demonstrate the opposite of the utility.
  const overflow = props.demo === "clipped"
    ? "overflow-x-auto"
    : "overflow-hidden";
  return (
    <div class={FAMILY_DEMO}>
      <figure class={PAIR}>
        <div class={`${PAIR_BOX} ${overflow}`}>
          <Sample name="" demo={props.demo} group={props.group} />
        </div>
        <code class={LEGEND}>without</code>
      </figure>
      <figure class={PAIR}>
        <div class={`${PAIR_BOX} ${overflow}`}>
          <Sample name={props.cls} demo={props.demo} group={props.group} />
        </div>
        <code class={LEGEND}>{props.cls}</code>
      </figure>
    </div>
  );
}

/** The interactivity bench: the utilities that only exist under a pointer. */
function VariantsBench() {
  return (
    <div class={PANEL}>
      <div class={LABEL}>the prefix applies while you are here</div>
      <div class={RAIL_WRAP}>
        <div class="group flex w-1/3 shrink-0 flex-col items-start gap-2">
          <span class={MONO_MUTED}>hover the box, not the label</span>
          <i class="block h-16 w-full rounded-sm bg-surface-raised transition-colors group-hover:bg-accent group-hover:text-on-accent" />
        </div>
        <button
          type="button"
          class={`bare ${CHIP} transition hover:border-primary focus:border-accent active:scale-95`}
        >
          hover, focus and press me
        </button>
        <span class="inline-flex w-1/3 shrink-0 items-start gap-2 rounded-sm border border-dashed p-2 type-caption text-muted">
          nothing here is a still picture: every state below exists only while a
          pointer is over it, it holds focus, or it is pressed
        </span>
      </div>
    </div>
  );
}

/** The interactivity bench: the utilities that only exist under a pointer. */
function InteractivityBench() {
  return (
    <div class={PANEL}>
      <div class={LABEL}>try these rather than look at them</div>
      <div class={RAIL_WRAP}>
        <div class="flex h-16 w-1/3 shrink-0 cursor-grab flex-col gap-1 overflow-auto rounded-md border bg-surface-raised p-2 select-none resize-y">
          <span class={MONO_MUTED}>grab · scroll · resize</span>
          <For each={Array.from({ length: 12 }, (_, i) => i + 1)}>
            {(i) => (
              <span class="shrink-0 rounded-sm bg-surface px-2 py-1 type-code">
                row {i}
              </span>
            )}
          </For>
        </div>
        <div class="w-1/3 shrink-0 rounded-md border bg-surface-raised p-2 select-text">
          <span class={MONO_MUTED}>drag across this text</span>
          <p>
            Selection is a property of the pointer and the document, not of a
            picture.
          </p>
        </div>
        <span class="pointer-events-none w-1/4 shrink-0 rounded-md border border-dashed p-2 type-caption text-muted">
          pointer-events-none: this box cannot be pointed at, and cannot be
          proven by a screenshot.
        </span>
      </div>
    </div>
  );
}

/**
 * The theme's motion steps, read from the theme.
 *
 * The page shows the theme's OWN steps, so a theme that names its durations
 * something else shows those: a list written here would be the reference
 * app's idea of a theme's vocabulary, and a theme that disagreed with it
 * would be shown boxes naming classes that do not exist.
 */
function motionSteps(): readonly { name: string; value: string }[] {
  const index = indexTree(resolveAliases(themeTreeOrParse()).tree);
  const out: { name: string; value: string }[] = [];
  for (const [path, leaf] of Object.entries(index.leaves)) {
    if (!path.startsWith("motion.duration.")) continue;
    if (typeof leaf.value !== "string") continue;
    out.push({
      name: path.slice("motion.duration.".length),
      value: leaf.value,
    });
  }
  return out;
}

/**
 * The duration a box wears when the row under test is not the duration.
 *
 * The theme's own base step when it has one, and its first step when it does
 * not: a class named here that the theme does not carry would be a box that
 * does not move, which is the one thing this bench cannot show.
 */
function neutralDuration(steps: readonly { name: string }[]): string {
  const transitions = steps.filter((step) => step.name !== LOOP_STEP);
  const chosen = transitions.find((step) => step.name === "base") ??
    transitions[0];
  return chosen === undefined ? "" : `duration-${chosen.name}`;
}

/**
 * The transitions bench: the utilities that only exist while something is
 * moving. Three comparisons — what moves, how long it takes, how it travels —
 * each on boxes the reader hovers.
 */
function TransitionsBench() {
  // Every box changes the same four things on hover; the class under test
  // decides which of them actually transition.
  const property = [
    "transition-all",
    "transition-colors",
    "transition-transform",
    "transition-opacity",
    "transition-shadow",
    "transition-none",
  ];
  const steps = motionSteps();
  // The loop is a duration but not a transition's: it is the period of an
  // endless animation, and it is spent by the animations themselves rather
  // than by a class. The bench shows it on its own, below.
  const duration = steps
    .filter((step) => step.name !== LOOP_STEP)
    .map((step) => `duration-${step.name}`);
  const loop = steps.find((step) => step.name === LOOP_STEP);
  const neutral = neutralDuration(steps);
  const easing = [
    "ease-linear",
    "ease-standard",
    "ease-decelerate",
    "ease-accelerate",
  ];
  return (
    <div class={PANEL}>
      <div class={LABEL}>hover a box — the movement is the demonstration</div>
      <div class="flex flex-col gap-8">
        <div>
          <div class={LABEL}>what moves</div>
          <div class={RAIL_WRAP}>
            <For each={property}>
              {(cls) => (
                <div class="flex w-1/3 shrink-0 flex-col items-start gap-1">
                  <i
                    class={`block h-16 w-16 rounded-sm bg-surface-raised ${cls} ${neutral} ease-standard hover:bg-accent hover:text-on-accent hover:translate-x-8 hover:opacity-50 hover:shadow-lg`}
                  />
                  <code class={CAP}>{cls}</code>
                </div>
              )}
            </For>
          </div>
        </div>
        <div>
          <div class={LABEL}>how long it takes</div>
          <div class={RAIL_WRAP}>
            <For each={duration}>
              {(cls) => (
                <div class="flex w-1/3 shrink-0 flex-col items-start gap-1">
                  <i
                    class={`block h-16 w-16 rounded-sm bg-surface-raised transition-all ${cls} ease-standard hover:bg-accent hover:text-on-accent hover:translate-x-8`}
                  />
                  <code class={CAP}>{cls}</code>
                </div>
              )}
            </For>
          </div>
        </div>
        <div>
          <div class={LABEL}>how it travels</div>
          <div class={RAIL_WRAP}>
            <For each={easing}>
              {(cls) => (
                <div class="flex w-1/4 shrink-0 flex-col items-start gap-1">
                  <i
                    class={`block h-16 w-16 rounded-sm bg-surface-raised transition-all ${neutral} ${cls} hover:bg-accent hover:text-on-accent hover:translate-x-8`}
                  />
                  <code class={CAP}>{cls}</code>
                </div>
              )}
            </For>
          </div>
        </div>
        <Show when={loop}>
          {(step) => (
            <div>
              <div class={LABEL}>what loops</div>
              <div class={RAIL_WRAP}>
                <div class="flex w-1/3 shrink-0 flex-col items-start gap-1">
                  <i class="block h-16 w-16 rounded-sm bg-surface-raised animate-spin" />
                  <code class={CAP}>motion.duration.{step().name}</code>
                  <code class={CAP}>{step().value}</code>
                </div>
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}

/**
 * The class a family's working demonstration wears. Not the first name in the
 * group: `p-0` is the least legible member of its family.
 */
const HEADLINE: Record<string, string> = {
  background: "bg-primary",
  // The link: the one colour the contract floors as ink ON THE PAGE. A
  // theme's primary is a fill, and a fill worn as a word is a word nobody
  // can read (a brand red on a night panel measures 3.15:1).
  "text-color": "text-link",
  sizing: "w-1/2",
  divide: "divide-y divide-neutral-300",
  border: "border-4 border-dashed border-primary",
  shadow: "shadow-lg",
  font: "type-code",
  text: "text-center",
  typography: "normal-case",
  "text-decoration": "underline",
  overflow: "overflow-hidden",
  interactivity: "cursor-grab",
  variants: "hover:bg-primary",
};

/** The sentence a family owes the reader when it has no sample. */
function noSampleLead(group: string): string {
  return noteFor(group) ?? "This family has no sample declared.";
}

type Group = { id: string; title: string; utilities: readonly string[] };

/** One family: a scale, or a prose block with a working demonstration. */
function Family(props: { group: Group }) {
  const scale = scaleFor(props.group.id, props.group);
  if (scale !== undefined) {
    return <ScaleSection scale={scale} group={props.group} />;
  }

  const demo = demoFor(props.group.id);
  const note = noteFor(props.group.id);
  const headline = demoClass(
    HEADLINE[props.group.id] ?? props.group.utilities[0] ?? "",
  );
  const lead = demo === undefined
    ? noSampleLead(props.group.id)
    : DEMO_SAMPLE[demo];
  // The palette is one answer given twice: a fill and an ink over it. A swatch
  // names both, where a rail of fills showed the color and spent a page on it.
  const palette = props.group.id === "background" ||
    props.group.id === "text-color";
  // The transitions stage was a before/after pair on a still box, which
  // demonstrates nothing: the bench is the demonstration.
  const stage = demo === undefined || props.group.id === "transitions"
    ? null
    : <BeforeAfter group={props.group.id} demo={demo} cls={headline} />;
  const bench = props.group.id === "variants"
    ? <VariantsBench />
    : props.group.id === "interactivity"
    ? <InteractivityBench />
    : props.group.id === "transitions"
    ? <TransitionsBench />
    : null;

  return (
    <section class={SECTION}>
      <h3 class={SUBHEAD}>
        {props.group.title}
        <span class={`${RAIL_COUNT} ml-2`}>{props.group.utilities.length}</span>
      </h3>
      <p class={PROSE}>{lead}</p>
      {stage}
      {note !== undefined ? <p class={NOTE_BOX}>{note}</p> : null}
      {bench}
      {palette
        ? <SwatchGrid names={props.group.utilities} />
        : demo === undefined
        ? (
          <ul class={NAME_LIST}>
            <For each={props.group.utilities}>
              {(n) => (
                <li>
                  <code class={MONO_MUTED}>{n}</code>
                </li>
              )}
            </For>
          </ul>
        )
        : (
          <NameRail
            groupId={props.group.id}
            demo={demo}
            names={props.group.utilities}
          />
        )}
    </section>
  );
}

/** The buttons that pick a scale's step or axis. */
function ScaleButtons(props: {
  items: readonly { key: string; label?: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div class={SCALE_BUTTONS}>
      <For each={props.items}>
        {(it) => {
          const pressed = () => it.key === props.selected;
          return (
            // The pressed button is ALSO the aria-current one: the selected
            // state is drawn by the theme's own text-on-surface pair through
            // the `aria-[current]:` utilities, and a state the stylesheet
            // cannot see is a state it cannot draw.
            <button
              type="button"
              class={CHIP}
              aria-pressed={pressed()}
              aria-current={pressed() ? "true" : undefined}
              onClick={() => props.onSelect(it.key)}
            >
              {it.label ?? it.key}
            </button>
          );
        }}
      </For>
    </div>
  );
}

/**
 * A scale: one preview, with the steps and the axes as controls on it. The
 * step and the axis are signals, so the preview's class is derived rather than
 * rewritten in the DOM by a delegated listener.
 */
function ScaleSection(props: { scale: BuiltScale; group: Group }) {
  const [step, setStep] = createSignal(props.scale.steps[0]?.key ?? "");
  const [axis, setAxis] = createSignal(props.scale.axes[0]?.key ?? "");
  // The PREFIX, not the group id: the padding scale is spelled `p-4`, and
  // handing `scaleClass` the group name produced `padding-0`.
  const prefix = SCALE_PREFIX[props.group.id] ?? props.group.id;
  const demo = demoFor(props.group.id) ?? "inset";
  const cls = createMemo(() => scaleClass(prefix, axis(), step()));
  const shown = createMemo(() => demoClass(cls()));

  // The names a scale cannot show as steps: `gap-x-4` beside `gap-4`, or
  // `me-auto` on an edge list that has no `me`. They appear in the rail rather
  // than dropped, because a catalogue that hides names is a catalogue that
  // cannot be trusted to be complete.
  const claimed = new Set(
    props.scale.steps.flatMap((s) =>
      props.scale.axes.map((a) => scaleClass(prefix, a.key, s.key))
    ),
  );
  const rest = props.group.utilities.filter((n) => !claimed.has(n));

  return (
    <section class={SECTION}>
      <h3 class={SUBHEAD}>
        {props.scale.title}
        <span class={`${RAIL_COUNT} ml-2`}>{props.group.utilities.length}</span>
      </h3>
      <p class={PROSE}>{props.scale.blurb}</p>
      <p class={PROSE}>{DEMO_SAMPLE[demo]}</p>
      <div class={SCALE_STAGE}>
        <Sample name={shown()} demo={demo} group={props.group.id} />
      </div>
      <div class={SCALE_CONTROLS}>
        <div class={SCALE_GROUP}>
          <h4 class={LABEL}>
            step <span class={MONO_MUTED}>{props.scale.steps.length}</span>
          </h4>
          <ScaleButtons
            items={props.scale.steps}
            selected={step()}
            onSelect={setStep}
          />
        </div>
        <Show when={props.scale.axes.length > 1}>
          <div class={SCALE_GROUP}>
            <h4 class={LABEL}>
              edge <span class={MONO_MUTED}>{props.scale.axes.length}</span>
            </h4>
            <ScaleButtons
              items={props.scale.axes}
              selected={axis()}
              onSelect={setAxis}
            />
          </div>
        </Show>
      </div>
      <pre class={DECL}>
        <code class={DECL_NAME}>{cls()}</code>
      </pre>
      <Show when={rest.length > 0}>
        <h4 class={LABEL}>and the names a step cannot reach</h4>
        <NameRail groupId={props.group.id} demo={demo} names={rest} />
      </Show>
    </section>
  );
}

/** One mechanism: its prose, its demonstration, and its names. */
function MechanismBlock(props: {
  mechanism: Mechanism;
  names: readonly string[];
}) {
  const sample = props.mechanism.sample();
  return (
    <section class={SECTION}>
      <h3 class={SUBHEAD}>
        {props.mechanism.title}
        <span class={`${RAIL_COUNT} ml-2`}>{props.names.length}</span>
      </h3>
      <p class={PROSE}>{props.mechanism.blurb}</p>
      {sample === null ? null : <div class={FAMILY_DEMO}>{sample}</div>}
      <NameRail
        groupId={props.mechanism.title}
        demo={props.mechanism.demo}
        names={props.names}
      />
    </section>
  );
}

/** The layout surface, cut by mechanism rather than by catalog group. */
function LayoutSurface(props: { groups: readonly Group[] }) {
  const names = [...new Set(props.groups.flatMap((g) => g.utilities))];
  const blocks = MECHANISMS
    .map((mechanism) => ({
      mechanism,
      mine: names.filter((n) => mechanismOf(n) === mechanism.id),
    }))
    .filter((b) => b.mine.length > 0);
  return (
    <For each={blocks}>
      {(b) => <MechanismBlock mechanism={b.mechanism} names={b.mine} />}
    </For>
  );
}

/** One section of the reference, rendered. */
export function UtilitiesPage(props: { group: string }) {
  const catalog = createMemo(() => describeCatalog(themeTreeOrParse()));
  const section = createMemo(() => SECTIONS.find((x) => x.id === props.group));
  const groups = createMemo(() => {
    const sec = section();
    if (sec === undefined) return [];
    const cat = catalog();
    return sec.groups
      .map((id) => cat.find((g) => g.id === id))
      .filter((g): g is (typeof cat)[number] => g !== undefined);
  });
  return (
    <Show
      when={section()}
      fallback={
        <header class={PAGE_HEAD}>
          <h2>No such section</h2>
        </header>
      }
    >
      {(sec) => (
        <>
          <PageHead
            title={sec().title}
            sub={sec().blurb}
            badge={`${utilitiesFor(sec(), catalog()).length} names`}
          />
          <Show
            when={sec().id === "layout"}
            fallback={<For each={groups()}>{(g) => <Family group={g} />}</For>}
          >
            <LayoutSurface groups={groups()} />
          </Show>
        </>
      )}
    </Show>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * THE UTILITIES LANDING.
 *
 * The primitives landing's shape, spent on the other surface: the line the
 * thing stands for, the specimens, and the index. Here the index is the
 * sections — a card each, with the count of names the section carries — and
 * a specimen is shown for the sections where one utility's effect is legible
 * in a picture. A specimen is built out of the utilities themselves rather
 * than out of markup written to look like them: the demo IS the class, and
 * the panel it is demoed in wears the surface being demonstrated.
 * ────────────────────────────────────────────────────────────────────────── */

const SPECIMEN_PANEL =
  "flex min-h-16 items-center rounded-md border border-dashed bg-surface p-8";

/** The quiet way out of a specimen: a link-shaped button. */
const QUIET_BUTTON =
  "self-start inline-flex min-h-0 items-center gap-1 rounded-md border border-solid border-transparent bg-transparent px-2 py-1 type-code normal-case text-muted not-italic shadow-none cursor-pointer hover:border-strong";

/** The fills the palette is made of, each with the foreground it is paired
 *  with by the theme — the label is the class, so the tile is also the name. */
const FILLS = [
  "bg-primary",
  "bg-secondary",
  "bg-accent",
  "bg-semantic-success",
  "bg-semantic-warning",
  "bg-semantic-error",
  "bg-semantic-info",
] as const;

/** The type ladder: the named styles, each shown in its own voice. */
const TYPE_STEPS = [
  "type-display",
  "type-title",
  "type-heading",
  "type-lead",
  "type-body",
  "type-body-emphasized",
  "type-label",
  "type-caption",
  "type-caption-emphasized",
  "type-overline",
  "type-code",
  "type-quote",
  "type-subtitle",
] as const;

/** The spacing scale, one box per step, with a mark inside it. */
const SPACING_STEPS = ["p-1", "p-2", "p-4", "p-8"] as const;

/** Corners, and the elevation that lifts them. */
const RADIUS_STEPS = ["rounded-sm", "rounded-md", "rounded-lg", "rounded-full"];
const SHADOW_STEPS = ["shadow-sm", "shadow-md", "shadow-lg"];

/**
 * Every fill at once, each labelled with the ink the theme pairs with it.
 *
 * A fill without a declared pair carries its label BELOW it rather than on
 * it: `bg-secondary` and the neutral ramp have no `on-*` token, so painting
  * the class name on top of them is the reference inventing a foreground the
  * theme never declared — measured 1.2:1 to 3.3:1 across the languages. Only a
 * fill whose ink the theme answers gets text on it.
 */
function ColorSpecimen() {
  return (
    <div class="flex flex-wrap items-end gap-2">
      <For each={FILLS}>
        {(cls) => {
          const ink = inkOn(cls);
          return (
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <div
              class={`flex h-16 min-w-0 items-end rounded-md p-2 type-code ${cls} ${ink}`}
              >
                {ink === "" ? "" : cls}
              </div>
              <code class={MONO_MUTED}>{cls}</code>
            </div>
          );
        }}
      </For>
    </div>
  );
}

function TypeSpecimen() {
  return (
    <div class="flex flex-col gap-2">
      <For each={TYPE_STEPS}>
        {(cls) => (
          <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span class={`min-w-0 ${cls}`}>
              Handgloves &amp; 0123
            </span>
            <code>{cls}</code>
          </div>
        )}
      </For>
    </div>
  );
}

function SpacingSpecimen() {
  return (
    <div class="flex flex-wrap items-end gap-4">
      <For each={SPACING_STEPS}>
        {(cls) => (
          <figure class="flex flex-col items-start gap-1">
            <div
              class={`inline-block rounded-sm border border-dashed bg-surface ${cls}`}
            >
              <b class="block h-4 w-4 rounded-sm bg-accent text-on-accent" />
            </div>
            <code>{cls}</code>
          </figure>
        )}
      </For>
    </div>
  );
}

function BorderSpecimen() {
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <For each={RADIUS_STEPS}>
          {(cls) => (
            <figure class="flex flex-col items-start gap-1">
              <div
                class={`block h-12 w-20 border bg-surface-raised ${cls}`}
              />
              <code>{cls}</code>
            </figure>
          )}
        </For>
      </div>
      <div class="flex flex-wrap items-end gap-4">
        <For each={SHADOW_STEPS}>
          {(cls) => (
            <figure class="flex flex-col items-start gap-1">
              <div
                class={`block h-12 w-20 rounded-md border bg-surface-raised ${cls}`}
              />
              <code>{cls}</code>
            </figure>
          )}
        </For>
      </div>
    </div>
  );
}

/** The section a specimen belongs to, and the specimen it is shown with. */
const SECTION_SPECIMEN: Readonly<Record<string, () => JSX.Element>> = {
  colors: ColorSpecimen,
  typography: TypeSpecimen,
  spacing: SpacingSpecimen,
  borders: BorderSpecimen,
};

/** One specimen of the utilities landing: the section, what it looks like,
 *  and the way in. */
function SectionSpecimen(props: { id: string }) {
  const section = SECTIONS.find((s) => s.id === props.id)!;
  const Specimen = SECTION_SPECIMEN[props.id]!;
  return (
    <section class="flex min-w-0 flex-col gap-2">
      <div class="flex items-center gap-2">
        <h4>{section.title}</h4>
      </div>
      <div class={SPECIMEN_PANEL}>
        <div class="w-full">
          <Specimen />
        </div>
      </div>
      <button
        type="button"
        onClick={() => (location.hash = `#/utilities/${props.id}`)}
        class={QUIET_BUTTON}
      >
        <i class="i-lucide-arrow-right icon-md" />
        open {section.title.toLowerCase()}
      </button>
    </section>
  );
}

/** One card of the index: the section, its count, and the way in. */
function SectionCard(props: { section: Section; count: number }) {
  return (
    <button
      type="button"
      onClick={() => (location.hash = `#/utilities/${props.section.id}`)}
      class="secondary s-lg flex w-full flex-col items-start gap-2 text-left hover:border-strong"
    >
      <span class="flex w-full items-center gap-2">
          <span class="type-body-emphasized">
          {props.section.title}
        </span>
        <span class="ms-auto shrink-0 type-code text-muted">
          {props.count}
        </span>
      </span>
      <span class="type-caption text-muted">{props.section.blurb}</span>
    </button>
  );
}

/**
 * The utilities side, at a glance: what the surface is, where each section
 * lives, and four of them looked at rather than listed.
 */
export function UtilitiesLanding() {
  const catalog = createMemo(() => describeCatalog(themeTreeOrParse()));
  const cards = createMemo(() =>
    SECTIONS.map((section) => ({
      section,
      count: utilitiesFor(section, catalog()).length,
    }))
  );
  const total = () => cards().reduce((sum, c) => sum + c.count, 0);
  return (
    <>
      <header class={PAGE_HEAD}>
        <div>
          <h2>Utilities</h2>
          <div class={KIND}>
            spin reference · {SECTIONS.length} sections · {total()} names
          </div>
        </div>
        <span class={BADGE}>{total()} names</span>
      </header>
      <p class="max-w-screen-md text-muted">
        Every page on this side is drawn by the utilities it describes: the
        chrome around a demonstration wears the surface being demonstrated, so a
        utility that breaks breaks the showcase with it.
      </p>

      <section class="mb-8">
        <h3 class={SUBHEAD}>Sections</h3>
        <p class="max-w-screen-md text-muted">
          The surface cut by what a reader is looking for, not by which file the
          rule lives in.
        </p>
        <div class="grid grid-cols-2 gap-2">
          <For each={cards()}>
            {(card) => (
              <SectionCard
                section={card.section}
                count={card.count}
              />
            )}
          </For>
        </div>
      </section>

      <section class="mb-8">
        <h3 class={SUBHEAD}>Specimens</h3>
        <p class="max-w-screen-md text-muted">
          Four of the{" "}
          {SECTIONS.length}, each one built out of the utilities it names — the
          demo is the class rather than a picture of it.
        </p>
        <div class="grid grid-cols-2 gap-4">
          <For each={Object.keys(SECTION_SPECIMEN)}>
            {(id) => <SectionSpecimen id={id} />}
          </For>
        </div>
      </section>
    </>
  );
}
