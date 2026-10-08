import type { Demo } from "./demos.ts";
import { escapeHtml } from "./uno.ts";

/* ──────────────────────────────────────────────────────────────────────────
 * THE LAYOUT SURFACE — mechanisms, not a matrix.
 *
 * The layout families are 263 names, and a card each produced a page of
 * identical boxes: it showed the reader the WIDTH of the set and none of its
 * shape. None of these utilities is visible on its own — `justify-between` is a
 * line with three items ON it, `top-4` is a distance FROM something, and a
 * `col-span-2` means nothing without the tracks it reaches across. So the
 * section is cut by MECHANISM: what an element can be told to do, in the order
 * a reader meets the problems. Each mechanism says what it is, demonstrates it
 * once with three adjacent items, and then lists every name it owns — each one
 * still shown, so nothing can be catalogued and quietly left
 * undemonstrated.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The mechanism a name belongs to, DERIVED from the shape of the name.
 *
 * A utility name is `<property>-<value>`: the first segment is the property,
 * and the property IS the mechanism. Everything after it is a value — an axis
 * segment (`inset-x-4`, `overflow-y-auto`, `grid-flow-col-dense`), a step off a
 * scale (`-4`, `-full`, `-1/2`) — and an axis NARROWS a mechanism rather than
 * opening a new one. So `inset-4`, `inset-x-4` and `left-4` are one mechanism,
 * and the two-segment prefixes are tried before the one-segment ones, because
 * `grid-cols-2` is a COLUMN template and not a `grid`.
 *
 * Three shapes need a word beyond the first segment:
 *
 *   1. BARE keywords — `block`, `inline-flex`, `static`, `sticky`. The name IS
 *      the value of `display`, `visibility` or `position`, so it is matched
 *      against those properties' keyword sets. CSS has five positioning values
 *      and about a dozen display values: that is the CSS vocabulary, not a list
 *      of our names, and it is what lets a name nobody anticipated still land
 *      somewhere.
 *   2. `flex-` — one prefix, four mechanisms. `flex-row` is a direction,
 *      `flex-wrap` is wrapping, `flex-1` is a basis, and only the segment after
 *      the prefix says which.
 *   3. Whatever no mechanism claims falls to the LAST mechanism, which owns no
 *      vocabulary at all. Its names appear in the rail rather than listed, so a
 *      utility can never be dropped for want of a row above — and if that
 *      section is ever empty, a mechanism has claimed a group it should not
 *      have.
 */

/** CSS `display` and `visibility`, spelled the way a utility spells them. */
const DISPLAY_KEYWORD =
  /^(?:block|inline|flex|grid|contents)(?:-(?:block|inline|flex|grid))?$|^(?:hidden|visible|invisible|collapse)$/;

/** CSS `position`: five values, and every one of them is a bare name. */
const POSITION_KEYWORD = /^(?:static|relative|absolute|fixed|sticky)$/;

/** PREFIX to mechanism. The lookup decides which prefix is longest, not the
 *  order they are written here. */
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

/**
 * Prefixes that name a PROPERTY FAMILY rather than a property, so the segment
 * after them is what decides the mechanism. `flex` is the only one in the
 * catalog today, and one is enough to be worth deriving rather than hard-coding.
 */
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

