import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { readFileSync } from "node:fs";
import { spinPreset } from "../src/index.ts";
import { CONTROL_FIELDS } from "../src/rules/primitives/field.ts";
import { designLanguages } from "@spinjs/theme";

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
  "../../theme/src/languages/minimal.json",
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
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
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
  // Uno merges adjacent rules that declare the same things into one rule
  // with a selector list, so a selector is read as one entry of that list.
  const at = new RegExp(
    "(?:^|,)" + wanted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:,|$)",
  );
  const found: Record<string, string> = {};
  for (const rule of rulesOf(css)) {
    const parts = rule.selector.replace(/\s+/g, "");
    if (at.test(parts)) {
      Object.assign(found, rule.declarations);
    }
  }
  return found;
}

test("a card's footer wraps the actions it cannot fit", async () => {
  // A card is a container and its footer is part of the card: two buttons
  // that do not fit in a narrow column used to be pushed out of the surface
  // they belong to. The row that wraps is what keeps the card whole.
  const css = await sheetFor(
    "<card><card-footer><button>Deploy</button><button>Roll back</button></card-footer></card>",
  );
  deepStrictEqual(
    declarationsFor(css, "card-footer")["flex-wrap"],
    "wrap",
    "the footer's row wraps",
  );
});

test("a card's action wraps the controls it cannot fit", async () => {
  // The action is the header's trailing slot, and it holds controls. A slot
  // wider than the card pushes them out of it, so the slot wraps too.
  const css = await sheetFor(
    "<card><card-header><card-action><button>Deploy</button></card-action></card-header></card>",
  );
  deepStrictEqual(
    declarationsFor(css, "card-action")["flex-wrap"],
    "wrap",
    "the action's row wraps",
  );
});

test("an alert laid out as a row wraps", async () => {
  // The horizontal form of an alert is a row of content — an icon beside a
  // message — and a row that cannot wrap pushes the message out of the
  // alert. The alert is a block, so the declaration is inert until a
  // consumer makes it a row; it is stated so that row wraps when they do.
  const css = await sheetFor('<alert role="status">Deploy #4821</alert>');
  deepStrictEqual(
    declarationsFor(css, "alert")["flex-wrap"],
    "wrap",
    "the alert's row wraps",
  );
});

test("a dialog's actions row wraps the buttons it cannot fit", async () => {
  // The footer of a dialog holds the dialog's actions, and a dialog is a
  // panel: a row that cannot hold the buttons pushes them out of the panel
  // they belong to, and a dialog whose actions have left it is a dialog with
  // no way out. The row that wraps is what keeps the panel whole.
  const css = await sheetFor(
    "<dialog><footer><button>Cancel</button><button>Deploy</button></footer></dialog>",
  );
  deepStrictEqual(
    declarationsFor(css, "dialog > footer:last-of-type")["flex-wrap"],
    "wrap",
    "the dialog's actions row wraps",
  );
});

test("a summary's row wraps the label it cannot fit", async () => {
  // The summary's row holds the label and the indicator beside it. A row
  // that cannot wrap pushes the indicator out of the label it belongs to,
  // and a chevron that has left its summary is a disclosure with no state
  // to read. The row that wraps keeps the two together.
  const css = await sheetFor(
    "<details><summary>Deploy</summary><p>Body</p></details>",
  );
  deepStrictEqual(
    declarationsFor(css, "summary")["flex-wrap"],
    "wrap",
    "the summary's row wraps",
  );
});

test("a disclosure takes the line it is given, so opening it does not reflow the page", async () => {
  // A disclosure is a block-width surface. Left to its own content it is as
  // wide as its summary while closed and as wide as its body while open, so
  // opening one pulled the whole line sideways — the X half of the layout
  // shift. The width is the line's, and the reveal moves only vertically.
  const css = await sheetFor(
    "<details><summary>Deploy</summary><p>Body</p></details>",
  );
  deepStrictEqual(
    declarationsFor(css, "details")["inline-size"],
    "100%",
    "the disclosure owns the width of the line it sits in",
  );
});

test("a disclosure's indicator sits at the end of its row", async () => {
  // The chevron is the state of the whole row, not a glyph after the label:
  // at the end it reads as the row's control, and it stays there when the
  // label is short or long.
  const css = await sheetFor("<details><summary>Deploy</summary></details>");
  deepStrictEqual(
    declarationsFor(css, "summary::after")["margin-inline-start"],
    "auto",
    "the indicator is the row's trailing edge",
  );
});

