import { createGenerator } from "@unocss/core";
import { describeCatalog, spinPreset } from "@spin/preset";
import { SECTIONS, utilitiesFor } from "@spin/preset/organization.ts";
import {
  type Demo,
  DEMO_SAMPLE,
  DEMO_VALUE,
  demoClass,
  demoFor,
  honestAboutIt,
} from "./showcase/demos.ts";
import {
  buildScale,
  type BuiltScale,
  EDGE_AXES,
  scaleClass,
} from "@spin/preset/reference/build.ts";
import { parseTokens } from "@spin/theme";
import {
  starterThemes,
  supportsDark as themeSupportsDark,
} from "@spin/theme/themes";
// wind4 is NOT taken by hand. `spinPreset` already layers it — the RULES and
// the VARIANTS, never the preset object, and never its preflights (whose theme
// block re-emits our token references as self-referential variables and so
// silently zeroes every component that spends the scale).
//
// Handing the raw rules in AGAIN, on top, undoes the one thing that layer
// exists to do. The preset's layer drops any wind4 rule that reads a variable
// nothing defines and any family our own primitives already own; the raw copy
// has passed through neither check, and `p-8` was answered by wind4's
// `calc(var(--spacing) * 8)` instead of ours — while our sheet declares
// `--spacing-1..16` and never `--spacing`, so every padding, margin and gap on
// the page resolved to nothing. The page looked unstyled, `deno check` was
// clean and the tests passed, because the sheet was generated perfectly: it
// just declared spacing in a variable that does not exist. One layer, taken
// from the preset that owns it.
import presetIcons from "@unocss/preset-icons";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
import { type Fixture, FIXTURES } from "./showcase/fixtures.ts";

/**
 * The showcase — every tag, one route each.
 *
 *     deno task serve
 *
 * Organized by tag rather than by component, because a tag is what a consumer
 * writes and therefore what is worth demonstrating. A page per component would
 * put a switch beside a checkbox because they are both form controls, which is
 * a grouping nobody asked for.
 *
 * Each example carries the markup a consumer would actually write — no
 * test-only wrappers — and the page reports what the whole fixture costs on
 * its own, measured against a generator carrying only that tag. The number is
 * the point: it says whether the primitive is a handful of declarations or a
 * preflight pretending to be one.
 */
// EVERY starter goes to the preset. The rail listed `console` while the
// preset was handed two names, so console rendered with no variables at all —
// and the two lists were hand-written, so nothing noticed.
const ALL_THEMES = starterThemes;

/**
 * The catalog is derived from a THEME, so it needs one parsed — and it must be
 * the TREE, because that is what `describeCatalog` walks.
 *
 * Parsed once: the catalog is asked for on every utilities request and a
 * parse is not free.
 */
let themeTree: import("@spin/theme").TokenTree | undefined;
function themeTreeOrParse(): import("@spin/theme").TokenTree {
  if (themeTree === undefined) {
    const parsed = parseTokens(ALL_THEMES.default);
    if (!parsed.ok) throw new Error(parsed.error);
    themeTree = parsed.tree;
  }
  return themeTree;
}

/** A label and a declaration are both authored text. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Icons are a peer, composed ALONGSIDE spin's own presets — the idiomatic
// arrangement, and the only one that keeps `@unocss/preset-icons` optional for
// a consumer who wants no icons at all. spin's icon rules only SIZE a glyph;
// they never generate one, so `i-lucide-plus` is inert without this line.
const uno = await createGenerator({
  presets: [
    // OURS FIRST, wind4 second. uno keeps the first rule matching a token, so
    // this order means our primitives win where we define one and wind4 supplies
    // everything else — reading OUR scales, which is the whole point: wind4's
    // `p-4` resolves to var(--spacing-4) because that is what our theme states.
    //
    // The reverse order produces var(--spacing) with a calc and silently drops
    // utilities, which is what made an earlier attempt at this look like the
    // two sets would not merge.
    spinPreset({ themes: ALL_THEMES }),
    presetIcons({ collections: { lucide } } as never),
  ],
  // No `rules` / `variants` override. The preset's own wind4 layer supplies
  // both, already filtered — see the note above the import.
});
const bytes = (s: string) => Buffer.byteLength(s);

/**
 * What one fixture costs alone.
 *
 * Against a generator carrying only that tag, so the figure is the primitive
 * and not the other seven that have not been migrated to rules yet.
 */
async function cost(root: string, markup: string) {
  const own = await createGenerator({
    presets: [spinPreset({ themes: ALL_THEMES, primitives: [root] })],
  });
  const empty = await createGenerator({
    presets: [spinPreset({ themes: ALL_THEMES, primitives: false })],
  });
  const [withIt, without] = await Promise.all([
    own.generate(markup),
    empty.generate("p-4"),
  ]);
  return Math.max(0, bytes(withIt.css) - bytes(without.css));
}

/** The cost root a fixture is measured against. An alias follows its control. */
const COST_ROOT: Record<string, string> = {
  radio: "input",
  select: "input",
  textarea: "input",
  label: "input",
  fieldset: "input",
  dialog: "dialog",
  alert: "alert",
  tabs: "tabs",
  popover: "popover",
  prose: "prose",
  details: "details",
  progress: "progress",
  meter: "progress",
  group: "group",
  summary: "details",
  td: "table",
  th: "table",
  caption: "table",
};

const rendered = await Promise.all(
  FIXTURES.map(async (f) => ({
    ...f,
    bytes: await cost(COST_ROOT[f.id] ?? f.id, markupOf(f)),
  })),
);