/** The mechanism that owns a utility name. */
export function mechanismOf(name: string): string {
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

interface Mechanism {
  readonly id: string;
  readonly title: string;
  readonly blurb: string;
  /** The sample its name rail is drawn in. */
  readonly demo: Demo;
  /** One working demonstration, or "" when the mechanism owns no vocabulary. */
  readonly sample: () => string;
}

export const CAP = "font-mono text-xs text-text-muted";

/** Three distinct fills, so which item is which is never a guess. */
const FILL = ["neutral-300", "primary", "neutral-400"] as const;

/**
 * Sizes here are SCALE steps, not wind4's. Our spacing scale is
 * `0,1,2,4,8,16` — `w-64` and `h-32` are not utilities and generate nothing,
 * so a frame sized in them collapses to its content and the mechanism it was
 * built to demonstrate has nothing to act on. A frame is therefore a `w-16`
 * (4rem) box, which the scale states, and the WIDTH comes from a fraction
 * where a demonstration needs room rather than from a step that does not
 * exist.
 */
const BOX =
  "relative h-16 w-1/3 shrink-0 rounded-sm border border-solid border-border-strong bg-surface-raised p-1";
/** The same frame, deep enough for three items stacked. */
const TALL =
  "relative h-16 w-1/4 shrink-0 rounded-sm border border-solid border-border-strong bg-surface-raised p-1";
/** Narrower than its three items, because a wrap needs no room to happen. */
const NARROW =
  "relative h-16 w-16 shrink-0 rounded-sm border border-solid border-border-strong bg-surface-raised p-1";
/** Already a flex container: the mechanisms that only say something once there
 *  is one carry the container themselves. */
const FLEXBOX = `${BOX} flex`;
const TALLFLEX = `${TALL} flex`;
const NARROWFLEX = `${NARROW} flex`;
const TALLGRID = `${TALL} grid`;
/** A narrow column that folds, for the cross-axis line distribution. */
const LINES = `${NARROW} flex flex-col flex-wrap`;

/** Three items, because one item cannot show a distribution: a single child
 *  starts, centres and spreads identically. */
const tiles = (n: number, cls = "", size = "h-4 w-8"): string =>
  Array.from(
    { length: n },
    (_, i) =>
      `<b class="block ${size} shrink-0 rounded-sm bg-${
        FILL[i % FILL.length]
      } ${cls}"></b>`,
  ).join("");

/** Three items, each wearing its own class, so a mechanism can act on a MIDDLE
 *  item while its neighbours stay the control. */
const trio = (first: string, mid: string, last: string): string =>
  [first, mid, last].map((c, i) =>
    `<b class="block h-4 w-8 shrink-0 rounded-sm bg-${FILL[i]} ${c}"></b>`
  ).join("");

/** Three items with their names in them, for the mechanisms where WHICH item
 *  moved is the whole demonstration. */
const spelled = (n: number, cls: readonly string[] = []): string =>
  Array.from(
    { length: n },
    (_, i) =>
      `<b class="block h-4 w-8 shrink-0 rounded-sm bg-neutral-200 text-center font-mono text-xs leading-4 text-text ${
        cls[i] ?? ""
      }">${"abc"[i]}</b>`,
  ).join("");

/** One mechanism demonstrated: a labelled box wearing the class under test,
 *  with its three items inside it. */
const figure = (
  cls: string,
  items: string,
  label: string,
  box: string = BOX,
  overflow: string = "overflow-hidden",
): string =>
  `<figure class="flex w-1/3 shrink-0 min-w-0 flex-col items-start gap-1 ${overflow}">` +
  `<div class="${box} ${cls}">${items}</div>` +
  `<code class="${CAP}">${escapeHtml(label)}</code></figure>`;

/** A frame with items competing for one spot — the only arrangement in which
 *  the positioning schemes differ from each other. */
const CARD =
  "absolute h-8 w-16 rounded-sm border border-solid border-border-strong";
const frame = (items: string): string =>
  `<div class="relative h-16 w-1/2 min-w-0 rounded-sm border border-dashed border-solid border-border bg-surface">` +
  items +
  `</div>`;

/** Three cards in one frame, each wearing the same class under test. */
const cards = (extra: string, offsets: readonly string[]): string =>
  frame(
    offsets.map((o, i) =>
      `<b class="${CARD} bg-${FILL[i % FILL.length]} ${o} ${extra}"></b>`
    ).join(""),
  );

export const MECHANISMS: readonly Mechanism[] = [
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
    sample: () =>
      figure("block", tiles(3), "block — the items stack") +
      figure(
        "inline-flex items-center gap-2",
        tiles(3),
        "inline-flex — one line, side by side",
      ) +
      figure("grid grid-cols-3 gap-1", tiles(3), "grid — one track per item") +
      figure("hidden", tiles(3), "hidden — no box, and no items either") +
      figure(
        "contents",
        tiles(3),
        "contents — no box at all; the items join the row around it",
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
    sample: () =>
      figure(
        "",
        cards("static", ["inset-1", "inset-2", "inset-4"]),
        "static — the offsets are ignored, so the flow stacks them",
      ) +
      figure(
        "",
        cards("relative", ["inset-1", "inset-2", "inset-4"]),
        "relative — each offsets from where the flow would have put it",
      ) +
      figure(
        "",
        cards("absolute", ["inset-1", "inset-2", "inset-4"]),
        "absolute — out of the flow, each offset from the frame",
      ) +
      figure(
        "",
        cards("z-modal", ["inset-1", "inset-2", "inset-1"]),
        "z-modal on all three — equal z means DOM order, so the last wins",
      ),
  },
  {
    id: "inset",
    title: "Inset",
    blurb:
      "How far an element sits from the edges of whatever it is positioned " +
      "against, measured on the axis the name gives it: `inset-4` is all four " +
      "edges, `inset-x-4` is two of them. An offset only means anything on an " +
      "element that has left the flow or declared itself a containing block, " +
      "which is why the cards below sit in a frame that is positioned and " +
      "nothing else is.",
    demo: "stack",
    sample: () =>
      figure(
        "",
        frame(
          `<b class="${CARD} bg-neutral-300 inset-1"></b>` +
            `<b class="${CARD} bg-primary inset-1/2"></b>` +
            `<b class="${CARD} bg-neutral-400 inset-x-2 inset-y-1/2"></b>`,
        ),
        "inset-1 · inset-1/2 · inset-x-2 inset-y-1/2 — an edge, a centre, an axis",
      ),
  },
  {
    id: "flex-direction",
    title: "Flex direction",
    blurb:
      "The axis the container lays its children out on. Row and column are one " +
      "distribution read in two directions, and the `-reverse` forms keep every " +
      "child's place in the DOM while flipping the line — which is why the " +
      "reversed rows label their items instead of only colouring them.",
    demo: "row",
    sample: () =>
      figure("flex-row items-center gap-2", tiles(3), "flex-row", FLEXBOX) +
      figure(
        "flex-row-reverse items-center gap-2",
        spelled(3),
        "flex-row-reverse — the line reads c, b, a",
        FLEXBOX,
      ) +
      figure("flex-col items-center gap-2", tiles(3), "flex-col", TALLFLEX) +
      figure(
        "flex-col-reverse items-center gap-2",
        spelled(3),
        "flex-col-reverse — the same line, running upward",
        TALLFLEX,
      ),
  },
  {
    id: "flex-wrap",
    title: "Flex wrap",
    blurb:
      "Whether the children stay on one line or fold onto more. The frame " +
      "below is narrower than its three items on purpose, because a wrap is " +
      "invisible on a line with room to spare — and nowrap is those same " +
      "items choosing to overflow instead.",
    demo: "row",
    sample: () =>
      figure("flex-wrap items-center", tiles(3), "flex-wrap", NARROWFLEX) +
      figure(
        "flex-wrap-reverse items-center",
        tiles(3),
        "flex-wrap-reverse — the same fold, upward",
        NARROWFLEX,
      ) +
      figure(
        "flex-nowrap items-center",
        tiles(3),
        "flex-nowrap — one line, and the frame loses",
        NARROWFLEX,
      ),
  },
  {
    id: "sizing-basis",
    title: "Sizing basis",
    blurb:
      "How much of the container an individual item claims before anything is " +
      "distributed at all. `flex-1` grows from a zero basis, so the free space " +
      "is split without regard to what the items contain, while `flex-none` " +
      "takes exactly what it measures and refuses both grow and shrink. The " +
      "same three items are in every frame below; only the last one changes.",
    demo: "row",
    sample: () =>
      figure(
        "items-center",
        trio("", "flex-1", ""),
        "flex-1 — the third item takes what the first two left",
        FLEXBOX,
      ) +
      figure(
        "items-center",
        trio("", "flex-auto", ""),
        "flex-auto — grows from its own measured size",
        FLEXBOX,
      ) +
      figure(
        "items-center",
        trio("", "flex-initial", ""),
        "flex-initial — no grow, no shrink; the space stays unclaimed",
        FLEXBOX,
      ) +
      figure(
        "items-center",
        trio("", "flex-none", ""),
        "flex-none — grow and shrink both refused",
        FLEXBOX,
      ),
  },
  {
    id: "grow-shrink",
    title: "Grow and shrink",
    blurb:
      "Whether an item may take the space the container has left, and whether " +
      "it may give any back. Growing needs free space to be had, so the first " +
      "two frames hold items that do not fill the frame; shrinking needs a line " +
      "that has already overflowed, which is why the last two are too narrow.",
    demo: "row",
    sample: () =>
      figure(
        "items-center",
        trio("", "grow", ""),
        "grow — the middle item claims the free space",
        FLEXBOX,
      ) +
      figure(
        "items-center",
        trio("grow", "grow-0", "grow"),
        "grow-0 — the middle one refuses, and the others share it",
        FLEXBOX,
      ) +
      figure(
        "items-center",
        tiles(3, "", "h-4 w-16"),
        "shrink — three items that do not fit, and all three give way",
        NARROWFLEX,
      ) +
      figure(
        "items-center",
        tiles(3, "shrink-0", "h-4 w-16"),
        "shrink-0 — they hold, and the line overflows the frame",
        NARROWFLEX,
      ),
  },
  {
    id: "order",
    title: "Order",
    blurb:
      "The order items are laid out in, which is neither the order they are " +
      "written in nor the order they are read in. It changes paint order and " +
      "nothing else — the DOM is untouched — so it is a presentation decision, " +
      "and it is a keyboard trap when the visual order stops matching the tab " +
      "order. The first frame is the baseline the other two are read against.",
    demo: "row",
    sample: () =>
      figure("items-center", spelled(3), "the DOM order: a, b, c", FLEXBOX) +
      figure(
        "items-center",
        spelled(3, ["order-last", "order-1", "order-1"]),
        "order-last on a — the row reads c, b, a",
        FLEXBOX,
      ) +
      figure(
        "items-center",
        spelled(3, ["order-1", "order-1", "order-first"]),
        "order-first on c alone — a tie keeps the DOM order",
        FLEXBOX,
      ),
  },
  {
    id: "grid-columns",
    title: "Grid template columns",
    blurb:
      "How many column tracks the grid has, and how it fills them. Counts are " +
      "vocabulary because a track size is a decision every theme would " +
      "otherwise have to repeat, while `none`, `subgrid` and `repeat` are the " +
      "expressive forms that take the size from somewhere else. The same six " +
      "items fill every frame below.",
    demo: "cells",
    sample: () =>
      figure(
        "grid-cols-2 gap-1",
        tiles(6, "", "h-4"),
        "grid-cols-2",
        TALLGRID,
      ) +
      figure(
        "grid-cols-3 gap-1",
        tiles(6, "", "h-4"),
        "grid-cols-3",
        TALLGRID,
      ) +
      figure("grid-cols-6 gap-1", tiles(6, "", "h-4"), "grid-cols-6", TALLGRID),
  },
  {
    id: "grid-rows",
    title: "Grid template rows",
    blurb:
      "The same decision down the other axis. A grid that names its columns " +
      "but not its rows grows one row per line of items, so a template has to " +
      "be asked for: six items in two rows read nothing like six items in six.",
    demo: "cells",
    sample: () =>
      figure(
        "grid-cols-2 grid-rows-2 gap-1",
        tiles(6, "", "h-4"),
        "grid-rows-2",
        TALLGRID,
      ) +
      figure(
        "grid-cols-2 grid-rows-3 gap-1",
        tiles(6, "", "h-4"),
        "grid-rows-3",
        TALLGRID,
      ) +
      figure(
        "grid-cols-2 grid-rows-6 gap-1",
        tiles(6, "", "h-4"),
        "grid-rows-6 — a row per item",
        TALLGRID,
      ),
  },
  {
    id: "grid-placement",
    title: "Grid placement",
    blurb:
      "How far one item reaches across the tracks the container declared. " +
      "`col-span-2` takes two of them and `col-span-full` takes all of them, " +
      "which is how a header row is written without counting columns. Only " +
      "the first item changes; the other five are the control in every frame.",
    demo: "cells",
    sample: () => {
      const cells = tiles(6, "", "h-4");
      const placed = (cls: string): string =>
        `<b class="h-4 rounded-sm bg-primary ${cls}"></b>` + cells;
      return figure(
        "grid-cols-3 grid-rows-2 gap-1",
        cells,
        "six items in three tracks, before anything is placed",
        TALLGRID,
      ) +
        figure(
          "grid-cols-3 grid-rows-2 gap-1",
          placed("col-span-2"),
          "col-span-2 — the first item reaches across two tracks",
          TALLGRID,
        ) +
        figure(
          "grid-cols-3 grid-rows-2 gap-1",
          placed("col-span-full"),
          "col-span-full — the whole row, without counting it",
          TALLGRID,
        ) +
        figure(
          "grid-cols-3 grid-rows-2 gap-1",
          placed("row-span-2"),
          "row-span-2 — the same reach, down the other axis",
          TALLGRID,
        );
    },
  },
  {
    id: "grid-flow",
    title: "Grid auto flow",
    blurb:
      "Which way the grid places items into the tracks it has, and whether it " +
      "backfills the holes it leaves. Five items in the same two-column grid " +
      "read completely differently packed along the rows and packed down the " +
      "columns, which is the only difference between them.",
    demo: "cells",
    sample: () =>
      figure(
        "grid-cols-2 gap-1",
        tiles(5, "", "h-4"),
        "the default: filled along the rows",
        TALLGRID,
      ) +
      figure(
        "grid-cols-2 grid-flow-col gap-1",
        tiles(5, "", "h-4"),
        "grid-flow-col — filled down the columns instead",
        TALLGRID,
      ) +
      figure(
        "grid-cols-2 grid-flow-row-dense gap-1",
        tiles(5, "", "h-4"),
        "grid-flow-row-dense — the holes are backfilled as they appear",
        TALLGRID,
      ),
  },
  {
    id: "justify",
    title: "Justify content",
    blurb:
      "Where the free space along the MAIN axis goes — the one mechanism a " +
      "single card could never show. One item starts, centres and spreads " +
      "identically, so every frame below holds three and lets the class decide " +
      "what happens between them.",
    demo: "row",
    sample: () =>
      figure("justify-start", tiles(3), "justify-start", FLEXBOX) +
      figure("justify-center", tiles(3), "justify-center", FLEXBOX) +
      figure(
        "justify-between",
        tiles(3),
        "justify-between — the space goes BETWEEN the items",
        FLEXBOX,
      ) +
      figure(
        "justify-around",
        tiles(3),
        "justify-around — each item owns the space around it",
        FLEXBOX,
      ) +
      figure(
        "justify-evenly",
        tiles(3),
        "justify-evenly — the same space, edges included",
        FLEXBOX,
      ),
  },
  {
    id: "align-content",
    title: "Align content",
    blurb:
      "Where the free space across the CROSS axis goes, and only once the " +
      "container has folded onto more than one LINE. On a single line it does " +
      "nothing at all, which is why the frame below is a column narrower than " +
      "its three items.",
    demo: "row",
    sample: () => {
      const lines = tiles(3, "", "h-2 w-8");
      return figure("content-start", lines, "content-start", LINES) +
        figure("content-center", lines, "content-center", LINES) +
        figure(
          "content-between",
          lines,
          "content-between — the three LINES spread, not the items",
          LINES,
        );
    },
  },
  {
    id: "align-items",
    title: "Align items",
    blurb:
      "Where the items sit across the cross axis, as one decision for every " +
      "child at once. The items below are three different heights, because " +
      "equal ones align identically whichever way they are pushed — and " +
      "baseline needs something with a baseline in it, which is what the last " +
      "frame is for.",
    demo: "row",
    sample: () => {
      const mixed = ["h-2", "h-8", "h-16"].map((h, i) =>
        `<b class="block w-8 shrink-0 rounded-sm bg-${FILL[i]} ${h}"></b>`
      ).join("");
      return figure("items-start", mixed, "items-start", TALLFLEX) +
        figure("items-center", mixed, "items-center", TALLFLEX) +
        figure("items-end", mixed, "items-end", TALLFLEX) +
        figure("items-stretch", mixed, "items-stretch", TALLFLEX) +
        figure(
          "items-baseline",
          spelled(3),
          "items-baseline — three labels sitting on one edge",
          TALLFLEX,
        );
    },
  },
  {
    id: "align-self",
    title: "Align self",
    blurb:
      "Where ONE item sits across the cross axis, overriding the container's " +
      "default for that child alone. It exists only because `items-*` cannot " +
      "say anything different about one of three, which is why every frame " +
      "below puts the class on the middle item and leaves its neighbours alone.",
    demo: "row",
    sample: () =>
      figure(
        "items-center",
        trio("", "self-start", ""),
        "items-center on the box, self-start on the middle item",
        FLEXBOX,
      ) +
      figure(
        "items-center",
        trio("", "self-end", ""),
        "self-end on the middle item",
        FLEXBOX,
      ) +
      figure(
        "items-center",
        trio("", "self-stretch h-16", ""),
        "self-stretch — one item fills the cross axis",
        FLEXBOX,
      ) +
      figure(
        "items-center",
        trio("", "self-center", ""),
        "self-center on the middle item",
        FLEXBOX,
      ) +
      figure(
        "items-center",
        trio("", "self-auto", ""),
        "self-auto — the container's default, restated",
        FLEXBOX,
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
    sample: () => {
      const wide = tiles(3, "", "h-4 w-16");
      const box =
        "relative flex h-16 w-1/4 shrink-0 rounded-sm border border-solid border-border-strong bg-surface-raised p-1";
      return figure("overflow-visible", wide, "overflow-visible", box, "overflow-x-auto") +
        figure("overflow-hidden", wide, "overflow-hidden", box, "overflow-x-auto") +
        figure("overflow-clip", wide, "overflow-clip", box, "overflow-x-auto") +
        figure("overflow-auto", wide, "overflow-auto", box, "overflow-x-auto") +
        figure(
          "overflow-x-auto",
          wide,
          "overflow-x-auto — the axis segment narrows it to one direction",
          box,
          "overflow-x-auto",
        );
    },
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
    sample: () => "",
  },
];
