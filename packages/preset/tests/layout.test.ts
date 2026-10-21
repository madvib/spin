import { assert, assertEquals } from "@std/assert";
import { createGenerator } from "@unocss/core";
import { readFileSync } from "node:fs";
import { spinPreset } from "../src/index.ts";
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
      "<card><card-footer><button>Deploy</button></card-footer></card>" +
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
