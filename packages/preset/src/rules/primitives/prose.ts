import {
  claim,
  type Mode,
  proseTokens,
  rhythm,
  type Tokens,
} from "./shared.ts";

/**
 * Prose — the bare content tags, and a `<prose>` container around them.
 *
 * The element vocabulary of a document — headings, paragraphs, lists,
 * quotations, code, rules, media — each styled by the rule keyed on its tag.
 *
 * Two decisions the reference could not state, because a stylesheet has no
 * switch:
 *
 *   **The tags are styled globally.** `<h1>` is a heading, `<blockquote>` is a
 *   quotation; the element is the contract, exactly as it is for the table and
 *   the disclosure. A page that wants the tags left alone turns the component
 *   off — `spinPreset({ primitives: ["button"] })` — the same escape hatch
 *   every primitive has.
 *
 *   **`<prose>` constrains the measure and closes the rhythm.** The bare tags
 *   are what a document already writes; `<prose>` is the opt-in column around
 *   them, capping the line length and dropping the leading and trailing margins
 *   so the block sits flush in its container.
 *
 * Every rule is keyed on the tag it claims, so the whole vocabulary shakes: a
 * document with only `<p>` and `<h2>` emits only those two rules. The rhythm
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
import type { Rule } from "@unocss/core";

/**
 * The prose component's rules, in emission order.
 *
 * The order is load-bearing: two rules can set the same property on
 * overlapping selectors, and the sheet's order decides which wins when
 * specificity ties. Splitting the rule bodies out by family kept this
 * composition — and therefore that order — exactly as it was.
 */
export function proseRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("prose")) return [];
  return [
    bodyRule(mode),
    proseContainerRule(mode),
    ...headingRules(mode),
    ...blockRules(mode),
    ...codeRules(roots, mode),
    ...inlineRules(roots, mode),
    ...mediaRules(roots, mode),
  ];
}

/** The opt-in column: a measure, and a rhythm that sits flush at its edges. */
function proseContainerRule(mode: Mode): Rule {
  const prose = claim(mode, "prose");
  return [
    /^prose$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => prose,
        display: "block",
        // The measure. `ch` scales with the face, so a theme that changes the
        // body face keeps the line length it meant.
        "max-width": "65ch",
      };
      // The rhythm is stated between blocks, not around them: the first block
      // starts flush with the container and the last ends flush with it.
      yield {
        [ctx.symbols.selector]: () => `${prose} > :first-child`,
        "margin-block-start": "0",
      };
      yield {
        [ctx.symbols.selector]: () => `${prose} > :last-child`,
        "margin-block-end": "0",
      };
    },
    { layer: "primitives", autocomplete: "prose" },
  ];
}
