import { assert, assertEquals } from "@std/assert";
import { createGenerator } from "@unocss/core";
import { readFileSync } from "node:fs";
import { spinPreset } from "../src/index.ts";
import { CONTROL_FIELDS } from "../src/rules/primitives/field.ts";
import { starterThemes } from "@spin/theme/themes";

/**
 * The layout contract: a row that fits, a cell that does not break, a table
 * that carries a minimum.
 *
 * These are the defects the theme montage exposed — a card's footer that
 * pushed its buttons out of the card, a table that re-wrapped a name to
 * crush a column, a row of stats the theme's type scale made too wide for
 * the space it was given. The fixes are declarations, so the tests are
 * declarations too: what a consumer's page ships is what is asserted, and
 * each one fails the moment the declaration is taken away.
 *
 * The value is read out of the GENERATED SHEET rather than out of a rule's
 * source, because the sheet is what a browser reads: a rule that yields a
 * declaration nobody ships is not a contract, and a test that reads the
 * source would not know the difference.
 */

const DEFAULT = new URL(
  "../../theme/src/themes/silk.json",
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
 * conditional block keeps the block in its selector, which no assertion
 * here mistakes for a primitive's own selector.
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
 * What one selector declares, wherever it appears in the sheet.
 *
 * The selector is compared as a whole, whitespace aside: a rule that merely
 * MENTIONS the selector — `table.striped` for `table` — is not read as the
 * rule itself, and a selector that holds a list of its own (`:is(td, th)`)
 * is still one selector.
 */
function declarationsFor(
  css: string,
  selector: string,
): Record<string, string> {
  const wanted = selector.replace(/\s+/g, "");
  const found: Record<string, string> = {};
  for (const rule of rulesOf(css)) {
    if (rule.selector.replace(/\s+/g, "") === wanted) {
      Object.assign(found, rule.declarations);
    }
  }
  return found;
}

Deno.test("a card's footer wraps the actions it cannot fit", async () => {
  // A card is a container and its footer is part of the card: two buttons
  // that do not fit in a narrow column used to be pushed out of the surface
  // they belong to. The row that wraps is what keeps the card whole.
  const css = await sheetFor(
    "<card><card-footer><button>Deploy</button><button>Roll back</button></card-footer></card>",
  );
  assertEquals(
    declarationsFor(css, "card-footer")["flex-wrap"],
    "wrap",
    "the footer's row wraps",
  );
});

Deno.test("a card's action wraps the controls it cannot fit", async () => {
  // The action is the header's trailing slot, and it holds controls. A slot
  // wider than the card pushes them out of it, so the slot wraps too.
  const css = await sheetFor(
    "<card><card-header><card-action><button>Deploy</button></card-action></card-header></card>",
  );
  assertEquals(
    declarationsFor(css, "card-action")["flex-wrap"],
    "wrap",
    "the action's row wraps",
  );
});

Deno.test("an alert laid out as a row wraps", async () => {
  // The horizontal form of an alert is a row of content — an icon beside a
  // message — and a row that cannot wrap pushes the message out of the
  // alert. The alert is a block, so the declaration is inert until a
  // consumer makes it a row; it is stated so that row wraps when they do.
  const css = await sheetFor('<alert role="status">Deploy #4821</alert>');
  assertEquals(
    declarationsFor(css, "alert")["flex-wrap"],
    "wrap",
    "the alert's row wraps",
  );
});

Deno.test("a dialog's actions row wraps the buttons it cannot fit", async () => {
  // The footer of a dialog holds the dialog's actions, and a dialog is a
  // panel: a row that cannot hold the buttons pushes them out of the panel
  // they belong to, and a dialog whose actions have left it is a dialog with
  // no way out. The row that wraps is what keeps the panel whole.
  const css = await sheetFor(
    "<dialog><footer><button>Cancel</button><button>Deploy</button></footer></dialog>",
  );
  assertEquals(
    declarationsFor(css, "dialog > footer:last-of-type")["flex-wrap"],
    "wrap",
    "the dialog's actions row wraps",
  );
});

Deno.test("a summary's row wraps the label it cannot fit", async () => {
  // The summary's row holds the label and the indicator beside it. A row
  // that cannot wrap pushes the indicator out of the label it belongs to,
  // and a chevron that has left its summary is a disclosure with no state
  // to read. The row that wraps keeps the two together.
  const css = await sheetFor(
    "<details><summary>Deploy</summary><p>Body</p></details>",
  );
  assertEquals(
    declarationsFor(css, "summary")["flex-wrap"],
    "wrap",
    "the summary's row wraps",
  );
});

Deno.test("a disclosure takes the line it is given, so opening it does not reflow the page", async () => {
  // A disclosure is a block-width surface. Left to its own content it is as
  // wide as its summary while closed and as wide as its body while open, so
  // opening one pulled the whole line sideways — the X half of the layout
  // shift. The width is the line's, and the reveal moves only vertically.
  const css = await sheetFor(
    "<details><summary>Deploy</summary><p>Body</p></details>",
  );
  assertEquals(
    declarationsFor(css, "details")["inline-size"],
    "100%",
    "the disclosure owns the width of the line it sits in",
  );
});

Deno.test("a disclosure's indicator sits at the end of its row", async () => {
  // The chevron is the state of the whole row, not a glyph after the label:
  // at the end it reads as the row's control, and it stays there when the
  // label is short or long.
  const css = await sheetFor("<details><summary>Deploy</summary></details>");
  assertEquals(
    declarationsFor(css, "summary::after")["margin-inline-start"],
    "auto",
    "the indicator is the row's trailing edge",
  );
});

Deno.test("a disclosure's indicator points at the content when it opens", async () => {
  // Collapsed, the chevron points right — at the label's continuation.
  // Open, it points down — at the content it has revealed. The two are a
  // quarter turn apart, and the turn is the state a reader sees.
  const css = await sheetFor("<details><summary>Deploy</summary></details>");
  assertEquals(
    declarationsFor(css, "summary::after")["rotate"],
    "-45deg",
    "collapsed points right",
  );
  assertEquals(
    declarationsFor(css, "details[open] > summary::after")["rotate"],
    "45deg",
    "open points down",
  );
});

Deno.test("a card's header stacks its text beside a trailing action", async () => {
  // The header is a grid, not a wrapping flex row: a title and its
  // description share one column, and the action holds the trailing column
  // on the title's line. The flex row put the action wherever the text
  // happened to end, which is how a badge ended up under the description.
  const css = await sheetFor(
    "<card><card-header><card-title>Deploy</card-title><card-description>Running</card-description><card-action><button>Go</button></card-action></card-header></card>",
  );
  assertEquals(declarationsFor(css, "card-header")["display"], "grid");
  assertEquals(
    declarationsFor(css, "card-header")["grid-template-columns"],
    "minmax(0, 1fr) auto",
    "the text takes the room and the action takes what it needs",
  );
  assertEquals(
    declarationsFor(css, "card-title")["grid-column"],
    "1",
    "the title leads the text column",
  );
  assertEquals(
    declarationsFor(css, "card-description")["grid-column"],
    "1",
    "the description sits under the title, not beside the action",
  );
  assertEquals(
    declarationsFor(css, "card-action")["grid-column"],
    "2",
    "the action is the trailing column",
  );
  assertEquals(
    declarationsFor(css, "card-action")["grid-row"],
    "1",
    "and it holds the title's line",
  );
});

Deno.test("a field and a button share one control height", async () => {
  // The two controls sit in the same rows — a search field beside its submit,
  // a form's input above its button — and they used to be two different
  // heights: the button's line box is the type size, the field's was the
  // browser's normal leading. A row of controls that do not line up reads as
  // assembled rather than designed. Both now state the same floor, from the
  // same three theme values.
  const css = await sheetFor("<input><button>Deploy</button>");
  const field = declarationsFor(css, ":is(input, select, textarea)");
  const button = declarationsFor(
    css,
    ':is(button, [type="submit"], [type="reset"], [type="button"], [role="button"])',
  );
  assert(
    field["min-height"] !== undefined,
    "the field states a control-height floor",
  );
  assertEquals(
    field["min-height"],
    button["min-height"],
    "the field and the button derive the same floor",
  );
  assertEquals(
    declarationsFor(css, CONTROL_FIELDS)["height"],
    button["min-height"],
    "the single-line field lands on that same height",
  );
});

Deno.test("a single-line field sets its own leading", async () => {
  // A text field's line box is the control's, not the document's: inherited
  // leading made an input taller than every button beside it. A textarea
  // keeps the prose leading, because its lines are prose.
  const css = await sheetFor("<input><select></select><textarea></textarea>");
  assertEquals(
    declarationsFor(css, CONTROL_FIELDS)["line-height"],
    "1",
    "input and select set a control line box",
  );
});

Deno.test("a dialog arrives over its backdrop instead of appearing", async () => {
  // The panel is in the top layer and has no previous style on its first
  // open, so the entrance needs an explicit "before". The exit needs the two
  // discrete properties in the transition, or `close()` removes the panel at
  // the moment it starts leaving.
  const css = await sheetFor("<dialog><p>Hi</p></dialog>");
  const open = declarationsFor(css, "dialog[open]");
  assertEquals(
    open["transition-property"],
    "opacity, transform, overlay, display",
  );
  assertEquals(open["transition-behavior"], "allow-discrete");
  assert(
    css.includes("@starting-style"),
    "the panel needs a before-state to arrive from",
  );
});

Deno.test("a row of stats wraps when the type scale outgrows it", async () => {
  // The width a row of stats needs is the theme's type scale, and nothing
  // else absorbs the difference: a row that did not wrap shrank the stats
  // instead, and the numbers broke. The row the stat owns wraps.
  const css = await sheetFor(
    '<div class="stat-row"><div class="stat"><div class="stat-value">214</div></div></div>',
  );
  assertEquals(
    declarationsFor(css, ".stat-row")["flex-wrap"],
    "wrap",
    "the stat row wraps",
  );
});

Deno.test("a stat's number is one thing and does not break", async () => {
  // A figure split across two lines is not a figure. Whatever the row it
  // sits in does, the number keeps its own line.
  const css = await sheetFor(
    '<div class="stat"><div class="stat-value">0.42%</div></div>',
  );
  assertEquals(
    declarationsFor(css, ".stat-value")["white-space"],
    "nowrap",
    "the figure does not break",
  );
});

Deno.test("a table carries a minimum, so its columns are never crushed", async () => {
  // `width: 100%` with automatic columns let the browser crush a column
  // until its content fit, which broke a name that cannot break. The table
  // is never narrower than the content it holds: a table too wide for its
  // container is wider, and the container scrolls it.
  const css = await sheetFor(
    "<table><tbody><tr><td>checkout-api</td></tr></tbody></table>",
  );
  assertEquals(
    declarationsFor(css, "table")["min-width"],
    "max-content",
    "the table has a minimum",
  );
});

Deno.test("a table's cell does not re-wrap its content", async () => {
  // A cell holds data, and data is not prose: it does not break because the
  // column is narrow. The cell either fits or the table is wider than the
  // box around it.
  const css = await sheetFor(
    "<table><tbody><tr><td>checkout-api</td></tr></tbody></table>",
  );
  assertEquals(
    declarationsFor(css, ":is(td, th)")["white-space"],
    "nowrap",
    "the cell does not re-wrap",
  );
});

Deno.test("the layout contract holds in every theme", async () => {
  // The defects were found in one theme and are about the type scale, which
  // is a theme's own. So the contract is read in every starter: a footer
  // that wraps in silk wraps in console, and a table with a minimum in one
  // has it in all of them.
  for (const name of Object.keys(starterThemes)) {
    const document = (starterThemes as unknown as Record<
      string,
      Record<string, unknown>
    >)[name];
    const css = await sheetFor(
      "<card><card-header><card-title>Deploy</card-title></card-header><card-footer><button>Deploy</button></card-footer></card>" +
        '<div class="stat-row"><div class="stat"></div></div>' +
        "<table><tbody><tr><td>checkout-api</td></tr></tbody></table>" +
        "<dialog><footer><button>Deploy</button></footer></dialog>" +
        "<details><summary>Deploy</summary></details>",
      document,
    );
    assertEquals(
      declarationsFor(css, "card-footer")["flex-wrap"],
      "wrap",
      `${name}: the card's footer wraps`,
    );
    assertEquals(
      declarationsFor(css, ".stat-row")["flex-wrap"],
      "wrap",
      `${name}: the stat row wraps`,
    );
    assertEquals(
      declarationsFor(css, "table")["min-width"],
      "max-content",
      `${name}: the table has a minimum`,
    );
    assertEquals(
      declarationsFor(css, "dialog > footer:last-of-type")["flex-wrap"],
      "wrap",
      `${name}: the dialog's actions row wraps`,
    );
    assertEquals(
      declarationsFor(css, "summary")["flex-wrap"],
      "wrap",
      `${name}: the summary's row wraps`,
    );
    assertEquals(
      declarationsFor(css, "details")["inline-size"],
      "100%",
      `${name}: the disclosure owns the line's width`,
    );
    assertEquals(
      declarationsFor(css, "card-header")["display"],
      "grid",
      `${name}: the card's header is a grid`,
    );
  }
});

Deno.test("a row of stats is the stat's own class, not a layout utility", async () => {
  // The row is part of the stat, the way the card's footer is part of the
  // card: the element that owns the row owns the wrapping. A consumer who
  // writes the row by hand gets a layout utility's row, and the stat's own
  // row is the one the library ships.
  const css = await sheetFor(
    '<div class="stat-row"><div class="stat"></div></div>',
  );
  const row = declarationsFor(css, ".stat-row");
  assert(
    Object.keys(row).length > 0,
    "the stat's row is a class the preset ships",
  );
  assertEquals(row["display"], "flex", "and it is a row");
});
