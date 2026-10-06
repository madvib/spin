import type { Rule } from "@unocss/core";
import { themeOf } from "../utils/lookup.ts";

/**
 * Tones — the theme's palette, offered as utilities.
 *
 * A tone is not a component variant. A tone is a colour the theme declares,
 * paired with the foreground that reads on it, and the point of grouping them
 * is that a button and a badge and an alert can all be *toned* without any of
 * them owning the list. The palette belongs to the theme; a component decides
 * only whether it can carry one.
 *
 * The distinction matters because of how uno resolves tokens. A rule keyed on
 * `accent` is the same rule no matter which component asks for it, and uno
 * keeps only the first — so a badge answering to `accent` and a button
 * answering to `accent` means one of them silently ships nothing. Measured,
 * not assumed: that is exactly how badge's tones stopped rendering when they
 * were given bare names.
 *
 * So the utility is `tone-accent` — a palette word, claimed once, for anyone.
 * A component that wants a tone composes it rather than restating it, which is
 * a different thing from listing its own variants:
 *
 *   tone-accent           bg + a readable foreground, as utilities
 *   tone-accent-quiet     an edge in the tone rather than a fill
 *   tone-accent-plain     the tone as foreground only, for text
 *
 * A component's own class stays its own — `badge`, `badge-lg`, `outline` — and
 * a caller combines them: `<button class="tone-accent">`. The component says
 * what shape it is; the tone says what it is wearing.
 *
 * The three forms exist because a tone means different things on different
 * surfaces. A filled button wants the fill; a card wants an edge, because a
 * card is a surface and filling it red would be shouting; a heading wants the
 * colour as text. One palette, three readings, and the caller picks.
 *
 * Direction: tones are migrating component-ward. Badge has already moved —
 * its tones are `badge-tone-*`, claimed by the component rather than offered
 * as bare palette words. Alert still composes `tone-*-quiet` directly. The
 * global `tone-*` utilities stay until every component that uses them has
 * migrated; removing them now would break alert and the behaviour tests
 * that exercise them.
 */

/** The tone names the theme is expected to declare, in the order offered. */
export const TONES = [
  "neutral",
  "secondary",
  "accent",
  "success",
  "warning",
  "danger",
] as const;

export type Tone = (typeof TONES)[number];

/** Where a tone's fill lives, and what sits on it. */
function toneTokens(tone: Tone) {
  switch (tone) {
    case "neutral":
      // A neutral tone fills with the SAME surface the component's base
      // already carries, so restating it reads as "this badge is unstyled"
      // rather than "this badge is neutral". The distinguishable version is
      // an edge: same surface, a border the default does not have.
      return { fill: "surface-raised", on: "text", edge: "border" };
    case "secondary":
      return { fill: "secondary", on: "on-secondary", edge: "secondary" };
    case "accent":
      // No `edge`: `accent` is a fill, and a quiet tone built from a fill
      // fills with it — which is the opposite of quiet. The quiet form mixes
      // the tone into the surface instead, which is what makes it read as a
      // tint rather than a block.
      return { fill: "accent", on: "on-accent" };
    case "success":
      return { fill: "semantic-success", on: "on-semantic-success" };
    case "warning":
      return { fill: "semantic-warning", on: "on-semantic-warning" };
    case "danger":
      return { fill: "semantic-error", on: "on-danger" };
    default:
      // Unreachable for a Tone, but the return type has to admit it: a tone
      // added to the union without a case here should fail to typecheck
      // rather than produce an undefined fill at runtime.
      return { fill: "text", on: "surface" };
  }
}

/**
 * A token or a token pair, whichever the theme declares.
 *
 * `on-accent` and `on-secondary` do not exist in every theme, and a tone whose
 * foreground is missing should read as the theme's own text rather than as an
 * invalid declaration. So the pair is stated only where both halves resolve —
 * the same rule every component in the system follows.
 */
function fillRule(tone: Tone): Rule {
  const { fill, on } = toneTokens(tone);
  return [
    new RegExp(`^tone-${tone}$`),
    function* (_m, ctx) {
      const colors = themeOf(ctx)?.colors;
      const bg = colors?.[fill];
      const fg = colors?.[on];
      const { edge } = toneTokens(tone);
      yield {
        [ctx.symbols.selector]: () => `.tone-${tone}`,
        ...(bg !== undefined ? { "background-color": bg } : {}),
        ...(fg !== undefined ? { color: fg } : {}),
        // Only the neutral roles state a border. A chromatic tone is already
        // identified by its colour, and a border on it would fight the fill;
        // neutral has no colour of its own, so the edge IS the tone.
        ...(tone === "neutral" && edge !== undefined
          ? (colors?.[edge] !== undefined
            ? { "border-color": colors[edge] }
            : {})
          : {}),
      };
    },
  ];
}

/**
 * A tone as an edge rather than a fill.
 *
 * For a component that IS a surface — a card, a callout, a menu — where a
 * filled tone would replace the surface rather than mark it. States the border
 * in the tone and leaves the surface alone.
 */
function quietRule(tone: Tone): Rule {
  const { fill, edge } = toneTokens(tone);
  return [
    new RegExp(`^tone-${tone}-quiet$`),
    function* (_m, ctx) {
      const colors = themeOf(ctx)?.colors;
      // A tone with no edge token — a status colour, which is a fill and not a
      // surface — states only the border. Leaving the surface alone is the
      // point of the quiet form, so nothing is invented to fill it with.
      // The surface is the page's own, tinted with the tone. `color-mix` is
      // the right tool because both operands are theme tokens: the tint is
      // then correct in every theme without a second token saying "a very
      // pale version of accent".
      const surface = colors?.["surface-raised"] ?? colors?.["surface"];
      const toneColour = colors?.[fill];
      yield {
        [ctx.symbols.selector]: () => `.tone-${tone}-quiet`,
        ...(toneColour !== undefined ? { "border-color": toneColour } : {}),
        ...(surface !== undefined
          ? { "background-color": `color-mix(in oklab, ${surface} 92%, ${toneColour ?? "transparent"})` }
          : {}),
      };
    },
  ];
}

/**
 * A tone as foreground, for text.
 *
 * A heading in the accent colour, a link in the primary. No fill, so it
 * composes with whatever surface it lands on.
 */
function plainRule(tone: Tone): Rule {
  const { fill } = toneTokens(tone);
  return [
    new RegExp(`^tone-${tone}-plain$`),
    function* (_m, ctx) {
      const colors = themeOf(ctx)?.colors;
      const tone_ = colors?.[fill];
      yield {
        [ctx.symbols.selector]: () => `.tone-${tone}-plain`,
        ...(tone_ !== undefined ? { color: tone_ } : {}),
      };
    },
  ];
}

export function toneRules(): Rule[] {
  return TONES.flatMap((tone) => [fillRule(tone), quietRule(tone), plainRule(tone)]);
}

/** Every tone utility name, for autocomplete and the lint's vocabulary. */
export function toneNames(): string[] {
  return TONES.flatMap((t) => [`tone-${t}`, `tone-${t}-quiet`, `tone-${t}-plain`]);
}