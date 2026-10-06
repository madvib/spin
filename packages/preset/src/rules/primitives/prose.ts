import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, proseTokens, rhythm, type Mode, type Tokens } from "./shared.ts";
import { codeRules } from "./prose-code.ts";
import { inlineRules } from "./prose-inline.ts";
import { mediaRules } from "./prose-media.ts";

/**
 * Prose — the bare content tags, and a `<prose>` container around them.
 *
 * This is the migration of `packages/primitives/reference/content.css` into
 * rules. The reference styled the element vocabulary of a document — headings,
 * paragraphs, lists, quotations, code, rules, media — and every one of those
 * decisions is preserved here; nothing is left in the legacy stylesheet.
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
export function proseRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("prose")) return [];
  return [
    bodyRule(mode),
    proseContainerRule(mode),
    ...headingRules(mode),
    paragraphRule(mode),
    listRule(mode, "ul"),
    listRule(mode, "ol"),
    listItemRule(mode),
    definitionListRule(mode),
    termRule(mode),
    definitionRule(mode),
    blockquoteRule(mode),
    hrRule(mode),
    ...codeRules(roots, mode),
    ...inlineRules(roots, mode),
    ...mediaRules(roots, mode),
  ];
}

/** The theme values prose spends, resolved once per rule. */

/**
 * The document itself: the page's type and its surface.
 *
 * `layout` owns the body's display; this states what the text looks like on
 * it. Both are rules now, so neither wins by source order — they set different
 * properties.
 */
function bodyRule(mode: Mode): Rule {
  return [
    /^body$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "body"),
        ...(t.sans !== undefined ? { "font-family": t.sans } : {}),
        ...(t.sizeMd !== undefined ? { "font-size": t.sizeMd } : {}),
        "line-height": "1.5",
        ...(t.text !== undefined ? { color: t.text } : {}),
        ...(t.surface !== undefined ? { "background-color": t.surface } : {}),
        margin: "0",
      };
    },
    { layer: "primitives", autocomplete: "body" },
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

/**
 * A heading: the scale step, the heading face, and the rhythm.
 *
 * The gap above a heading is what makes it read as a heading and the gap below
 * is what makes it read as attached to what follows, so the heading states its
 * own block start. The type declarations are the one thing that differs
 * between the six, and they arrive as a function of the tokens.
 */
function headingRule(
  mode: Mode,
  tag: string,
  type: (t: Tokens) => Record<string, string | undefined>,
): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, tag),
        ...(t.heading !== undefined ? { "font-family": t.heading } : {}),
        ...rhythm(t),
        ...(t.spacing4 !== undefined
          ? { "margin-block-start": t.spacing4 }
          : {}),
        ...type(t),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

function headingRules(mode: Mode): Rule[] {
  return [
    headingRule(mode, "h1", (t) => ({
      ...(t.size3xl !== undefined ? { "font-size": t.size3xl } : {}),
      ...(t.weightBold !== undefined ? { "font-weight": t.weightBold } : {}),
      "line-height": "1.2",
      "letter-spacing": "-0.02em",
      // A heading level one leads the document, so its bottom gap is a step
      // larger than the shared rhythm.
      ...(t.spacing4 !== undefined ? { "margin-block-end": t.spacing4 } : {}),
    })),
    headingRule(mode, "h2", (t) => ({
      ...(t.size2xl !== undefined ? { "font-size": t.size2xl } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.3",
      "letter-spacing": "-0.01em",
    })),
    headingRule(mode, "h3", (t) => ({
      ...(t.sizeXl !== undefined ? { "font-size": t.sizeXl } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.4",
    })),
    headingRule(mode, "h4", (t) => ({
      ...(t.sizeLg !== undefined ? { "font-size": t.sizeLg } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.4",
    })),
    headingRule(mode, "h5", (t) => ({
      ...(t.sizeMd !== undefined ? { "font-size": t.sizeMd } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.5",
    })),
    headingRule(mode, "h6", (t) => ({
      ...(t.sizeMd !== undefined ? { "font-size": t.sizeMd } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.5",
    })),
  ];
}

function paragraphRule(mode: Mode): Rule {
  return [
    /^p$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => claim(mode, "p"),
        ...rhythm(proseTokens(ctx)),
      };
    },
    { layer: "primitives", autocomplete: "p" },
  ];
}

/** A list: the shared rhythm, and an indent the markers hang off. */
function listRule(mode: Mode, tag: string): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, tag),
        ...rhythm(t),
        ...(t.spacing4 !== undefined
          ? { "padding-inline-start": t.spacing4 }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

/** Items breathe a step apart, so a long list stays scannable. */
function listItemRule(mode: Mode): Rule {
  const li = claim(mode, "li");
  return [
    /^li$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => `${li} + ${li}`,
        ...(t.spacing1 !== undefined ? { "margin-block-start": t.spacing1 } : {}),
      };
    },
    { layer: "primitives", autocomplete: "li" },
  ];
}

function definitionListRule(mode: Mode): Rule {
  return [
    /^dl$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => claim(mode, "dl"),
        ...rhythm(proseTokens(ctx)),
      };
    },
    { layer: "primitives", autocomplete: "dl" },
  ];
}

function termRule(mode: Mode): Rule {
  return [
    /^dt$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "dt"),
        ...(t.weightSemibold !== undefined
          ? { "font-weight": t.weightSemibold }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "dt" },
  ];
}

function definitionRule(mode: Mode): Rule {
  return [
    /^dd$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "dd"),
        ...(t.spacing4 !== undefined
          ? { "margin-inline-start": t.spacing4 }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "dd" },
  ];
}

/**
 * A quotation: an inset block with a rule in the margin.
 *
 * The footer that carries the attribution is reached through the blockquote,
 * so an ordinary `<footer>` elsewhere is not styled as one.
 */
function blockquoteRule(mode: Mode): Rule {
  const blockquote = claim(mode, "blockquote");
  return [
    /^blockquote$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => blockquote,
        ...rhythm(t),
        ...(t.spacing2 !== undefined && t.spacing4 !== undefined
          ? { padding: `${t.spacing2} ${t.spacing4}` }
          : {}),
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { "border-inline-start": `${t.borderWidth} solid ${t.border}` }
          : {}),
        ...(t.muted !== undefined ? { color: t.muted } : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${blockquote} ${claim(mode, "footer")}`,
        ...(t.spacing1 !== undefined ? { "margin-block-start": t.spacing1 } : {}),
        ...(t.sizeSm !== undefined ? { "font-size": t.sizeSm } : {}),
      };
    },
    { layer: "primitives", autocomplete: "blockquote" },
  ];
}

function hrRule(mode: Mode): Rule {
  return [
    /^hr$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "hr"),
        height: "0",
        ...(t.spacing4 !== undefined ? { "margin-block": t.spacing4 } : {}),
        border: "0",
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { "border-block-start": `${t.borderWidth} solid ${t.border}` }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "hr" },
  ];
}
