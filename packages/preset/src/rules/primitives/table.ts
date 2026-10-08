import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

/**
 * Table — the first primitive with a strong opinion, and deliberately so.
 *
 * Everywhere else this library states what an element looks like. A table
 * states how data reads, and three of those are decisions a consumer is better
 * served by not having to make:
 *
 * **Numbers line up.** `tabular-nums` on every numeric cell, because a column
 * of figures that shifts width as the digits change cannot be scanned. This is
 * the single opinion most worth taking; without it a price column is unreadable
 * at a glance.
 *
 * **The header is a header.** It sits above the body in weight and colour, and
 * when a table scrolls the header stays. A sticky header is one declaration
 * and the reason a long table is usable at all.
 *
 * **Rules, not boxes.** Cells are separated by a rule that does not shout. A
 * grid of bordered cells is a spreadsheet; a table is a document, and the
 * difference is whether the eye can follow a row across the page.
 *
 * A consumer who disagrees does not reach for a class — they turn the
 * primitive off. `spinPreset({ primitives: ["button"] })` is the escape hatch,
 * and it is the same one every primitive already has, so taking the opinion
 * here costs a consumer exactly what opting out of any other component costs.
 *
 * Scope stays `<th>` rather than `<thead>` for the sticky rule so a table
 * without a header block still gets header cells styled.
 */
export function tableRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("table")) return [];
  // `td` and `th` are claimed together by one rule and then split: uno keeps
  // only the first rule matching a token, so a separate rule per tag would
  // leave the second one unreachable.
  return [
    tableRule(mode),
    cellRule(mode),
    headerRule(mode),
    captionRule(mode),
    stripedRule(mode),
  ];
}

function tableTokens(ctx: Parameters<typeof themeOf>[0]) {
  const t = themeOf(ctx);
  return {
    spacing2: t?.spacing["2"],
    text: t?.colors["text"],
    muted: t?.colors["text-muted"],
    border: t?.colors["border"],
    raised: t?.colors["surface-raised"],
    fontFamily: t?.fontFamily?.["sans"],
    fontSize: t?.fontSize?.["sm"],
    sizeMd: t?.fontSize?.["md"],
    sizeXs: t?.fontSize?.["xs"],
    borderWidth: t?.borderWidth?.["width"],
    weightSemibold: t?.fontWeight?.["semibold"],
  };
}

/**
 * The table itself: the surface, the rhythm, and the containment.
 *
 * `border-collapse: collapse` because a separated-border model puts a gap
 * between cells that the row rules then have to cross, and a collapsed model
 * lets one rule run the full width of the table.
 */
function tableRule(mode: Mode): Rule {
  return [
    /^table$/,
    function* (_m, ctx) {
      const t = tableTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "table"),
        ...(t.fontFamily !== undefined ? { "font-family": t.fontFamily } : {}),
        ...(t.sizeMd !== undefined ? { "font-size": t.sizeMd } : {}),
        ...(t.text !== undefined ? { color: t.text } : {}),
        width: "100%",
        "border-collapse": "collapse",
        "border-spacing": "0",
        // Numeric cells align on the digit. Without this a column of figures
        // has a ragged left edge and cannot be compared down the column.
        "font-variant-numeric": "tabular-nums",
        "text-align": "start",
      };
    },
    { layer: "primitives", autocomplete: "table" },
  ];
}

/**
 * A body cell: padding from the spacing scale, and a rule beneath.
 *
 * The rule is on the cell rather than the row so a row's border disappears
 * with the row — a `border-bottom` on `<tr>` survives a collapsed model
 * inconsistently when cells have their own padding.
 */
