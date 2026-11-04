import type { Rule } from "@unocss/core";

/**
 * Prose — the bare content tags, and a `<prose>` container around them.
 *
 * Prose is BASE, not a toggleable component: document type ships
 * unconditionally and never gates on the classless toggle. Type and reset
 * are document furniture, not a toggleable component — turning `classless`
 * off unstyles custom elements (`button`, `card`) but leaves `h1`–`h6`,
 * `p`, lists, quotations, code, rules and media styled by their tags,
 * everywhere they are written. There are no `.h1` classes.
 *
 * The element vocabulary of a document — headings, paragraphs, lists,
 * quotations, code, rules, media — each styled by the rule keyed on its tag.
 *
 * Two decisions the reference could not state, because a stylesheet has no
 * switch:
 *
 *   **The typography is global.** `<h1>` is a heading, `<blockquote>` is a
 *   quotation; the element is the contract, exactly as it is for the table and
 *   the disclosure. The type and the spacing are the theme's, and they are
 *   spent wherever the element is written — a paragraph outside a document
 *   column reads the same as a paragraph inside one. A page that wants the
 *   tags left alone turns the component off — `spinPreset({ primitives:
 *   ["button"] })` — the same escape hatch every primitive has.
 *
 *   **`<prose>` adds the document's furniture.** The column caps the measure,
 *   drops the leading and trailing margins so the block sits flush in its
 *   container, and — this is what it is FOR — paints the furniture of a
 *   long-form read: the quotation's inset, the media's box, the code block's
 *   chrome, the highlight, the inserted and deleted runs. The furniture
 *   belongs to the document that makes it.
 *
 * Every rule is keyed on the tag it claims, so the whole vocabulary shakes: a
 * document with only `<p>` and `<h2>` emits only those two rules. The spacing
 * is stated per element rather than as a shared block, because a shared rule
 * would have to be keyed on one tag and would drag every other tag's rule in
 * with it.
 *
 * The type is spent from the scale, never minted: a theme moves its prose by
 * moving `font` and `spacing`, and every block follows.
 */

import { blockRules, bodyRule } from "./prose-block.ts";
import { headingRules } from "./prose-heading.ts";
import { inlineRules } from "./prose-inline.ts";
import { mediaRules } from "./prose-media.ts";
import { codeRules } from "./prose-code.ts";

/**
 * The prose component's rules, in emission order.
 *
 * The order is load-bearing: two rules can set the same property on
 * overlapping selectors, and the sheet's order decides which wins when
 * specificity ties. Splitting the rule bodies out by family kept this
 * composition — and therefore that order — exactly as it was.
 *
 * Unconditional: prose is base. Callers always include it; the shake (a
 * document with only `<p>` emits only the paragraph rule) is per-tag, not
 * per-component, so unused elements still emit nothing.
 */
export function proseRules(): Rule[] {
  return [
    bodyRule(),
    proseContainerRule(),
    ...headingRules(),
    ...blockRules(),
    ...codeRules(),
    ...inlineRules(),
    ...mediaRules(),
  ];
}

/** The opt-in column: a measure, and a spacing that sits flush at its edges. */
function proseContainerRule(): Rule {
  return [
    /^prose$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => "prose",
        display: "block",
        // The measure. `ch` scales with the face, so a theme that changes the
        // body face keeps the line length it meant.
        "max-width": "65ch",
      };
      // The spacing is stated between blocks, not around them: the first block
      // starts flush with the container and the last ends flush with it.
      yield {
        [ctx.symbols.selector]: () => "prose > :first-child",
        "margin-block-start": "0",
      };
      yield {
        [ctx.symbols.selector]: () => "prose > :last-child",
        "margin-block-end": "0",
      };
    },
    { layer: "primitives", autocomplete: "prose" },
  ];
}
