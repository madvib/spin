import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

/**
 * Badge — a small status label.
 *
 * The smallest component there is. A rule rather than a shortcut, because a
 * shortcut emits a class selector and the surface is tags. The base and each
 * tone are separate tokens, so a page using none of them pays only for the
 * base.
 *
 * Badge does not group its tones with anything. A badge and a button do not
 * share a role — a button is pressable and a badge is not, and the tokens they
 * spend differ because of that. What they share is a *palette*, and a palette
 * is not a component concern: it belongs to the theme and is offered as a
 * utility a component may spend, not as variants each component reinvents.
 * See `tones.ts`.
 */
export function badgeRules(
  roots: readonly string[],
  mode: Mode,
): Rule[] {
  if (!roots.includes("badge")) return [];
  return [badgeBase(mode), ...badgeTones(mode)];
}

/** The shared shape every tone keeps: a small inline pill. */
function badgeBase(mode: Mode): Rule {
  const badge = claim(mode, "badge");
  return [
    /^badge$/,
    function* (_m, ctx) {
      const t = themeOf(ctx);
      const spacing2 = t?.spacing["2"];
      const spacing1 = t?.spacing["1"];
      const radiusFull = t?.radius["full"];
      const sizeXs = t?.fontSize["xs"];
      const weightMedium = t?.fontWeight["medium"];
      yield {
        [ctx.symbols.selector]: () => badge,
        display: "inline-flex",
        "align-items": "center",
        // A pill is centred on its glyphs, not on a line box. Inherited
        // line-height adds leading above the text, and a flex item centres
        // that leading too — so the label reads a pixel high in a 26px pill
        // even though the box and the line box agree.
        "line-height": "1",
        ...(spacing1 !== undefined ? { gap: spacing1 } : {}),
        ...(radiusFull !== undefined ? { "border-radius": radiusFull } : {}),
        ...(sizeXs !== undefined ? { "font-size": sizeXs } : {}),
        ...(weightMedium !== undefined ? { "font-weight": weightMedium } : {}),
        ...(spacing2 !== undefined
          ? {
            "padding-inline-start": spacing2,
            "padding-inline-end": spacing2,
          }
          : {}),
        // Block padding is a smaller step than the inline. A pill's height is
        // its line box plus this, and matching the inline step would make it
        // taller than it is wide.
        ...(spacing1 !== undefined
          ? { "padding-block-start": spacing1, "padding-block-end": spacing1 }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "badge" },
  ];
}

/**
 * The tones a badge carries, as its own tokens.
 *
 * `badge-accent` rather than a bare `accent`, because a bare tone name is a
 * palette entry — the same word every component would claim, and uno keeps only
 * the first rule matching a token, so a badge and a button both answering to
 * `accent` means one of them silently ships nothing. Prefixing by component is
 * what keeps each component's tones its own while the palette stays shared.
 *
 * A badge can only be filled. An outlined pill is not a quieter badge, it is a
 * different object, so there is no outline tone here.
 */
function badgeTones(mode: Mode): Rule[] {
  const badge = claim(mode, "badge");
  const TONES: ReadonlyArray<
    readonly [token: string, background: string, foreground: string]
  > = [
    ["badge-accent", "accent", "on-accent"],
    ["badge-success", "semantic-success", "on-semantic-success"],
    ["badge-warning", "semantic-warning", "on-semantic-warning"],
    ["badge-danger", "semantic-error", "on-danger"],
  ];
  return TONES.map(([token, background, foreground]) => [
    new RegExp(`^${token}$`),
    function* (_m, ctx) {
      const colors = themeOf(ctx)?.colors;
      yield {
        [ctx.symbols.selector]: () => `${badge}.${token}`,
        ...(colors?.[background] !== undefined
          ? { "background-color": colors[background] }
          : {}),
        ...(colors?.[foreground] !== undefined
          ? { color: colors[foreground] }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: token },
  ]) as Rule[];
}