test("a disclosure's indicator points at the content when it opens", async () => {
  // Collapsed, the chevron points right — at the label's continuation.
  // Open, it points down — at the content it has revealed. The two are a
  // quarter turn apart, and the turn is the state a reader sees.
  const css = await sheetFor("<details><summary>Deploy</summary></details>");
  deepStrictEqual(
    declarationsFor(css, "summary::after")["rotate"],
    "-45deg",
    "collapsed points right",
  );
  deepStrictEqual(
    declarationsFor(css, "details[open] > summary::after")["rotate"],
    "45deg",
    "open points down",
  );
});

test("a card's header stacks its text beside a trailing action", async () => {
  // The header is a grid, not a wrapping flex row: a title and its
  // description share one column, and the action holds the trailing column
  // on the title's line. The flex row put the action wherever the text
  // happened to end, which is how a badge ended up under the description.
  const css = await sheetFor(
    "<card><card-header><card-title>Deploy</card-title><card-description>Running</card-description><card-action><button>Go</button></card-action></card-header></card>",
  );
  deepStrictEqual(declarationsFor(css, "card-header")["display"], "grid");
  deepStrictEqual(
    declarationsFor(css, "card-header")["grid-template-columns"],
    "minmax(0, 1fr) auto",
    "the text takes the room and the action takes what it needs",
  );
  deepStrictEqual(
    declarationsFor(css, "card-title")["grid-column"],
    "1",
    "the title leads the text column",
  );
  deepStrictEqual(
    declarationsFor(css, "card-description")["grid-column"],
    "1",
    "the description sits under the title, not beside the action",
  );
  deepStrictEqual(
    declarationsFor(css, "card-action")["grid-column"],
    "2",
    "the action is the trailing column",
  );
  deepStrictEqual(
    declarationsFor(css, "card-action")["grid-row"],
    "1",
    "and it holds the title's line",
  );
});

test("every form control spends one shared height floor", async () => {
  // A toolbar is four controls in one row — a button, a text field, a search
  // field, a select — and each is a DIFFERENT rule: the button's, the field
  // box's, the single-line yield's, the search yield's. The row aligns only
  // when all four spend the same floor, whatever subset the page names: a
  // page with only a select and a button aligns those two.
  for (const [name, document] of Object.entries(designLanguages)) {
    const floors = new Set<string>();
    for (
      const markup of [
        "<button>Deploy</button>",
        "<input>",
        '<input type="search">',
        "<select><option>a</option></select>",
      ]
    ) {
      const css = await sheetFor(markup, document);
      const floor = declarationsFor(css, ":is(input, textarea, select)")["min-height"] ??
        declarationsFor(css, CONTROL_FIELDS)["min-height"] ??
        declarationsFor(css, 'input[type="search"]')["min-height"] ??
        declarationsFor(
          css,
          ':is(button:where(:not([role])), :where([type="submit"], [type="reset"], [type="button"]:not([role]), [role="button"]))',
        )["min-height"];
      assert(
        floor !== undefined,
        `${name}: ${markup} spends no control-height floor`,
      );
      floors.add(floor);
    }
    deepStrictEqual(
      [...floors],
      [
        "calc(max(var(--font-style-body-size) * var(--font-style-body-leading), var(--font-style-label-size) * var(--font-style-label-leading)) + (2 * var(--spacing-2)) + (2 * var(--border-width)))",
      ],
      `${name}: the four controls share one floor`,
    );
  }
});

