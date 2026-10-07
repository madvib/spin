import { describeCatalog } from "@spin/preset";
import { ALERT_EXAMPLES, alertFixtureNote } from "@spin/preset/rules/primitives/alert.examples.ts";
import { BADGE_EXAMPLES, badgeFixtureNote } from "@spin/preset/rules/primitives/badge.examples.ts";
import { BUTTON_EXAMPLES, buttonFixtureNote } from "@spin/preset/rules/primitives/button.examples.ts";
import { CARD_EXAMPLES, cardFixtureNote } from "@spin/preset/rules/primitives/card.examples.ts";
import { CONTROL_EXAMPLES, controlFixtureNote } from "@spin/preset/rules/primitives/control.examples.ts";
import { DIALOG_EXAMPLES, dialogFixtureNote } from "@spin/preset/rules/primitives/dialog.examples.ts";
import { FIELD_EXAMPLES, fieldFixtureNote } from "@spin/preset/rules/primitives/field.examples.ts";
import { GROUP_EXAMPLES, groupFixtureNote } from "@spin/preset/rules/primitives/group.examples.ts";
import { POPOVER_EXAMPLES, popoverFixtureNote } from "@spin/preset/rules/primitives/popover.examples.ts";
import { PROGRESS_EXAMPLES, progressFixtureNote } from "@spin/preset/rules/primitives/progress.examples.ts";
import { PROSE_EXAMPLES, proseFixtureNote } from "@spin/preset/rules/primitives/prose.examples.ts";
import { RADIO_EXAMPLES, radioFixtureNote } from "@spin/preset/rules/primitives/radio.examples.ts";
import { TABLE_EXAMPLES, tableFixtureNote } from "@spin/preset/rules/primitives/table.examples.ts";
import { TABS_EXAMPLES, tabsFixtureNote } from "@spin/preset/rules/primitives/tabs.examples.ts";
import type { Demo } from "./demos.ts";
import { FIXTURES, type Fixture } from "./fixtures.ts";
import { ALL_THEMES, escapeHtml, themeTreeOrParse } from "./uno.ts";

/**
 * Migrated fixtures source from the preset package: examples live beside
 * the rule that styles them (Park UI shape). Remaining fixtures migrate one
 * primitive at a time; when FIXTURES empties, this adapter and fixtures.ts
 * delete with it.
 */
const ALERT_FIXTURE: Fixture = {
  id: "alert",
  title: "Alert",
  kind: "rule",
  note: alertFixtureNote,
  examples: [...ALERT_EXAMPLES],
};

const BUTTON_FIXTURE: Fixture = {
  id: "button",
  title: "Button",
  kind: "rule",
  note: buttonFixtureNote,
  examples: [...BUTTON_EXAMPLES],
};

const CONTROL_FIXTURE: Fixture = {
  id: "checkbox",
  title: "Checkbox & switch",
  kind: "rule",
  note: controlFixtureNote,
  // Indeterminate is IDL-only: no attribute sets it, so the page sets the
  // property on load for elements marked data-mixed.
  onLoad:
    "document.querySelectorAll('[data-mixed]').forEach((e) => e.indeterminate = true);",
  examples: [...CONTROL_EXAMPLES],
};

const RADIO_FIXTURE: Fixture = {
  id: "radio",
  title: "Radio",
  kind: "rule",
  note: radioFixtureNote,
  examples: [...RADIO_EXAMPLES],
};

const FIELD_FIXTURE: Fixture = {
  id: "input",
  title: "Field",
  kind: "rule",
  note: fieldFixtureNote,
  examples: [...FIELD_EXAMPLES],
};

const TABLE_FIXTURE: Fixture = {
  id: "table",
  title: "Table",
  kind: "rule",
  note: tableFixtureNote,
  examples: [...TABLE_EXAMPLES],
};

const TABS_FIXTURE: Fixture = {
  id: "tabs",
  title: "Tabs",
  kind: "rule",
  note: tabsFixtureNote,
  examples: [...TABS_EXAMPLES],
};

const DIALOG_FIXTURE: Fixture = {
  id: "dialog",
  title: "Dialog",
  kind: "rule",
  note: dialogFixtureNote,
  // showModal is IDL-only: the page wires trigger buttons on load.
  onLoad:
    "document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => document.getElementById(b.dataset.open)?.showModal()));",
  examples: [...DIALOG_EXAMPLES],
};

const POPOVER_FIXTURE: Fixture = {
  id: "popover",
  title: "Popover & tooltip",
  kind: "rule",
  note: popoverFixtureNote,
  examples: [...POPOVER_EXAMPLES],
};

const PROGRESS_FIXTURE: Fixture = {
  id: "progress",
  title: "Progress",
  kind: "rule",
  note: progressFixtureNote,
  examples: [...PROGRESS_EXAMPLES],
};

const BADGE_FIXTURE: Fixture = {
  id: "badge",
  title: "Badge",
  kind: "rule",
  note: badgeFixtureNote,
  examples: [...BADGE_EXAMPLES],
};

const CARD_FIXTURE: Fixture = {
  id: "card",
  title: "Card",
  kind: "rule",
  note: cardFixtureNote,
  examples: [...CARD_EXAMPLES],
};

const GROUP_FIXTURE: Fixture = {
  id: "group",
  title: "Group",
  kind: "rule",
  note: groupFixtureNote,
  examples: [...GROUP_EXAMPLES],
};

const PROSE_FIXTURE: Fixture = {
  id: "prose",
  title: "Prose",
  kind: "rule",
  note: proseFixtureNote,
  examples: [...PROSE_EXAMPLES],
};

export const rendered: readonly Fixture[] = [
  ALERT_FIXTURE,
  BADGE_FIXTURE,
  BUTTON_FIXTURE,
  CARD_FIXTURE,
  CONTROL_FIXTURE,
  RADIO_FIXTURE,
  FIELD_FIXTURE,
  TABLE_FIXTURE,
  TABS_FIXTURE,
  DIALOG_FIXTURE,
  POPOVER_FIXTURE,
  PROGRESS_FIXTURE,
  GROUP_FIXTURE,
  PROSE_FIXTURE,
  ...FIXTURES,
];

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const find = (id: string) => rendered.find((r) => r.id === id);

/** The catalog's GROUPS, derived from a theme — never typed. */
export function catalogSections() {
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
export function cell(sample: string, name: string, demo?: Demo): string {
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
export const PREFIX_TARGET: Record<string, string> = {
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
export function sampleElement(name: string, demo: Demo, group?: string): string {
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
       nothing about how a paragraph will look. The text-color group drops
       the base `text-text`: both set `color`, and the sheet orders the
       base's rule after the utility's, so the base would win on equal
       specificity and every row would render the same ink. */
    case "prose": {
      const base = group === "text-color"
        ? "m-0 block w-1/2 text-md"
        : "m-0 block w-1/2 text-md text-text";
      return underTest(
        base,
        cls,
        "p",
        "Handgloves &amp; 0123 — the quick brown fox jumps over the lazy dog, " +
          "and the measure is what type is for.",
      );
    }

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

    /* Text saying what it is. */
    case "said":
      return underTest(
        "inline-flex w-full min-w-0 items-start gap-2 rounded-sm border border-solid border-border p-2 text-xs text-text-muted",
        cls,
        "span",
        `<code class="font-mono text-text">${escapeHtml(name)}</code>`,
      );
  }
}
