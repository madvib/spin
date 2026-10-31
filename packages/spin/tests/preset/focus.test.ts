import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { readFileSync } from "node:fs";
import { spinPreset } from "../../src/preset/index.ts";

/**
 * The focus ring contract: a focused control shows ONE edge, in the theme's
 * focus colour.
 *
 * The ring used to be painted as a `box-shadow` outside the control's own
 * border, so a focused field showed the border AND the ring — a doubled edge
 * that reads as a broken double border, and worst in a theme whose ring is a
 * hard black line. Now the ring is painted with `outline`, at the theme's
 * focus width and offset, and the control's own border takes the ring's ink:
 * the edge the reader sees is one edge, in the theme's focus colour.
 *
 * The value is read out of the GENERATED SHEET rather than out of a rule's
 * source, because the sheet is what a browser reads: a rule that yields a
 * declaration nobody ships is not a contract, and a test that read the source
 * would not know the difference.
 */

const DEFAULT = new URL(
  "../../src/theme/themes/silk.json",
  import.meta.url,
);
const theme = JSON.parse(readFileSync(DEFAULT, "utf8")) as Record<
  string,
  unknown
>;

/** The sheet a document ships, for one theme. */
async function sheetFor(
  markup: string,
  document: Record<string, unknown> = theme,
): Promise<string> {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: document } })],
  });
  const { css } = await uno.generate(markup);
  return css;
}

/** One rule of the sheet: the selector and what it declares. */
interface Rule {
  readonly selector: string;
  readonly declarations: Record<string, string>;
}

/**
 * The sheet's rules, read out of the text.
 *
 * The sheet is flat at this level — a rule is a selector and a list of
 * declarations — and the primitives' rules are flat in it. A rule inside a
 * conditional block keeps the block in its selector, which no assertion here
 * mistakes for a primitive's own selector.
 */
function rulesOf(css: string): Rule[] {
  const out: Rule[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations: Record<string, string> = {};
    for (const entry of match[2]!.split(";")) {
      const text = entry.trim();
      if (text.length === 0) continue;
      const colon = text.indexOf(":");
      if (colon < 0) continue;
      declarations[text.slice(0, colon).trim()] = text.slice(colon + 1).trim();
    }
    out.push({ selector: match[1]!.trim(), declarations });
  }
  return out;
}

/**
 * A selector list, split where the comma is not inside a bracket.
 *
 * The sheet merges the rules that declare the same thing, so one rule can
 * carry several selectors — and `:is(input, textarea)` carries commas of its
 * own. A split that counted them all would cut a selector in half.
 */