test("a control keeps its floor in every layout container", async () => {
  // The floor is a MINIMUM, not a height: a fixed `height` on any control
  // selector would pin it while its siblings stretch, re-opening the 2–3px
  // `.join` step in every `flex`, `inline-flex`, `grid`, and `<form>` row.
  // The joins' own `width: auto` / `flex: 1 1 auto` reset is what frees a
  // joined field from the field box's full-line width — stated on
  // `.join > *`, never on the control itself.
  for (const [name, document] of Object.entries(designLanguages)) {
    for (
      const markup of [
        '<div class="flex"><input><select><option>a</option></select><button>Go</button></div>',
        '<div class="inline-flex"><input><select><option>a</option></select><button>Go</button></div>',
        '<div class="grid"><input><select><option>a</option></select><button>Go</button></div>',
        "<form><input><select><option>a</option></select><button>Go</button></form>",
        '<div class="join"><input class="join-item" type="search"><button class="join-item">Go</button></div>',
      ]
    ) {
      const css = await sheetFor(markup, document);
      for (
        const selector of [
          ":is(input, textarea, select)",
          CONTROL_FIELDS,
          ':is(button:where(:not([role])), :where([type="submit"], [type="reset"], [type="button"]:not([role]), [role="button"]))',
        ]
      ) {
        const decls = declarationsFor(css, selector);
        assert(
          decls["min-height"] !== undefined,
          `${name}: ${selector} spends no floor in ${markup}`,
        );
        deepStrictEqual(
          decls["height"],
          undefined,
          `${name}: ${selector} pins a fixed height in ${markup}`,
        );
      }
    }
    const css = await sheetFor(
      '<div class="join"><input class="join-item" type="search"><button class="join-item">Go</button></div>',
    );
    deepStrictEqual(
      declarationsFor(css, ".join > *")["width"],
      "auto",
      "the join frees a joined field from the field box's full-line width",
    );
    deepStrictEqual(
      declarationsFor(css, ".join > *")["flex"],
      "1 1 auto",
      "joined items split the line evenly from their contents",
    );
  }
});

test("a field in a row flex container sizes from its contents", async () => {
  // The field box's `width: 100%` fills a form line — but as a flex item it
  // is a full-row basis, so a bare input beside a button wrapped to its own
  // line instead of siding by side. The row flex rules reset a direct field
  // child to content width; column flex keeps the full-line width.
  for (const utility of ["flex", "inline-flex"]) {
    const css = await sheetFor(`<div class="${utility}"><input></div>`);
    deepStrictEqual(
      declarationsFor(
        css,
        `.${utility}:not(.flex-col):not(.flex-col-reverse) > :is(input, textarea, select)`,
      )["width"],
      "auto",
      `${utility} frees a direct field child to its contents`,
    );
  }
});

test("a field and a button share one control height", async () => {
  // The two controls sit in the same rows — a search field beside its submit,
  // a form's input above its button — and they used to be two different
  // heights: the button's line box was its type size, while the field's was
  // the browser's normal leading, then its hard `height` stopped flex parents
  // from stretching the shorter control to its sibling. One shared floor now:
  // the tallest of the body and label voices' line boxes, plus the shared
  // padding step and edge weight — the same `min-height` in the button, the
  // field box, and the single-line fields, so all three land together in
  // every flex, grid and join row.
  for (const name of ["minimal", "editorial"] as const) {
    const css = await sheetFor(
      "<input><select><option>a</option></select><button>Deploy</button>",
      designLanguages[name],
    );
    const field = declarationsFor(css, ":is(input, textarea, select)");
    const button = declarationsFor(
      css,
      ':is(button:where(:not([role])), :where([type="submit"], [type="reset"], [type="button"]:not([role]), [role="button"]))',
    );
    const single = declarationsFor(css, CONTROL_FIELDS);
    const floor =
      "calc(max(var(--font-style-body-size) * var(--font-style-body-leading), var(--font-style-label-size) * var(--font-style-label-leading)) + (2 * var(--spacing-2)) + (2 * var(--border-width)))";
    deepStrictEqual(
      button["min-height"],
      floor,
      `${name}: the button spends the shared control-height floor`,
    );
    deepStrictEqual(
      field["min-height"],
      floor,
      `${name}: the field box spends the same floor`,
    );
    deepStrictEqual(
      single["min-height"],
      floor,
      `${name}: the single-line field stretches to the same floor`,
    );
  }
});

test("a joined field stretches with its submit instead of stepping", async () => {
  // The production seam: `<div class="join">` with a search input beside its
  // submit used to step 2–3px, because the input's hard `height` refused the
  // container's `stretch` while the button filled it. The single-line fields
  // spend a `min-height` floor now, and the join resets a joined field to the
  // inline-flex default — so the pair fills the line together.
  const css = await sheetFor(
    '<div class="join"><input class="join-item" type="search" placeholder="Search services"><button class="join-item" type="submit">Search</button></div><select><option>a</option></select>',
  );
  deepStrictEqual(
    declarationsFor(css, CONTROL_FIELDS)["min-height"],
    declarationsFor(
      css,
      ':is(button:where(:not([role])), :where([type="submit"], [type="reset"], [type="button"]:not([role]), [role="button"]))',
    )["min-height"],
    "input and button share one floor inside the join",
  );
  deepStrictEqual(
    declarationsFor(css, ".join > *")["width"],
    "auto",
    "the join frees a joined field from the field box's full-line width",
  );
  deepStrictEqual(
    declarationsFor(css, ".join > *")["flex"],
    "1 1 auto",
    "joined items split the line evenly from their contents",
  );
});