function cellRule(mode: Mode): Rule {
  // A cell is either element or class, and the rule states both tags at once.
  const cell = mode.classless ? ":is(td, th)" : ":is(.td, .th)";
  return [
    /^(?:td|th)$/,
    function* (_m, ctx) {
      const t = tableTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => cell,
        ...(t.spacing2 !== undefined
          ? {
            "padding-block-start": t.spacing2,
            "padding-block-end": t.spacing2,
            "padding-inline-start": t.spacing2,
            "padding-inline-end": t.spacing2,
          }
          : {}),
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { "border-bottom": `${t.borderWidth} solid ${t.border}` }
          : {}),
      };
      // The last row has nothing beneath it to separate from. The position
      // that matters is the ROW's, so the selector reaches through it — a bare
      // `:last-child` on the cell selects the final column instead, which is
      // what left the table with a rule under its final row.
      yield {
        [ctx.symbols.selector]: () =>
          `:is(tbody, tfoot, thead) > tr:last-child > ${cell}`,
        ...(t.borderWidth !== undefined ? { "border-bottom": "none" } : {}),
      };
      // A caption belongs above the header row, so the first row needs no
      // rule above it either.
      yield {
        [ctx.symbols.selector]: () => ":is(tbody, thead) > tr:first-child > *",
        ...(t.borderWidth !== undefined ? { "border-top": "none" } : {}),
      };
      // A footer's rule is above its cells, not below: it separates the totals
      // from the rows above them, and a rule hanging beneath the last total
      // says nothing.
      yield {
        [ctx.symbols.selector]: () => `tfoot > tr > ${cell}`,
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { "border-top": `${t.borderWidth} solid ${t.border}` }
          : {}),
        "border-bottom": "none",
        ...(t.weightSemibold !== undefined
          ? { "font-weight": t.weightSemibold }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "td" },
  ];
}

/**
 * A header cell: heavier, quieter, and sticky when the table scrolls.
 *
 * Sticky is the opinion that pays for itself. A header that scrolls away turns
 * a twenty-row table into a guessing game about what each column holds.
 */
function headerRule(mode: Mode): Rule {
  return [
    /^th$/,
    function* (_m, ctx) {
      const t = tableTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "th"),
        ...(t.fontSize !== undefined ? { "font-size": t.fontSize } : {}),
        ...(t.muted !== undefined ? { color: t.muted } : {}),
        ...(t.weightSemibold !== undefined
          ? { "font-weight": t.weightSemibold }
          : {}),
        "text-align": "start",
        // `collapse` clips a sticky cell's background, so the header needs its
        // own surface or rows show through it as they pass underneath.
        ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
        position: "sticky",
        "inset-block-start": "0",
        "z-index": "1",
      };
      // The header's rule sits below its content, separating it from the body
      // it labels. `border-collapse` clips an inset shadow, so a sticky
      // header cannot separate itself with one — it needs a real border, and
      // the cell rule already gave it one. Stated again here at the header's
      // own weight so it reads stronger than the row rules beneath it.
      yield {
        [ctx.symbols.selector]: () => claim(mode, "th"),
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? {
            "border-bottom": `${t.borderWidth} solid ${t.border}`,
            "border-bottom-color": t.muted ?? t.border,
          }
          : {}),
      };
      // A cell whose column is mostly figures reads better aligned to the
      // digit than to the text start, and that is what the author means by
      // the element anyway.
      yield {
        [ctx.symbols.selector]: () => "th[scope=\"col\"][data-align=\"end\"]",
        "text-align": "end",
      };
    },
    { layer: "primitives", autocomplete: "th" },
  ];
}

/**
 * A caption: quiet, above the table, and the only element allowed to sit
 * outside it.
 */
function captionRule(mode: Mode): Rule {
  return [
    /^caption$/,
    function* (_m, ctx) {
      const t = tableTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "caption"),
        ...(t.sizeXs !== undefined ? { "font-size": t.sizeXs } : {}),
        ...(t.muted !== undefined ? { color: t.muted } : {}),
        "text-align": "start",
        ...(t.spacing2 !== undefined ? { "padding-block-end": t.spacing2 } : {}),
      };
    },
    { layer: "primitives", autocomplete: "caption" },
  ];
}

/**
 * Striped rows.
 *
 * The one thing here that stays a class, because no element expresses "every
 * other row" — it is a density choice about reading across a wide table, not a
 * thing a cell is. Zebra striping helps a reader hold their place; it is also
 * the most common table preference to disagree with, so it is opt-in.
 */
function stripedRule(mode: Mode): Rule {
  return [
    /^striped$/,
    function* (_m, ctx) {
      const t = tableTokens(ctx);
      yield {
        [ctx.symbols.selector]: () =>
          `${claim(mode, "table")}.striped tbody > tr:nth-of-type(odd) > *`,
        ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
      };
    },
    { layer: "primitives", autocomplete: "striped" },
  ];
}