function selectorList(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of selector) {
    if (character === "(") depth++;
    if (character === ")") depth--;
    if (character === "," && depth === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  out.push(current);
  return out.map((part) => part.replace(/\s+/g, ""));
}

/**
 * What one selector declares, wherever it appears in the sheet.
 *
 * The selector is compared as a whole, whitespace aside: a rule that merely
 * MENTIONS the selector — `table.striped` for `table` — is not read as the
 * rule itself.
 */
function declarationsFor(
  css: string,
  selector: string,
): Record<string, string> {
  const wanted = selector.replace(/\s+/g, "");
  const found: Record<string, string> = {};
  for (const rule of rulesOf(css)) {
    if (selectorList(rule.selector).includes(wanted)) {
      Object.assign(found, rule.declarations);
    }
  }
  return found;
}

/** The ring every focused control wears: the theme's width, ink and offset. */
const RING = {
  outline: "var(--focus-width) solid var(--color-focus-ring)",
  "outline-offset": "var(--focus-offset)",
  "border-color": "var(--color-focus-ring)",
} as const;

/** The control that takes focus by keyboard: the button group. */
const BUTTON =
  ':is(button, [type="submit"], [type="reset"], [type="button"], [role="button"])';

test("a focused field paints the ring as an outline, and its edge takes the ring's ink", async () => {
  // The field is where the doubled edge was worst: the border was the
  // primary and the ring a shadow glued to it, so the reader saw two edges
  // in two colours. Now the edge IS the ring — the border wears the ring's
  // ink — and the ring is an outline at the theme's own width and offset.
  const css = await sheetFor('<input type="text">');
  const focused = declarationsFor(
    css,
    ":is(input, textarea, select):focus-visible",
  );
  deepStrictEqual(focused["outline"], RING.outline, "the ring is an outline");
  deepStrictEqual(
    focused["outline-offset"],
    RING["outline-offset"],
    "the ring stands off the edge by the theme's offset",
  );
  deepStrictEqual(
    focused["border-color"],
    RING["border-color"],
    "the field's edge takes the ring's ink",
  );
});

test("a focused button paints the ring as an outline, and its edge takes the ring's ink", async () => {
  const css = await sheetFor("<button>Deploy</button>");
  const focused = declarationsFor(
    css,
    `${BUTTON}:focus-visible:not(:disabled):not([aria-disabled="true"])`,
  );
  deepStrictEqual(focused["outline"], RING.outline, "the ring is an outline");
  deepStrictEqual(
    focused["outline-offset"],
    RING["outline-offset"],
    "the ring stands off the edge by the theme's offset",
  );
  deepStrictEqual(
    focused["border-color"],
    RING["border-color"],
    "the button's edge takes the ring's ink",
  );
});

test("a focused ghost button keeps its edge, so the ring is the only edge", async () => {
  // A ghost is paint-free: no fill, no edge. A ring-coloured border beside
  // the ring would be the second edge the ring exists to replace, so the
  // ghost keeps its transparent edge while it is focused.
  const css = await sheetFor('<button class="ghost">Dismiss</button>');
  const focused = declarationsFor(
    css,
    `${BUTTON}.ghost:focus-visible:not(:disabled):not([aria-disabled="true"])`,
  );
  deepStrictEqual(
    focused["border-color"],
    "transparent",
    "the ghost's edge stays invisible",
  );
});

test("a focused checkbox paints the ring as an outline, and its edge takes the ring's ink", async () => {
  const css = await sheetFor('<input type="checkbox">');
  const focused = declarationsFor(
    css,
    'input[type="checkbox"]:not([role]):focus-visible',
  );
  deepStrictEqual(focused["outline"], RING.outline, "the ring is an outline");
  deepStrictEqual(
    focused["outline-offset"],
    RING["outline-offset"],
    "the ring stands off the edge by the theme's offset",
  );
  deepStrictEqual(
    focused["border-color"],
    RING["border-color"],
    "the box's edge takes the ring's ink",
  );
});

test("a focused switch paints the ring as an outline, and its edge takes the ring's ink", async () => {
  const css = await sheetFor('<input type="checkbox" role="switch">');
  const focused = declarationsFor(
    css,
    'input[type="checkbox"][role="switch"]:focus-visible',
  );
  deepStrictEqual(focused["outline"], RING.outline, "the ring is an outline");
  deepStrictEqual(
    focused["outline-offset"],
    RING["outline-offset"],
    "the ring stands off the edge by the theme's offset",
  );
  deepStrictEqual(
    focused["border-color"],
    RING["border-color"],
    "the track's edge takes the ring's ink",
  );
});

test("a focused radio paints the ring as an outline, and its edge takes the ring's ink", async () => {
  const css = await sheetFor('<input type="radio">');
  const focused = declarationsFor(css, 'input[type="radio"]:focus-visible');
  deepStrictEqual(focused["outline"], RING.outline, "the ring is an outline");
  deepStrictEqual(
    focused["outline-offset"],
    RING["outline-offset"],
    "the ring stands off the edge by the theme's offset",
  );
  deepStrictEqual(
    focused["border-color"],
    RING["border-color"],
    "the radio's edge takes the ring's ink",
  );
});


test("a focused summary paints the theme's ring, not the browser's", async () => {
  // the theme's offset around it. The ring is the theme's now.
  const css = await sheetFor("<details><summary>More</summary></details>");
  const focused = declarationsFor(css, "summary:focus-visible");
  deepStrictEqual(focused["outline"], RING.outline, "the ring is an outline");
  deepStrictEqual(
    focused["outline-offset"],
    RING["outline-offset"],
    "the ring stands off the edge by the theme's offset",
  );
});

test("a focused link paints the ring as an outline, at the theme's offset", async () => {
  const css = await sheetFor('<a href="#">Docs</a>');
  const focused = declarationsFor(css, "a:focus-visible");
  deepStrictEqual(focused["outline"], RING.outline, "the ring is an outline");
  deepStrictEqual(
    focused["outline-offset"],
    RING["outline-offset"],
    "the ring stands off the edge by the theme's offset",
  );
});

test("a hidden element that takes focus wears the theme's ring", async () => {
  // The escape puts a hidden element back on the page when it is focused.
  // It comes back wearing the theme's ring, so a keyboard reader can see
  // where the focus went.
  const css = await sheetFor('<span class="visually-hidden">Skip</span>');
  const focused = declarationsFor(
    css,
    ':is([aria-hidden="false"][hidden], .visually-hidden):focus-visible',
  );
  deepStrictEqual(focused["outline"], RING.outline, "the ring is an outline");
  deepStrictEqual(
    focused["outline-offset"],
    RING["outline-offset"],
    "the ring stands off the edge by the theme's offset",
  );
});

test("a pointer that lands on a control leaves no ring", async () => {
  // The ring is drawn on :focus-visible, so a mouse press leaves none — and
  // the browser's own ring is taken away with it, because the browser's is
  // not the theme's.
  const css = await sheetFor('<input type="text"><button>Deploy</button>');
  const field = declarationsFor(
    css,
    ":is(input, textarea, select):focus:not(:focus-visible)",
  );
  deepStrictEqual(field["outline"], "none", "the field's own ring goes");
  const button = declarationsFor(
    css,
    `${BUTTON}:focus:not(:focus-visible)`,
  );
  deepStrictEqual(button["outline"], "none", "the button's own ring goes");
});

test("the ring is painted for engines without :focus-visible", async () => {
  // An engine that cannot tell a keyboard focus from a pointer focus still
  // shows the ring: the rule is stated for it, inside the at-rule that says
  // the engine lacks the selector.
  const css = await sheetFor('<input type="text">');
  assert(
    css.includes("@supports not selector(:focus-visible)"),
    "the fallback is stated for engines without the selector",
  );
  const fallback = declarationsFor(
    css,
    ":is(input, textarea, select):focus",
  );
  deepStrictEqual(
    fallback["outline"],
    RING.outline,
    "the ring is an outline there too",
  );
  deepStrictEqual(
    fallback["border-color"],
    RING["border-color"],
    "and the edge takes the ring's ink there too",
  );
});