test("a small field lands on the small button height", async () => {
  // The size steps move together: s-sm reads the label size through the
  // label style on both controls, s-lg the subtitle size through the
  // subtitle style. Both land on their step's floor, and the default floor
  // is still the taller md one.
  const css = await sheetFor(
    '<input class="s-sm"><button class="s-sm">Go</button>',
  );
  const field = declarationsFor(css, ":is(input, select).s-sm");
  const button = declarationsFor(
    css,
    ':is(button:where(:not([role])), :where([type="submit"], [type="reset"], [type="button"]:not([role]), [role="button"])).s-sm',
  );
  deepStrictEqual(
    field["min-height"],
    "calc(var(--font-style-label-size) + (2 * var(--spacing-1)) + (2 * var(--border-width)))",
    "the small field lands on the small floor",
  );
  deepStrictEqual(
    button["min-height"],
    "calc(var(--button-s-sm-type-size) + (2 * var(--spacing-1)) + (2 * var(--border-width)))",
    "the small button lands on its own small tuple, which defaults to the label style",
  );
  const md = declarationsFor(css, CONTROL_FIELDS)["min-height"];
  assert(
    md !== undefined && md !== field["min-height"],
    "the default field step is still md",
  );
});

test("a single-line field sets its own leading", async () => {
  // A text field's line box is the control's, not the document's: inherited
  // leading made an input taller than every button beside it. A textarea
  // keeps the prose leading, because its lines are prose.
  const css = await sheetFor("<input></input><textarea></textarea>");
  deepStrictEqual(
    declarationsFor(css, CONTROL_FIELDS)["line-height"],
    "1",
    "input sets a control line box",
  );
});

test("a dialog arrives over its backdrop instead of appearing", async () => {
  // The panel is in the top layer and has no previous style on its first
  // open, so the entrance needs an explicit "before". The exit needs the two
  // discrete properties in the transition, or `close()` removes the panel at
  // the moment it starts leaving.
  const css = await sheetFor("<dialog><p>Hi</p></dialog>");
  const open = declarationsFor(css, "dialog[open]");
  deepStrictEqual(
    open["transition-property"],
    "opacity, transform, overlay, display",
  );
  deepStrictEqual(open["transition-behavior"], "allow-discrete");
  assert(
    css.includes("@starting-style"),
    "the panel needs a before-state to arrive from",
  );
});

test("a row of stats wraps when the type scale outgrows it", async () => {
  // The width a row of stats needs is the theme's type scale, and nothing
  // else absorbs the difference: a row that did not wrap shrank the stats
  // instead, and the numbers broke. The row the stat owns wraps.
  const css = await sheetFor(
    '<div class="stat-row"><div class="stat"><div class="stat-value">214</div></div></div>',
  );
  deepStrictEqual(
    declarationsFor(css, ".stat-row")["flex-wrap"],
    "wrap",
    "the stat row wraps",
  );
});

test("a stat's number is one thing and does not break", async () => {
  // A figure split across two lines is not a figure. Whatever the row it
  // sits in does, the number keeps its own line.
  const css = await sheetFor(
    '<div class="stat"><div class="stat-value">0.42%</div></div>',
  );
  deepStrictEqual(
    declarationsFor(css, ".stat-value")["white-space"],
    "nowrap",
    "the figure does not break",
  );
});

test("a table carries a minimum, so its columns are never crushed", async () => {
  // `width: 100%` with automatic columns let the browser crush a column
  // until its content fit, which broke a name that cannot break. The table
  // is never narrower than the content it holds: a table too wide for its
  // container is wider, and the container scrolls it.
  const css = await sheetFor(
    "<table><tbody><tr><td>checkout-api</td></tr></tbody></table>",
  );
  deepStrictEqual(
    declarationsFor(css, "table")["min-width"],
    "max-content",
    "the table has a minimum",
  );
});

