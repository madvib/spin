import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import type { Mode } from "./shared.ts";

/**
 * Breadcrumbs — the trail home, claimed as a class on the `<nav>`.
 *
 * A trail is a list of links with separators, and the tempting claim — a bare
 * `<nav>` or `<ol>` — is the wrong one: both are generic elements, and a
 * build tool that restyles every ordered list on a page is a hazard. The
 * honest entry is a class: `breadcrumbs` on the `<nav>`, `breadcrumbs-list`
 * on its `<ol>`. That is why `mode` is unused — there is no tag that
 * genuinely means "breadcrumb trail", so classless has nothing to claim.
 *
 * The separator is content, not a design value: "/" is what a trail has
 * always looked like, so it is a literal typed beside the muted colour it
 * wears rather than a token the theme is asked to choose.
 */
export function breadcrumbsRules(
  roots: readonly string[],
  mode: Mode,
): Rule[] {
  if (!roots.includes("breadcrumbs")) return [];
  return [trailRule(), listRule(), boxRule(), arrowRule()];
}

/** The theme values breadcrumbs spends, resolved once per rule. */
function tokens(ctx: Parameters<typeof themeOf>[0]) {
  const t = themeOf(ctx);
  return {
    sizeSm: t?.fontSize?.["sm"],
    text: t?.colors?.["text"],
    muted: t?.colors?.["text-muted"],
    gap: t?.spacing?.["2"],
    separatorGap: t?.spacing?.["1"],
    spacing2: t?.spacing?.["2"],
    raised: t?.colors?.["surface-raised"],
    border: t?.colors?.["border"],
    borderWidth: t?.borderWidth?.["width"],
    radiusMd: t?.radius?.["md"],
  };
}

/**
 * The trail: its type and spacing, and every rule about what sits in it.
 *
 * One token carries the whole reading — links, separators, the current page —
 * because uno keeps only the first rule matching a token and a document
 * writes `class="breadcrumbs"` once, on the `<nav>`. The item-level rules are
 * descendant selectors rather than classes of their own: a separator or a
 * current page is a fact about an item, not a thing an author names.
 */
function trailRule(): Rule {
  return [
    /^breadcrumbs$/,
    function* (_m, ctx) {
      const t = tokens(ctx);

      // The trail itself: small, muted. A trail is context, not the point of
      // the page, so it takes the caption's type and colour.
      yield {
        [ctx.symbols.selector]: () => ".breadcrumbs",
        ...(t.sizeSm !== undefined ? { "font-size": t.sizeSm } : {}),
        ...(t.muted !== undefined ? { color: t.muted } : {}),
      };

      // A link in the trail is navigable, so it is text-coloured rather than
      // muted: the trail's quietness stops at the thing a reader can act on.
      yield {
        [ctx.symbols.selector]: () => ".breadcrumbs a",
        ...(t.text !== undefined ? { color: t.text } : {}),
        "text-decoration": "none",
      };

      // Underline on hover rather than a colour shift: it is the native
      // affordance, it reads at any contrast, and it leaves the trail's
      // colour story binary — text is navigable, muted is not. The line
      // takes the trail's muted colour, not the ink, so a trail of links
      // does not turn into a row of markers.
      yield {
        [ctx.symbols.selector]: () => ".breadcrumbs a:hover",
        "text-decoration": "underline",
        ...(t.muted !== undefined ? { "text-decoration-color": t.muted } : {}),
      };

      // The current page is where the reader already is: it is not a link,
      // so it takes the trail's muted colour and no link styling at all.
      yield {
        [ctx.symbols.selector]: () => '.breadcrumbs [aria-current="page"]',
        ...(t.muted !== undefined ? { color: t.muted } : {}),
      };

      // Every item is a flex row so the separator — inline content the
      // later items carry and the first does not — cannot change an item's
      // line box. Without this the first step sits a couple of pixels high
      // and the trail reads as broken.
      yield {
        [ctx.symbols.selector]: () => ".breadcrumbs li",
        display: "inline-flex",
        "align-items": "center",
      };

      // The separator, between every item but the first. `::before` on a
      // later sibling means no separator is emitted for item one, and the
      // item itself stays empty of the tree.
      yield {
        [ctx.symbols.selector]: () => ".breadcrumbs li + li::before",
        content: '"/"',
        ...(t.muted !== undefined ? { color: t.muted } : {}),
        ...(t.separatorGap !== undefined
          ? { "padding-inline-start": t.separatorGap }
          : {}),
        ...(t.separatorGap !== undefined
          ? { "padding-inline-end": t.separatorGap }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "breadcrumbs" },
  ];
}

/**
 * The list: the steps in a row, wrapping when the trail is long.
 *
 * Resets are declarations, not tokens — an ordered list brings its own
 * marker, padding and margins, and a trail is not a numbered list, so those
 * are taken away rather than re-chosen. Wrap because a deep trail must not
 * scroll sideways, and a step that lost its place on a second line is a trail
 * that stopped being readable.
 *
 * Baseline alignment rather than centered: an item's box is not the same
 * height with a separator in it as without one, and centering by the box
 * leaves the first step sitting a couple of pixels high — a trail that reads
 * as broken. One baseline is what a trail is.
 */
function listRule(): Rule {
  return [
    /^breadcrumbs-list$/,
    function* (_m, ctx) {
      const { gap } = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".breadcrumbs-list",
        "list-style": "none",
        display: "flex",
        "flex-wrap": "wrap",
        "align-items": "baseline",
        margin: "0",
        padding: "0",
        ...(gap !== undefined ? { gap } : {}),
      };
    },
    { layer: "primitives", autocomplete: "breadcrumbs-list" },
  ];
}

/**
 * The boxed trail: the trail itself as an object — a raised surface with an
 * edge — so a deep trail reads as one thing sitting in the page rather than
 * loose text. The inner list is untouched; the box is a wrapper's decision.
 */
function boxRule(): Rule {
  return [
    /^breadcrumbs-box$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".breadcrumbs.breadcrumbs-box",
        display: "inline-flex",
        ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { border: `${t.borderWidth} solid ${t.border}` }
          : {}),
        ...(t.radiusMd !== undefined ? { "border-radius": t.radiusMd } : {}),
        ...(t.spacing2 !== undefined ? { padding: t.spacing2 } : {}),
      };
    },
    { layer: "primitives", autocomplete: "breadcrumbs-box" },
  ];
}

/**
 * The arrow trail: a chevron instead of a slash. Where the slash reads as
 * prose, the chevron reads as direction — the same trail with an opinion
 * about which way it runs.
 */
function arrowRule(): Rule {
  return [
    /^breadcrumbs-arrow$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".breadcrumbs-arrow li + li::before",
        content: '"›"',
        ...(t.muted !== undefined ? { color: t.muted } : {}),
      };
    },
    { layer: "primitives", autocomplete: "breadcrumbs-arrow" },
  ];
}