function markupOf(f: Fixture): string {
  return f.examples.map((e) => e.html).join("\n");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const find = (id: string) => rendered.find((r) => r.id === id);

/** The catalog's GROUPS, derived from a theme — never typed. */
function catalogSections() {
  return describeCatalog(themeTreeOrParse());
}

/* ──────────────────────────────────────────────────────────────────────────
 * SAMPLES — what a utility acts ON, decided per family.
 *
 * Every sample is built from our own utilities, which is the point of the
 * whole exercise: the chrome around a demonstration is drawn by the surface
 * being demonstrated, so if a utility breaks the showcase's own chrome breaks
 * too, and the argument for rendering the reference in the system makes
 * itself.
 *
 * One contract holds across all of them, and the scale controls depend on it:
 * the class under test is the LAST token of the element carrying
 * `data-under-test`, whose other classes live in `data-base`. Swapping the
 * tested class is therefore a className rewrite that cannot lose the shape.
 * ────────────────────────────────────────────────────────────────────────── */

/** One cell of a specimen: the element, and the name of the class on it. */
function cell(sample: string, name: string, demo?: Demo): string {
  // min-w-0 overrides the default min-width:auto on flex items, so the
  // w-1/3 width is respected even when the content is wider. overflow-hidden
  // clips the overflow; overflow-x-auto for the clipped demo, where clipping
  // the frame would hide the very escape the utility is meant to show.
  const overflow = demo === "clipped" ? "overflow-x-auto" : "overflow-hidden";
  return `<figure class="flex w-1/3 shrink-0 min-w-0 flex-col items-start gap-1 ${overflow}">${sample}` +
    `<code class="font-mono text-xs text-text-muted">${
      escapeHtml(name)
    }</code></figure>`;
}

/**
 * The element carrying the class under test.
 *
 * `base` holds every class that is NOT the class under test, and is echoed in
 * `data-base` so the scale control can restore it. Keeping them apart is what
 * lets `p-0` and `rounded-none` be demonstrated at all: uno emits a static
 * rule per name and the later one in the sheet wins, so a base class that
 * shares a property with the class under test would silently beat it.
 */
function underTest(
  base: string,
  cls: string,
  tag = "i",
  inner = "",
  extra = "",
): string {
  const name = extra ? `${base} ${extra}` : base;
  return `<${tag} data-under-test data-base="${escapeHtml(name)}" ` +
    `class="${escapeHtml(name)} ${cls}">${inner}</${tag}>`;
}

/** The column count a grid utility declares, defaulting to three. */
function columnsOf(name: string): number {
  const declared = /^grid-cols-(\d+)$/.exec(name);
  if (declared === null) return 3;
  return Math.min(12, Math.max(1, Number(declared[1])));
}

/** The themes, so a swatch knows which foregrounds actually exist. */
const THEME_COLORS = ALL_THEMES as Record<string, Record<string, unknown>>;

/**
 * The foreground a fill DECLARES, as a class — or nothing.
 *
 * `bg-primary` -> `text-on-primary`, because the theme pairs them. `neutral` is a
 * RAMP rather than a pairing: eleven steps and no ink for each, since what
 * reads on neutral-900 is a choice about which step, not a property of it.
 *
 * Only ever added to a FILL. On `text-primary` the class under test IS the
 * colour, and a second colour class beside it would either lose or win on
 * sheet order rather than on intent.
 */
function inkOn(name: string): string {
  if (!name.startsWith("bg-")) return "";
  const bare = name.slice(3);
  // The theme is a DTCG document: `color.on-primary` lives at
  // `theme.color["on-primary"]`, so the group is NOT part of the key.
  const token = `on-${bare}`;
  const declared = Object.values(THEME_COLORS).some((theme) => {
    const color = theme["color"] as Record<string, unknown> | undefined;
    return color !== undefined && token in color;
  });
  return declared ? `text-${token}` : "";
}

/**
 * What a bare PREFIX is demonstrated on.
 *
 * `hover:` and `focus:` are catalogue entries and a prefix on its own emits no
 * declaration, so rendering the name as a class produced an element that
 * looked broken. A prefix is not a utility — it is a modifier that needs
 * something to modify — so the sample carries a real declaration behind it and
 * the label still says `hover:`, which is the name the reader will write.
 */
const PREFIX_TARGET: Record<string, string> = {
  "hover:": "hover:bg-primary hover:text-on-primary",
  "focus:": "focus:bg-primary focus:text-on-primary",
};

/**
 * The element that demonstrates a class.
 *
 * Per family, because one sample cannot demonstrate all of them: padding on an
 * empty box shows almost nothing, `top-1/2` on a static panel does nothing,
 * and a cursor is not visible in a picture at all. A sample is the thing the
 * utility acts on, so the family decides the sample and the sample is why the
 * entry is legible.
 */
function sampleElement(name: string, demo: Demo): string {
  const cls = escapeHtml(name);
  switch (demo) {
    /* A mark inside a bordered panel: the space has something to move away
       from, and all four edges read at once. */
    case "inset":
      return underTest(
        "inline-flex h-16 w-1/4 items-center justify-center rounded-sm border border-solid border-border-strong bg-surface",
        cls,
        "i",
        `<b class="block h-4 w-4 rounded-sm bg-primary"></b>`,
      );

    /* Two panels of different declared sizes: one panel's size is a claim,
       two panels' sizes are a comparison. */
    case "sizes":
      return `<span class="inline-flex items-end gap-2">` +
        `<i class="block h-8 w-8 shrink-0 rounded-sm border border-solid border-border-strong bg-neutral-200"></i>` +
        underTest(
          "block h-8 w-16 shrink-0 rounded-sm border border-solid border-border-strong bg-surface-raised",
          cls,
        ) +
        `</span>`;

    /* Three items, because a distribution cannot be demonstrated by one item.
       The container carries no gap and no alignment of its own: `gap-0` and
       `items-end` would otherwise lose to the base on sheet order. */
    case "row":
      return underTest(
        "inline-flex h-16 w-1/3 rounded-sm border border-solid border-border-strong bg-surface p-2",
        cls,
        "i",
        `<b class="block h-4 w-4 shrink-0 rounded-sm bg-neutral-300"></b>` +
          `<b class="block h-4 w-4 shrink-0 rounded-sm bg-primary"></b>` +
          `<b class="block h-4 w-4 shrink-0 rounded-sm bg-neutral-400"></b>`,
      );

    /* As many cells as the class declares columns for, so the column count is
       the thing you count. */
    case "cells": {
      const columns = columnsOf(name);
      return underTest(
        "inline-grid w-1/3 gap-1 rounded-sm border border-solid border-border-strong bg-surface p-1",
        cls,
        "i",
        Array.from(
          { length: columns },
          () => `<b class="block h-4 w-4 rounded-sm bg-primary"></b>`,
        ).join(""),
      );
    }

    /* Three overlapping cards: an order is only legible when something
       competes for the same space. One card has no "above". Each card sits in
       its own offset wrapper, so the class under test moves the CARD and not
       the wrapper — otherwise `top-4` would move the wrong thing. The card
       under test is the first one, so raising it is visible. */
    case "stack":
      return `<span class="relative block h-16 w-1/4 shrink-0">` +
        `<b class="absolute top-0 left-0 block">` + underTest(
          "block h-8 w-16 rounded-sm border border-solid border-border-strong bg-neutral-300",
          cls,
        ) + `</b>` +
        `<b class="absolute top-2 left-2 block"><i class="block h-8 w-16 rounded-sm border border-solid border-border-strong bg-neutral-400"></i></b>` +
        `<b class="absolute top-4 left-4 block"><i class="block h-8 w-16 rounded-sm border border-solid border-border-strong bg-surface-raised"></i></b>` +
        `</span>`;

    /* A run of prose. Type is read, not seen, and a token in a box says
       nothing about how a paragraph will look. */
    case "prose":
      return underTest(
        "m-0 block w-1/2 text-md text-text",
        cls,
        "p",
        "Handgloves &amp; 0123 — the quick brown fox jumps over the lazy dog, " +
          "and the measure is what type is for.",
      );

    /* The filled element itself. Its label takes the `on-*` foreground the
       theme pairs with that fill, and only when the theme declares one: an
       unpaired fill gets the label BESIDE it rather than a guessed ink on
       top of it, because inventing a foreground produces an unreadable
       swatch that looks like a theming bug. */
    case "fill": {
      const ink = inkOn(name);
      const base =
        "inline-flex h-16 w-full min-w-0 items-center justify-center rounded-sm border border-solid border-border";
      if (ink !== "") {
        return `<span class="block w-full min-w-0">` +
          underTest(base, `${cls} ${ink}`, "i", `<span>Aa</span>`) +
          `</span>`;
      }
      return `<span class="flex w-full min-w-0 items-center gap-2">` +
        underTest(base, cls) +
        `<code class="shrink-0 font-mono text-xs text-text-muted">Aa</code></span>`;
    }

    /* An elevated panel over a contrasting backdrop: a shadow with nothing
       behind it is a shadow on nothing. */
    case "lifted":
      return `<span class="inline-flex h-16 w-full min-w-0 items-center justify-center rounded-md bg-neutral-200 p-4">` +
        underTest(
          "block h-8 w-16 rounded-md border border-solid border-border bg-surface-raised",
          cls,
        ) + `</span>`;

    /* The same fill at the class's own alpha over stripes, so a partial
       opacity reads as partial instead of as a bug. The stripes are built
       from utility classes — alternating fills — because no utility ships a
       repeating gradient and inventing one here would be the showcase
       inventing CSS. */
    case "faded":
      return `<span class="relative block h-16 w-full min-w-0 overflow-hidden rounded-sm border border-solid border-border-strong">` +
        `<i class="absolute inset-0 flex">` +
        Array.from(
          { length: 8 },
          (_, i) =>
            `<b class="block h-full grow rounded-none bg-${
              i % 2 === 0 ? "neutral-200" : "surface"
            }"></b>`,
        ).join("") +
        `</i>` +
        underTest("absolute inset-0 rounded-sm bg-primary", cls) +
        `</span>`;

    /* Two elements, one of them moving. The control carries the same hover
       targets with no transition at all, so it snaps; the card under test
       eases by exactly the class it wears. */
    case "motion":
      return `<span class="inline-flex items-center gap-2">` +
        `<i class="block h-8 w-8 shrink-0 rounded-sm bg-neutral-300 transition hover:bg-primary hover:translate-x-4"></i>` +
        underTest(
          "block h-8 w-8 shrink-0 rounded-sm bg-primary transition hover:bg-primary hover:translate-x-4",
          cls,
        ) + `</span>`;

    /* A panel beside a panel that already has a visible edge, so a ring, an
       outline or a rounded corner is read against the thing it is drawn
       outside of. */
    case "edge":
      return `<span class="inline-flex items-center gap-2">` +
        underTest("block h-8 w-16 bg-surface-raised", cls) +
        `<i class="block h-8 w-16 rounded-sm border border-solid border-border-strong bg-surface-raised"></i>` +
        `</span>`;

    /* A divide lives BETWEEN siblings, so a sample with one child can never
       show one. Two marked rows, in a column. */
    case "ruled":
      return underTest(
        "inline-flex w-1/3 flex-col overflow-hidden rounded-sm border border-solid border-border bg-surface-raised",
        cls,
        "i",
        `<b class="flex items-center gap-2 px-2 py-2 text-xs">top row</b>` +
          `<b class="flex items-center gap-2 px-2 py-2 text-xs">bottom row</b>`,
      );

    /* Overflow is a relationship between two sizes, and the small one has to
       lose: the content is deliberately larger than its box. The box itself
       declares no overflow, so `overflow-visible` shows the escape and every
       other step shows its own kind of containing it. */
    case "clipped":
      return underTest(
        "relative block h-16 w-1/3 rounded-sm border border-solid border-border-strong bg-surface-raised",
        cls,
        "i",
        `<b class="block h-16 w-full rounded-sm bg-primary p-2 font-mono text-xs text-on-primary">` +
          `This paragraph is deliberately larger than the box around it.</b>`,
      );

    /* Text saying what it is — for what a picture cannot honestly fake. */
    case "said":
      return underTest(
        "inline-flex w-full min-w-0 items-start gap-2 rounded-sm border border-solid border-border p-2 text-xs text-text-muted",
        cls,
        "span",
        `<code class="font-mono text-text">${escapeHtml(name)}</code>`,
      );
  }
}


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
 * still rendered live, so nothing can be catalogued and quietly left
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
 *      vocabulary at all. Its names are rendered live rather than listed, so a
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

interface Mechanism {
  readonly id: string;
  readonly title: string;
  readonly blurb: string;
  /** The sample its name rail is drawn in. */
  readonly demo: Demo;
  /** One working demonstration, or "" when the mechanism owns no vocabulary. */
  readonly sample: () => string;
}

const CAP = "font-mono text-xs text-text-muted";

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
      "no mechanism above claimed. It is rendered live rather than listed, so a " +
      "utility can never be catalogued and quietly go undemonstrated — and if " +
      "this section is ever empty, a mechanism has taken a group it should not " +
      "have.",
    demo: "row",
    sample: () => "",
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * THE SHOWCASE'S ONE STYLESHEET.
 *
 * Generated from the FIXTURES, every class the chrome itself uses, every
 * utility the reference pages RENDER, and — the part that was missing — every
 * class a SAMPLE wears. A reference page shows classes, and a class with no
 * rule in the sheet does not demonstrate anything: it renders as an unstyled
 * element that looks exactly like a broken utility.
 *
 * The samples are generated here by CALLING the sample functions rather than
 * by listing their classes, so the sheet and the markup cannot drift apart.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Every class the page's own chrome uses, declared once.
 *
 * Markup interpolates these and the stylesheet is generated from the same
 * record, which is the only way to keep the two in step: a hand-kept list of
 * the classes a stylesheet needs is a list that drifts.
 */
const CHROME = {
  // A flex shell rather than a two-column grid: the rail's width is a
  // fraction of the viewport and the arbitrary-value grid template
  // (`grid-cols-[15rem_minmax(0,1fr)]`) is a wind4 spelling the surface does
  // not carry — it generates no rule at all, which left the rail and the page
  // stacked in one column. A fraction and a flex child say the same thing in
  // utilities we actually ship.
  shell: "flex min-h-screen",
  rail:
    "sticky top-0 flex max-h-screen w-1/4 shrink-0 flex-col gap-1 self-start overflow-y-auto border-e border-solid border-border p-4",
  railHead:
    "mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted",
  railLink:
    "flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm text-text-muted no-underline hover:bg-surface-raised hover:text-text aria-[current]:bg-surface-raised aria-[current]:text-text aria-[current]:font-medium",
  railCount: "shrink-0 font-mono text-xs text-text-muted",
  switcher:
    "mb-4 flex flex-wrap items-center gap-1 rounded-md border border-solid border-border p-1",
  chip:
    "inline-flex items-center gap-1 rounded-full border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal whitespace-nowrap text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text disabled:cursor-not-allowed disabled:opacity-40 aria-[current]:border-text aria-[current]:bg-text aria-[current]:text-surface",
  on:
    "aria-[current]:border-text aria-[current]:bg-text aria-[current]:text-surface",
  sep: "mx-1 h-4 shrink-0 bg-border-strong hairline",
  // The bottom rule under the surface switch. `border-b` is the utility this
  // wants and the surface does not have it: its side rule reads
  // `border-([xystrel])` — `b` is missing from the class, so `border-b` matches
  // nothing and generates nothing, while `border-e` and `border-t` do. It is a
  // hairline, so it belongs with the other hairlines rather than in the scale.
  surfaceSwitch: "mb-2 flex gap-1 pb-2 text-sm rule-b",
  surfaceLink:
    "flex-1 justify-center rounded-md border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted no-underline hover:border-border-strong hover:text-text aria-[current]:border-text aria-[current]:bg-text aria-[current]:text-surface",
  main: "min-w-0 flex-1 p-8 pb-16",
  pageHead: "mb-8 flex items-start justify-between gap-4",
  title: "m-0 text-2xl font-bold tracking-tight",
  kind: "font-mono text-xs text-text-muted",
  badge:
    "shrink-0 rounded-full border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted",
  note: "mt-4 max-w-screen-md text-md text-text-muted",
  section: "mb-8",
  subhead:
    "mb-2 mt-8 text-xs font-semibold uppercase tracking-wide text-text-muted",
  prose: "max-w-screen-md text-md text-text-muted",
  familyDemo:
    "flex flex-wrap items-start gap-4 rounded-lg border border-solid border-border bg-surface-raised p-4",
  legend: "mt-2 font-mono text-xs text-text-muted",
  railWrap: "mt-4 flex flex-wrap items-start gap-2",
  label: "mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted",
  pair: "flex flex-col items-start gap-2",
  pairBox:
    "flex min-h-16 w-1/3 min-w-0 items-center justify-center rounded-md border border-solid border-border bg-surface p-4",
  scaleStage:
    "flex min-h-16 w-full min-w-0 items-center justify-center overflow-hidden rounded-lg border border-solid border-border bg-surface-raised p-8",
  scaleControls: "mt-4 flex flex-wrap items-start gap-8",
  scaleGroup: "flex flex-col items-start gap-2",
  scaleButtons: "flex flex-wrap gap-1",
  decl:
    "mt-4 max-w-full overflow-x-auto rounded-md border border-solid border-border bg-surface-raised px-2 py-2 font-mono text-xs text-text-muted",
  declName: "font-mono text-xs text-text",
  nameList: "flex flex-wrap gap-2",
  noteBox:
    "mt-4 max-w-screen-md rounded-md border border-solid border-border bg-surface-raised p-4 text-sm text-text-muted",
  example: "mb-8",
  rendered:
    "rounded-md border border-dashed border-solid border-border bg-surface-raised p-4",
  reveal:
    "mt-2 inline-flex items-center gap-1 rounded-md border-0 bg-transparent p-0 font-mono text-xs font-medium normal-case tracking-normal text-text-muted not-italic shadow-none hover:text-text",
  panel: "mb-8 rounded-lg border border-solid border-border bg-surface p-4",
  dead: "text-semantic-error line-through",
} as const;

const chromeClasses = Object.values(CHROME).join(" ");

const REFERENCE_UTILITIES = [
  ...SECTIONS.flatMap((sec) =>
    utilitiesFor(sec, describeCatalog(themeTreeOrParse()))
  ),
  // The classes a DEMO shows, which are not always the classes it names: a
  // family whose effect is invisible at its smallest step is demonstrated at a
  // step where it is not. Keys as well as values, so a key that has dropped out
  // of the catalog is still rendered rather than silently skipped.
  ...Object.keys(DEMO_VALUE),
  ...Object.values(DEMO_VALUE),
];

/**
 * The declaration each utility produced, resolved once.
 *
 * Generated from the names themselves rather than per row: the sheet already
 * contains every rule, so asking the generator again per row was 757 calls to
 * learn what one string already said. A prefix utility — `hover:` — has no
 * rule of its own, so the one it prefixes is generated to give it something to
 * be measured against.
 */
async function declarationsFor(
  names: readonly string[],
): Promise<Map<string, string | null>> {
  const generated = await uno.generate([
    ...names,
    ...names.filter((n) => n.endsWith(":")).map((n) => `${n}p-4`),
  ].join("\n"));
  const flat = generated.css.replace(/\s+/g, " ");
  const out = new Map<string, string | null>();
  for (const name of names) {
    out.set(name, ruleFor(flat, name.endsWith(":") ? `${name}p-4` : name));
  }
  return out;
}

/** The rule a class produced, matched on the class rather than the first. */
function ruleFor(css: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const body = new RegExp(`\\.${escaped}[^{}]*\\{([^}]*)\\}`).exec(css)?.[1];
  if (!body) return null;
  const trimmed = body.split(";").map((d) => d.trim()).filter(Boolean).join(
    ";\n  ",
  );
  return trimmed || null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * The page's own styles — everything our own utilities cannot say.
 * ────────────────────────────────────────────────────────────────────────── */
const STYLE = `
/* Font smoothing. No utility in the surface sets it, and every measurement on
   the page is a measurement of this type. */
body { -webkit-font-smoothing: antialiased; }

/* The fieldset fixture ships its own class name, and spin already claims the
   token "group" for the role=group primitive, so a shortcut by that name would
   displace the primitive's own rules. The element selector is the one hook
   that does not collide with anything. */
fieldset {
  display: flex;
  flex-direction: column;
  gap: .625rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
}
fieldset > legend {
  padding-inline: .375rem;
  font-size: var(--font-size-sm);
  font-weight: 600;
}

/* The table fixture's scroller is an attribute in markup the showcase does not
   own, so there is no element to hang a utility on. */
[data-scroller] { max-height: 9rem; overflow: auto; }

/* The 1px divider in the rail. A hairline is a BORDER, not a step on a scale:
   our spacing scale answers "how far apart", and this is "how thick is the
   line", which is the border scale's business — and the border scale carries
   a full token for it. A width utility is the wrong instrument twice over: it
   would answer a question about thickness with a number about distance, and
   the scale has no entry to read, so the showcase would be inventing a
   token to decorate a page the product does not have. The token does exist —
   so this spends it rather than hard-coding a pixel. */
.hairline { width: var(--border-width); }

/* The rule under the surface switch. Same reasoning and the same gap as the
   hairline above: the surface's border rule spells its sides "([xystrel])",
   which omits "b", so border-b matches nothing and generates nothing while
   border-t and border-e generate normally. There is no utility to spend,
   and a 1px bottom edge is the hairline the border token already describes. */
.rule-b {
  border-block-end: var(--border-width) solid var(--color-border);
}
`;

/**
 * Which catalog groups are SCALES, and how each is shaped.
 *
 * The shape is a prefix and its axes, which is what lets a group be split into
 * steps and modifiers without anyone listing forty-two names. A group absent
 * from this table is not a scale and gets the family treatment instead.
 *
 * `border` is deliberately NOT here: its group is forty-four names of which
 * thirty-four are colours, and thirty-four colour buttons is a palette wearing
 * a scale's clothes. Colours are demonstrated as swatches, in the family block
 * that already knows how to render a fill.
 */
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
  "type-size": {
    title: "Font size",
    blurb: "The type scale, in steps. A step is a size, not a weight.",
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
  "type-size": "text",
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
  // renders with zero steps and a preview wearing the bare prefix. Saying so
  // is both the truth and the fix.
  return buildScale(raw, { prefix, axes: shape.axes ?? ONE_AXIS }, {
    title: shape.title,
    blurb: shape.blurb,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * THE UTILITIES SURFACE.
 *
 * A section is a set of FAMILIES, and a family is a group of utilities with
 * one mechanism between them. Each family gets: what it is, why this sample,
 * a working before-and-after of the idea, and then every one of its names
 * rendered live. Nothing is summarised away and nothing is listed without
 * being demonstrated.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The class a family's working demonstration wears.
 *
 * Not the first name in the group: `p-0` and `text-sm` are the least legible
 * members of their families and would demonstrate nothing. Each entry is the
 * name that makes the idea visible, and `demoClass` promotes it further where
 * the smallest step is too small to see.
 */
const HEADLINE: Record<string, string> = {
  background: "bg-primary",
  "text-color": "text-primary",
  tones: "tone-accent",
  sizing: "w-1/2",
  divide: "divide-y divide-neutral-300",
  border: "border-4 border-dashed border-primary",
  shadow: "shadow-lg",
  font: "font-mono",
  text: "text-center",
  typography: "uppercase tracking-widest",
  "text-decoration": "underline",
  overflow: "overflow-hidden",
  interactivity: "cursor-grab",
  variants: "hover:bg-primary",
};

/** The page heading every family page carries. */
function pageHead(title: string, sub: string, badge: string): string {
  return `<header class="${CHROME.pageHead}">` +
    `<div><h2 class="${CHROME.title}">${escapeHtml(title)}</h2>` +
    `<div class="${CHROME.kind}">${escapeHtml(sub)}</div></div>` +
    `<span class="${CHROME.badge}">${escapeHtml(badge)}</span></header>`;
}

/**
 * The two boxes a family's idea is shown in: the same element with the class
 * off, and the same element with it on.
 *
 * A before and an after, because a reference entry that shows only the
 * result tells a reader nothing they could not get from the source — they
 * cannot tell which part of what they see is the utility.
 */
function beforeAfter(demo: Demo, cls: string): string {
  const before = sampleElement("", demo);
  const after = sampleElement(cls, demo);
  // For the clipped demo, the frame must not clip the inner element's overflow —
  // that would demonstrate the opposite of the utility. overflow-x-auto lets the
  // content scroll within the frame instead.
  const overflow = demo === "clipped" ? "overflow-x-auto" : "overflow-hidden";
  return `<div class="${CHROME.familyDemo}">` +
    `<figure class="${CHROME.pair}">` +
    `<div class="${CHROME.pairBox} ${overflow}">${before}</div>` +
    `<code class="${CHROME.legend}">without</code></figure>` +
    `<figure class="${CHROME.pair}">` +
    `<div class="${CHROME.pairBox} ${overflow}">${after}</div>` +
    `<code class="${CHROME.legend}">${escapeHtml(cls)}</code></figure>` +
    `</div>`;
}

/**
 * The live rail: every one of a family's names, each on its own element.
 *
 * This is where the "one card per utility" failure stops. A card is a border,
 * a heading, a preview box and a copy of the CSS — four things repeated once
 * per name, none of which is the name. A rail is the name on a live element
 * and nothing else, so a hundred and eleven position utilities cost a
 * hundred and eleven small elements instead of a page of furniture.
 */
async function nameRail(
  demo: Demo,
  names: readonly string[],
): Promise<string> {
  const shown = names.map((n) => {
    const promoted = demoClass(n);
    return promoted.endsWith(":")
      ? PREFIX_TARGET[promoted] ?? promoted
      : promoted;
  });
  const declared = await declarationsFor(shown);
  const cells = names.map((name, i) =>
    cell(sampleElement(shown[i], demo), name, demo) +
    (declared.get(shown[i]) === null
      ? `<code class="${CHROME.dead}">no CSS</code>`
      : "")
  );
  return `<div class="${CHROME.railWrap}">${cells.join("")}</div>`;
}

/**
 * What a family cannot be shown in a picture, said where a picture would lie.
 *
 * Rendered INSTEAD of a swatch for the families where the effect only exists
 * while something is happening — a pointer over the element, a selection being
 * dragged, a transition between two states. A rendered swatch for
 * `cursor-not-allowed` would be a picture of a box, which proves nothing and
 * looks like a feature.
 */
function honestSentence(group: string): string {
  return honestAboutIt(group) ??
    "This family has no sample declared, because the honest preview is the " +
      "list of names below. A picture of it would be a picture of the absence " +
      "of the utility.";
}

/**
 * The interactive benches the picture cannot replace.
 *
 * Not decoration: `hover:`, `focus:`, `active:` and `group-hover:` are the
 * whole of the variants family and every one of them applies while the reader
 * is doing something. So the reader is given something to do, and told that
 * the sentence above is the only part of this a screenshot would show.
 */
function variantsBench(): string {
  return `<div class="${CHROME.panel}">` +
    `<div class="${CHROME.label}">the prefix applies while you are here</div>` +
    `<div class="${CHROME.railWrap}">` +
    `<div class="group flex w-1/3 shrink-0 flex-col items-start gap-2">` +
    `<span class="font-mono text-xs text-text-muted">hover the box, not the label</span>` +
    `<i class="block h-16 w-full rounded-sm bg-neutral-300 transition-colors group-hover:bg-accent"></i>` +
    `</div>` +
    `<button type="button" class="${CHROME.chip} px-4 py-2 transition hover:bg-primary hover:text-on-primary focus:bg-accent focus:text-on-accent active:scale-95">` +
    `hover, focus and press me</button>` +
    `<span class="inline-flex w-1/3 shrink-0 items-start gap-2 rounded-sm border border-dashed border-solid border-border p-2 text-xs text-text-muted">` +
    `nothing here is a still picture: every state below exists only while a ` +
    `pointer is over it, it holds focus, or it is pressed</span>` +
    `</div></div>`;
}

/** The interactivity bench: the utilities that only exist under a pointer. */
function interactivityBench(): string {
  return `<div class="${CHROME.panel}">` +
    `<div class="${CHROME.label}">try these rather than look at them</div>` +
    `<div class="${CHROME.railWrap}">` +
    `<div class="flex h-16 w-1/3 shrink-0 cursor-grab flex-col gap-1 overflow-auto rounded-md border border-solid border-border bg-surface-raised p-2 select-none resize-y">` +
    `<span class="font-mono text-xs text-text-muted">grab · scroll · resize</span>` +
    Array.from(
      { length: 12 },
      (_, i) =>
        `<span class="shrink-0 rounded-sm bg-neutral-200 px-2 py-1 font-mono text-xs">row ${
          i + 1
        }</span>`,
    ).join("") +
    `</div>` +
    `<div class="w-1/3 shrink-0 rounded-md border border-solid border-border bg-surface-raised p-2 select-text">` +
    `<span class="font-mono text-xs text-text-muted">drag across this text</span>` +
    `<p class="m-0 text-sm">Selection is a property of the pointer and the document, not of a picture.</p>` +
    `</div>` +
    `<span class="pointer-events-none w-1/4 shrink-0 rounded-md border border-dashed border-solid border-border p-2 text-xs text-text-muted">` +
    `pointer-events-none: this box cannot be pointed at, and cannot be proven by a screenshot.</span>` +
    `</div></div>`;
}

/**
 * The transitions bench: the utilities that only exist while something is
 * moving. Three comparisons — what moves, how long it takes, how it travels —
 * each on boxes the reader hovers, because a transition is a property of the
 * change and not of the element.
 */
function transitionsBench(): string {
  // Every box changes the same four things on hover; the class under test
  // decides which of them actually transition. `transition-none` is the
  // control: it snaps, so the others have something to be faster than.
  const property = [
    "transition-all",
    "transition-colors",
    "transition-transform",
    "transition-opacity",
    "transition-shadow",
    "transition-none",
  ].map((cls) =>
    `<div class="flex w-1/3 shrink-0 flex-col items-start gap-1">` +
    `<i class="block h-16 w-16 rounded-sm bg-neutral-300 ${cls} duration-base ease-standard hover:bg-accent hover:translate-x-8 hover:opacity-50 hover:shadow-lg"></i>` +
    `<code class="${CAP}">${cls}</code></div>`
  ).join("");

  // The same movement at three durations: the difference is the arrival, not
  // the destination.
  const duration = ["duration-fast", "duration-base", "duration-slow"].map(
    (cls) =>
      `<div class="flex w-1/3 shrink-0 flex-col items-start gap-1">` +
      `<i class="block h-16 w-16 rounded-sm bg-neutral-300 transition-all ${cls} ease-standard hover:bg-accent hover:translate-x-8"></i>` +
      `<code class="${CAP}">${cls}</code></div>`,
  ).join("");

  // The same movement on four curves: the difference is the travel, not the
  // arrival.
  const easing = [
    "ease-linear",
    "ease-standard",
    "ease-decelerate",
    "ease-accelerate",
  ].map((cls) =>
    `<div class="flex w-1/4 shrink-0 flex-col items-start gap-1">` +
    `<i class="block h-16 w-16 rounded-sm bg-neutral-300 transition-all duration-base ${cls} hover:bg-accent hover:translate-x-8"></i>` +
    `<code class="${CAP}">${cls}</code></div>`
  ).join("");

  return `<div class="${CHROME.panel}">` +
    `<div class="${CHROME.label}">hover a box — the movement is the demonstration</div>` +
    `<div class="flex flex-col gap-6">` +
    `<div><div class="${CHROME.label}">what moves</div>` +
    `<div class="${CHROME.railWrap}">${property}</div></div>` +
    `<div><div class="${CHROME.label}">how long it takes</div>` +
    `<div class="${CHROME.railWrap}">${duration}</div></div>` +
    `<div><div class="${CHROME.label}">how it travels</div>` +
    `<div class="${CHROME.railWrap}">${easing}</div></div>` +
    `</div></div>`;
}

/** The prose that explains why a family's sample is the sample it is. */
function captionFor(demo: Demo): string {
  return DEMO_SAMPLE[demo];
}

/**
 * One family: a scale (steps as controls on one preview) or a prose block with
 * a working demonstration and a live rail.
 */
async function family(
  group: { id: string; title: string; utilities: readonly string[] },
): Promise<string> {
  const demo = demoFor(group.id);
  const scale = scaleFor(group.id, group);

  if (scale !== undefined) return scaleBody(scale, group);

  const honest = honestAboutIt(group.id);
  const headline = demoClass(HEADLINE[group.id] ?? group.utilities[0] ?? "");
  const lead = demo === undefined ? honestSentence(group.id) : captionFor(demo);
  const extra = honest !== undefined
    ? `<p class="${CHROME.noteBox}">${escapeHtml(honest)}</p>`
    : "";
  const bench = group.id === "variants"
    ? variantsBench()
    : group.id === "interactivity"
    ? interactivityBench()
    : group.id === "transitions"
    ? transitionsBench()
    : "";
  // The transitions stage was a before/after pair on a still box, which
  // demonstrates nothing: the bench above is the demonstration.
  const stage = demo === undefined || group.id === "transitions"
    ? ""
    : beforeAfter(demo, headline);
  const rail = demo === undefined
    ? `<ul class="${CHROME.nameList}">${
      group.utilities.map((n) =>
        `<li><code class="font-mono text-xs text-text-muted">${
          escapeHtml(n)
        }</code></li>`
      ).join("")
    }</ul>`
    : await nameRail(demo, group.utilities);

  return `<section class="${CHROME.section}">` +
    `<h3 class="${CHROME.subhead}">${escapeHtml(group.title)}` +
    `<span class="${CHROME.railCount} ml-2">${group.utilities.length}</span></h3>` +
    `<p class="${CHROME.prose}">${escapeHtml(lead)}</p>` +
    stage + extra + bench +
    `<h4 class="${CHROME.label}">every name, rendered live</h4>` +
    rail +
    `</section>`;
}

/** A scale: one preview, with the steps and the axes as controls on it. */
async function scaleBody(
  scale: BuiltScale,
  group: { id: string; utilities: readonly string[] },
): Promise<string> {
  const step = scale.steps[0]?.key ?? "";
  const axis = scale.axes[0]?.key ?? "";
  // The PREFIX, not the group id: the padding scale is spelled `p-4`, and
  // handing `scaleClass` the group name produced `padding-0` — not a utility,
  // so the preview rendered as an unstyled box that looked like a broken one.
  const prefix = SCALE_PREFIX[group.id] ?? group.id;
  const cls = scaleClass(prefix, axis, step);
  const demo = demoFor(group.id) ?? "inset";
  const shown = demoClass(cls);

  // The names a scale cannot show as steps: `gap-x-4` beside `gap-4`, or
  // `me-auto` on an edge list that has no `me`. They are rendered live rather
  // than dropped, because a catalogue that hides names is a catalogue that
  // cannot be trusted to be complete.
  const claimed = new Set(
    scale.steps.flatMap((s) =>
      scale.axes.map((a) => scaleClass(prefix, a.key, s.key))
    ),
  );
  const rest = group.utilities.filter((n) => !claimed.has(n));
  const restRail = rest.length === 0
    ? ""
    : `<h4 class="${CHROME.label}">and the names a step cannot reach</h4>` +
      await nameRail(demo, rest);

  // The pressed button is ALSO the aria-current one, because the selected
  // state is drawn by the theme's own text-on-surface pair through the
  // `aria-[current]:` utilities — and a state the stylesheet cannot see is a
  // state it cannot draw.
  const buttons = (
    items: readonly { key: string; label?: string }[],
    kind: string,
  ) =>
    items.map((it) => {
      const pressed = it.key === (kind === "step" ? step : axis);
      return `<button type="button" class="${CHROME.chip}" data-${kind}="${
        escapeHtml(it.key)
      }"` +
        ` aria-pressed="${pressed}"${pressed ? ' aria-current="true"' : ""}>` +
        `${escapeHtml(it.label ?? it.key)}</button>`;
    }).join("");

  return `<section class="${CHROME.section}" data-scale-group="${
    escapeHtml(scale.id)
  }">` +
    `<h3 class="${CHROME.subhead}">${escapeHtml(scale.title)}` +
    `<span class="${CHROME.railCount} ml-2">${group.utilities.length}</span></h3>` +
    `<p class="${CHROME.prose}">${escapeHtml(scale.blurb)}</p>` +
    `<p class="${CHROME.prose}">${escapeHtml(captionFor(demo))}</p>` +
    `<div class="${CHROME.scaleStage}">${sampleElement(shown, demo)}</div>` +
    `<div class="${CHROME.scaleControls}">` +
    `<div class="${CHROME.scaleGroup}">` +
    `<h4 class="${CHROME.label}">step <span class="${CHROME.railCount}">${scale.steps.length}</span></h4>` +
    `<div class="${CHROME.scaleButtons}">${
      buttons(scale.steps, "step")
    }</div></div>` +
    (scale.axes.length > 1
      ? `<div class="${CHROME.scaleGroup}">` +
        `<h4 class="${CHROME.label}">edge <span class="${CHROME.railCount}">${scale.axes.length}</span></h4>` +
        `<div class="${CHROME.scaleButtons}">${
          buttons(scale.axes, "axis")
        }</div></div>`
      : "") +
    `</div>` +
    `<pre class="${CHROME.decl}"><code class="${CHROME.declName}" data-scale-name>${
      escapeHtml(cls)
    }</code></pre>` +
    restRail +
    `</section>`;
}

/** The layout surface, cut by mechanism rather than by catalog group. */
async function layoutSurface(
  groups: readonly {
    id: string;
    title: string;
    utilities: readonly string[];
  }[],
): Promise<string> {
  const names = [...new Set(groups.flatMap((g) => g.utilities))];
  const blocks: string[] = [];

  for (const mechanism of MECHANISMS) {
    const mine = names.filter((n) => mechanismOf(n) === mechanism.id);
    if (mine.length === 0) continue;
    const sample = mechanism.sample();
    blocks.push(
      `<section class="${CHROME.section}">` +
        `<h3 class="${CHROME.subhead}">${escapeHtml(mechanism.title)}` +
        `<span class="${CHROME.railCount} ml-2">${mine.length}</span></h3>` +
        `<p class="${CHROME.prose}">${escapeHtml(mechanism.blurb)}</p>` +
        (sample === ""
          ? ""
          : `<div class="${CHROME.familyDemo}">${sample}</div>`) +
        `<h4 class="${CHROME.label}">every name, rendered live</h4>` +
        await nameRail(mechanism.demo, mine) +
        `</section>`,
    );
  }

  return blocks.join("");
}

/** One section of the reference, rendered. */
async function utilityGroupPage(sectionId: string): Promise<string> {
  const catalog = catalogSections();
  const section = SECTIONS.find((x) => x.id === sectionId);
  if (!section) {
    return `<header class="${CHROME.pageHead}"><h2 class="${CHROME.title}">No such section</h2></header>`;
  }

  const groups = section.groups
    .map((id) => catalog.find((g) => g.id === id))
    .filter((g) => g !== undefined);

  const head = pageHead(
    section.title,
    section.blurb,
    `${utilitiesFor(section, catalog).length} names`,
  );

  if (section.id === "layout") return head + await layoutSurface(groups);
  return head + (await Promise.all(groups.map((g) => family(g)))).join("");
}

/**
 * Every reference page, rendered once.
 *
 * They are pure functions of the catalog, so there is nothing to gain by
 * rebuilding 757 specimens per request — and a great deal to lose: the sheet
 * is generated from these very pages, which is the only arrangement in which
 * a class can be rendered without a rule existing for it.
 */
const REFERENCE_PAGES: ReadonlyMap<string, string> = new Map(
  await Promise.all(
    SECTIONS.map(async (s) => [s.id, await utilityGroupPage(s.id)] as const),
  ),
);

const showcaseCss = (await uno.generate(
  [
    // Every fixture: the components under test, and their own classes.
    ...FIXTURES.flatMap((f) => f.examples.map((e) => e.html)),
    // The chrome the page wraps all of it in.
    chromeClasses,
    // The reference pages themselves, class tokens and all. Every sample,
    // every bench and every mechanism sample reaches the sheet through here.
    ...REFERENCE_PAGES.values(),
    // Every catalogued name, plus the classes a demo shows in place of the one
    // it names — a name with no rule demonstrates nothing.
    ...REFERENCE_UTILITIES,
  ].join("\n"),
)).css;

function shell(
  active: string,
  theme: string,
  mode: string,
  surface: "components" | "utilities",
  group: string,
): string {
  const f = active === "utilities" ? undefined : find(active);
  const body = surface === "utilities"
    ? REFERENCE_PAGES.get(group) ?? REFERENCE_PAGES.get(SECTIONS[0].id)
    : undefined;
  return `<!doctype html>
<html lang="en" data-theme="${theme}" data-mode="${mode}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>spin · ${esc(body ? "Utilities" : (f?.title ?? "not found"))}</title>
<style>${showcaseCss}</style>
<style>${STYLE}</style>
</head>
<body>
<div class="${CHROME.shell}">
  <nav class="${CHROME.rail}">
    <h1 class="${CHROME.railHead}">spin</h1>
    <div class="${CHROME.switcher}">
      ${
    THEMES.map((t) =>
      `<button type="button" class="${CHROME.chip} ${
        t === theme ? CHROME.on : ""
      }" data-theme-set="${t}">${t}</button>`
    ).join("")
  }
      <span class="${CHROME.sep}"></span>
      <button type="button" class="${CHROME.chip} ${
    mode === "base" ? CHROME.on : ""
  }" data-mode-set="base">base</button>
      <button type="button" class="${CHROME.chip}" data-mode-set="dark" disabled
              title="This theme renders one way">dark</button>
    </div>
    <div class="${CHROME.surfaceSwitch}">
      <a class="${CHROME.surfaceLink}" href="/utilities"${
    surface === "utilities" ? ' aria-current="page"' : ""
  }>utilities</a>
      <a class="${CHROME.surfaceLink}" href="/components"${
    surface === "components" ? ' aria-current="page"' : ""
  }>primitives</a>
    </div>
${
    (surface === "utilities"
      ? SECTIONS.map((sec) =>
        `    <a class="${CHROME.railLink}" href="/utilities/${sec.id}"${
          sec.id === group ? ' aria-current="page"' : ""
        }>` +
        `<span>${esc(sec.title)}</span>` +
        `<span class="${CHROME.railCount}">${
          utilitiesFor(sec, catalogSections()).length
        }</span></a>`
      )
      : rendered.map((r) =>
        `    <a class="${CHROME.railLink}" href="/${r.id}"${
          r.id === active ? ' aria-current="page"' : ""
        }>` +
        `<span>${esc(r.title)}</span><span class="${CHROME.railCount}">${
          esc(r.kind)
        }</span></a>`
      )).join("\n")
  }
  </nav>
  <main class="${CHROME.main}">
${
    body ?? (!f
      ? `    <header class="${CHROME.pageHead}"><h2 class="${CHROME.title}">Not found</h2></header>`
      : `    <header class="${CHROME.pageHead}">
      <div>
        <h2 class="${CHROME.title}">${esc(f.title)}</h2>
        <div class="${CHROME.kind}">${esc(f.kind)}</div>
        <p class="${CHROME.note}">${esc(f.note)}</p>
      </div>
      <span class="${CHROME.badge}">${f.bytes} bytes</span>
    </header>
${
        f.examples.map((e) =>
          `    <section class="${CHROME.example}">
      <h3 class="${CHROME.subhead}">${esc(e.name)}</h3>
      <div class="${CHROME.rendered}">${e.html}</div>
      <button class="${CHROME.reveal}" type="button" aria-expanded="false"
              data-markup="${
            esc(e.html.trim())
          }">markup <span data-caret>&#9656;</span></button>
      <pre hidden class="${CHROME.decl}">${esc(e.html.trim())}</pre>
    </section>`
        ).join("\n")
      }`)
  }
<script>
// A scale is ONE preview with controls on it. The two controls are
// INDEPENDENT coordinates of one class: pressing an edge must not reset the
// step, or the preview lies about the value the reader just chose. So the
// current value is read from whichever button was last pressed, not stored and
// overwritten.
for (const group of document.querySelectorAll("[data-scale-group]")) {
  const sample = group.querySelector("[data-under-test]");
  const name = group.querySelector("[data-scale-name]");
  const prefix = ${JSON.stringify(SCALE_PREFIX)};
  const id = group.dataset.scaleGroup;
  const current = { axis: "", step: "" };
  const show = () => {
    if (!sample || !name) return;
    const head = prefix[id] ?? id;
    // An axis is the SUFFIX of the prefix, not a segment of it: the inline
    // axis is px-16 and the block axis is py-16, both of which the catalog
    // lists as single names. Joining them with a dash produced p-x-16, which
    // no rule matches, so pressing an edge silently reset the preview to no
    // padding at all.
    const cls = head + current.axis + "-" + current.step;
    sample.className = (sample.dataset.base ?? "") + " " + cls;
    name.textContent = cls;
    for (const other of group.querySelectorAll("[data-step],[data-axis]")) {
      const isStep = other.hasAttribute("data-step");
      const active = isStep
        ? other.dataset.step === current.step
        : other.dataset.axis === current.axis;
      other.setAttribute("aria-pressed", String(active));
      if (active) other.setAttribute("aria-current", "true");
      else other.removeAttribute("aria-current");
    }
  };
  current.step = group.querySelector("[data-step]")?.dataset.step ?? "";
  current.axis = group.querySelector("[data-axis]")?.dataset.axis ?? "";
  for (const b of group.querySelectorAll("[data-step],[data-axis]")) {
    b.addEventListener("click", () => {
      if (b.dataset.step !== undefined) current.step = b.dataset.step;
      if (b.dataset.axis !== undefined) current.axis = b.dataset.axis;
      show();
    });
  }
  show();
}

// Theme and mode are READER state, kept in localStorage. Nothing about them
// lives in the URL — a link to a component should not carry the reader's
// choice, and a shared link should not leak it.
const THEMES = ${JSON.stringify(THEMES)};
const DARK = ${JSON.stringify(THEMES.filter((t) => supportsDark(t)))};
const root = document.documentElement;
const stored = () => {
  try { return JSON.parse(localStorage.getItem("spin:appearance") ?? "null") ?? {}; }
  catch { return {}; }
};
const syncModes = (theme) => {
  for (const b of document.querySelectorAll('[data-mode-set="dark"]')) {
    const on = DARK.includes(theme);
    b.disabled = !on;
    b.title = on ? "" : "This theme renders one way";
  }
};
const apply = (theme, mode) => {
  root.dataset.theme = theme;
  root.dataset.mode = mode;
  for (const b of document.querySelectorAll("[data-theme-set]")) {
    if (b.dataset.themeSet === theme) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  }
  for (const b of document.querySelectorAll("[data-mode-set]")) {
    if (b.dataset.modeSet === mode) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  }
  syncModes(theme);
};
// A theme that renders one way cannot be asked for another, so its control is
// DISABLED rather than hidden: a reader who switches to a one-mode theme and
// finds the button gone cannot tell whether the theme lacks the mode or the
// docs forgot to offer it.
const normalise = (theme, mode) =>
  DARK.includes(theme) ? { theme, mode } : { theme, mode: "base" };
{
  const s = stored();
  apply(...Object.values(normalise(
    THEMES.includes(s.theme) ? s.theme : "${theme}",
    s.mode === "dark" ? "dark" : "base",
  )));
}
for (const b of document.querySelectorAll("[data-theme-set]")) {
  b.addEventListener("click", () => {
    const next = normalise(b.dataset.themeSet, root.dataset.mode);
    localStorage.setItem("spin:appearance", JSON.stringify(next));
    apply(next.theme, next.mode);
  });
}
for (const b of document.querySelectorAll("[data-mode-set]")) {
  b.addEventListener("click", () => {
    if (b.disabled) return;
    const next = { theme: root.dataset.theme, mode: b.dataset.modeSet };
    localStorage.setItem("spin:appearance", JSON.stringify(next));
    apply(next.theme, next.mode);
  });
}
${f?.onLoad ?? ""}
for (const b of document.querySelectorAll(".reveal")) {
  b.addEventListener("click", () => {
    const pre = b.nextElementSibling;
    const caret = b.querySelector("[data-caret]");
    const open = b.getAttribute("aria-expanded") === "true";
    b.setAttribute("aria-expanded", String(!open));
    if (caret) caret.textContent = open ? "▸" : "▾";
    pre.hidden = open;
  });
}
</script>
  </main>
</div>
</body>
</html>`;
}

/**
 * The theme lives in localStorage, not a query string.
 *
 * The showcase's whole point is comparing two themes, and a theme carried in
 * the URL is lost the moment a reader follows a link to another component —
 * which is most of the navigation, since every component is its own route. A
 * link should not carry the reader's choice, and a shared link should not
 * leak it.
 */
const THEMES = ["default", "neobrut", "console"] as const;

/** Whether a theme renders a second way, derived from whether it declares one. */
function supportsDark(theme: string): boolean {
  return themeSupportsDark(
    starterThemes[theme as keyof typeof starterThemes] ?? starterThemes.default,
  );
}

/**
 * What the server renders: the default theme, in its own base mode.
 *
 * There is no cookie and no query string, because a theme is the READER's
 * choice and not a property of the document. Carrying it in the URL made every
 * link a special case that had to preserve it, and a shared link leaked it;
 * carrying it in a cookie made the server stateful for something the client
 * already knows. `apply()` in the page's script reads `localStorage` and
 * applies it before paint, and `data-theme-set` / `data-mode-set` remember
 * what was chosen.
 */
Deno.serve({ port: 8000 }, (req) => {
  const url = new URL(req.url);
  const id = url.pathname.replace(/^\/|\/$/g, "") || rendered[0]?.id;
  // `/utilities` and `/components` are SURFACES, not components: the rail
  // switches between them and neither is a 404.
  // `/utilities/<group>` is a group; `/utilities` alone is the first one, so
  // the surface always has a page behind the rail.
  const isSurface = id === "utilities" || id === "components" ||
    id.startsWith("utilities/");
  if (!isSurface && !find(id ?? "")) {
    return new Response("Not found", { status: 404 });
  }
  const theme = "default";
  const mode = "base";
  const headers: Record<string, string> = {
    "content-type": "text/html; charset=utf-8",
  };
  // Two SURFACES in one rail: the utilities and the primitives. They are
  // views of one system, so switching between them should not lose the theme,
  // the mode, or the place in the list.
  // `/utilities` shows the utilities; `/components` is the primitives list and
  // needs a route of its own to show, which is the first primitive.
  const surface = id.startsWith("utilities") || id === "utilities"
    ? "utilities"
    : "components";
  const route = id === "components" ? (rendered[0]?.id ?? "button") : id;
  const group = id.startsWith("utilities/")
    ? id.slice("utilities/".length)
    : "";
  return new Response(shell(route, theme, mode, surface, group), {
    headers,
  });
});

console.log(`showcase on http://localhost:8000 · ${rendered.length} tags`);