test("a table's cell does not re-wrap its content", async () => {
  // A cell holds data, and data is not prose: it does not break because the
  // column is narrow. The cell either fits or the table is wider than the
  // box around it.
  const css = await sheetFor(
    "<table><tbody><tr><td>checkout-api</td></tr></tbody></table>",
  );
  deepStrictEqual(
    declarationsFor(css, ":is(td, th)")["white-space"],
    "nowrap",
    "the cell does not re-wrap",
  );
});

test("the layout contract holds in every theme", async () => {
  // The defects were found in one theme and are about the type scale, which
  // is a theme's own. So the contract is read in every language: a footer
  // that wraps in minimal wraps in glassmorphic, and a table with a minimum
  // in one has it in all of them.
  for (const [name, document] of Object.entries(designLanguages)) {
    const css = await sheetFor(
      "<card><card-header><card-title>Deploy</card-title></card-header><card-footer><button>Deploy</button></card-footer></card>" +
        '<div class="stat-row"><div class="stat"></div></div>' +
        "<table><tbody><tr><td>checkout-api</td></tr></tbody></table>" +
        "<dialog><footer><button>Deploy</button></footer></dialog>" +
        "<details><summary>Deploy</summary></details>",
      document,
    );
    deepStrictEqual(
      declarationsFor(css, "card-footer")["flex-wrap"],
      "wrap",
      `${name}: the card's footer wraps`,
    );
    deepStrictEqual(
      declarationsFor(css, ".stat-row")["flex-wrap"],
      "wrap",
      `${name}: the stat row wraps`,
    );
    deepStrictEqual(
      declarationsFor(css, "table")["min-width"],
      "max-content",
      `${name}: the table has a minimum`,
    );
    deepStrictEqual(
      declarationsFor(css, "dialog > footer:last-of-type")["flex-wrap"],
      "wrap",
      `${name}: the dialog's actions row wraps`,
    );
    deepStrictEqual(
      declarationsFor(css, "summary")["flex-wrap"],
      "wrap",
      `${name}: the summary's row wraps`,
    );
    deepStrictEqual(
      declarationsFor(css, "details")["inline-size"],
      "100%",
      `${name}: the disclosure owns the line's width`,
    );
    deepStrictEqual(
      declarationsFor(css, "card-header")["display"],
      "grid",
      `${name}: the card's header is a grid`,
    );
  }
});

test("a row of stats is the stat's own class, not a layout utility", async () => {
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
  deepStrictEqual(row["display"], "flex", "and it is a row");
});

test("a bare label stacks vertically while <label class=\"flex\"> lays out as a row without .flex-row", async () => {
  const css = await sheetFor(
    '<label class="flex items-center gap-2"><input type="search"><kbd>K</kbd></label>',
  );
  deepStrictEqual(
    declarationsFor(css, "label")["flex-direction"],
    "column",
  );
  deepStrictEqual(
    declarationsFor(css, ":where(label).flex:where(:not(.flex-col):not(.flex-col-reverse))")["flex-direction"],
    "row",
  );
});

test("an icon button sets min-width to match control height so it stays square in flex rows", async () => {
  const css = await sheetFor('<button type="button" class="icon">x</button>');
  const baseDecls = declarationsFor(
    css,
    ':is(button:where(:not([role])), :where([type="submit"], [type="reset"], [type="button"]:not([role]), [role="button"]))',
  );
  const iconDecls = declarationsFor(
    css,
    ':is(button:where(:not([role])), :where([type="submit"], [type="reset"], [type="button"]:not([role]), [role="button"])).icon, :is(button:where(:not([role])), :where([type="submit"], [type="reset"], [type="button"]:not([role]), [role="button"]))[variant~="icon"]',
  );
  assert(
    baseDecls["min-height"] !== undefined,
    "the button base declares min-height",
  );
  deepStrictEqual(
    iconDecls["min-width"],
    baseDecls["min-height"],
    "icon button min-width matches button control min-height",
  );
});

test("a link acting as a button clears text-decoration above bare <a>", async () => {
  const css = await sheetFor('<a href="/demo" role="button" class="primary">Demo</a>');
  const decls = declarationsFor(css, '[role="button"]');
  deepStrictEqual(
    decls["text-decoration"],
    "none",
    "role=button clears the <a> underline with higher specificity than bare <a>",
  );
});
