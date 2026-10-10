import type { Rule } from "@unocss/core";
import { groupOf, themeOf } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

/**
 * Badge — a small status label.
 *
 * The smallest component there is. A rule rather than a shortcut, because a
 * shortcut emits a class selector and the surface is tags. The base and each
 * tone are separate tokens, so a page using none of them pays only for the
 * base.
 *
 * A badge's tones are its own variants — compound selectors on the badge,
 * `badge.badge-primary` — not shared utilities. The palette pair (fill + on)
 * comes from the theme; the muted form is a border in the tone and an 8%
 * tint of it on the surface.
 * composed: `variant="primary muted"` matches no muted rule).
 */
export function badgeRules(
  roots: readonly string[],
  mode: Mode,
): Rule[] {
  if (!roots.includes("badge")) return [];
  return [
    badgeBase(mode),
    ...badgeTones(mode),
    ...badgeSizes(mode),
    ...badgeClose(mode),
  ];
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
      const borderWidth = t?.borderWidth?.["width"];
      const borderColor = t?.colors?.["border"];
      const sizeXs = t?.fontSize["xs"];
      const weightMedium = t?.fontWeight["medium"];
      const badgeGroup = groupOf(ctx, "badge");
      const edge = badgeGroup?.["edge"] ?? borderWidth;
      // `badge.pill` is a boolean token: a theme declares it true for the
      // pill and false (or omits it) for the square tag. The flag IS the
      // decision — the rule asks one question instead of carrying a radius
      // scale a badge has no use for.
      const pill = badgeGroup?.["pill"] !== undefined;
      const pillRadius = t?.radius?.["full"];
      yield {
        [ctx.symbols.selector]: () => badge,
        display: "inline-flex",
        "align-items": "center",
        ...(spacing1 !== undefined ? { gap: spacing1 } : {}),
        ...(pill && pillRadius !== undefined
          ? { "border-radius": pillRadius }
          : {}),
        ...(sizeXs !== undefined ? { "font-size": sizeXs } : {}),
        ...(weightMedium !== undefined ? { "font-weight": weightMedium } : {}),
        // The base owns its line box too: inherited leading would size the
        // pill to its context — 12px inside a button, 18px in a row —
        // rather than to its own type. Unitless 1 keeps glyphs centered.
        "line-height": 1,
        ...(spacing2 !== undefined
          ? {
            "padding-inline-start": spacing2,
            "padding-inline-end": spacing2,
          }
          : {}),
        ...(spacing1 !== undefined
          ? { "padding-block-start": spacing1, "padding-block-end": spacing1 }
          : {}),
        // A border so neutral's edge renders: the base states width+style
        // from the border token, and the colour the theme's border role
        // carries. Tones override the colour; the width and style stay.
        ...(edge !== undefined && borderColor !== undefined
          ? { border: `${edge} solid ${borderColor}` }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "badge" },
  ];
}

/**
 * The tones a badge carries, as its own variants.
 *
 * Each tone is a compound selector on the badge — `badge.badge-primary` —
 * so the tone is the badge's own, not a shared utility. The palette pair
 * (fill + on) comes from the theme; the muted form is a border in the tone
 * and an 8% tint of it on the surface.
 */
const TONES: ReadonlyArray<{
  name: string;
  fill: string;
  on: string;
  edge?: string;
}> = [
  { name: "primary", fill: "primary", on: "on-primary" },
  { name: "secondary", fill: "secondary", on: "on-secondary" },
  { name: "neutral", fill: "surface-raised", on: "text", edge: "border" },
  { name: "accent", fill: "accent", on: "on-accent" },
  { name: "success", fill: "semantic-success", on: "on-semantic-success" },
  { name: "warning", fill: "semantic-warning", on: "on-semantic-warning" },
  { name: "danger", fill: "semantic-error", on: "on-danger" },
];

function badgeTones(mode: Mode): Rule[] {
  const badge = claim(mode, "badge");
  return TONES.flatMap((tone) => {
    const { name, fill, on, edge } = tone;
    return [
      // Fill form. Keyed `badge-*`: bare `tone-*` keys belong to the
      // shared utilities, and uno keeps only the first rule matching a
      // token — a bare key here would shadow (or lose to) the utility.
      [
        new RegExp(`^badge-${name}$`),
        function* (_m, ctx) {
          const colors = themeOf(ctx)?.colors;
          const bg = colors?.[fill];
          const fg = colors?.[on];
          const edgeColor = edge !== undefined ? colors?.[edge] : undefined;
          // Both syntaxes: `class="badge-primary"` and `variant="primary"`.
          // The variant extractor emits the compound token so the rule
          // fires; the attribute selector matches the element that carries
          // no class. Either authoring produces this declaration block.
          yield {
            [ctx.symbols.selector]: () =>
              `${badge}.badge-${name}, ${badge}[variant~="${name}"]`,
            ...(bg !== undefined ? { "background-color": bg } : {}),
            ...(fg !== undefined ? { color: fg } : {}),
            // Neutral's edge IS the tone — same surface, a border the
            // default does not have.
            ...(edge !== undefined && edgeColor !== undefined
              ? { "border-color": edgeColor }
              : {}),
          };
        },
        { layer: "primitives", autocomplete: `badge-${name}` },
      ],
      // Muted form
      [
        new RegExp(`^badge-${name}-muted$`),
        function* (_m, ctx) {
          const colors = themeOf(ctx)?.colors;
          const surface = colors?.["surface-raised"] ?? colors?.["surface"];
          // The tone's colour: the edge for neutral (its identity is the
          // border), the fill for the chromatic tones.
          const toneColour = edge !== undefined
            ? colors?.[edge]
            : colors?.[fill];
          yield {
            [ctx.symbols.selector]: () =>
              `${badge}.badge-${name}-muted, ${badge}[variant~="${name}-muted"]`,
            ...(toneColour !== undefined ? { "border-color": toneColour } : {}),
            ...(surface !== undefined
              ? {
                "background-color": `color-mix(in oklab, ${surface} 92%, ${
                  toneColour ?? "transparent"
                })`,
              }
              : {}),
          };
        },
        { layer: "primitives", autocomplete: `badge-${name}-muted` },
      ],
    ];
  });
}

/**
 * The badge's sizes, per button's pattern: each states a font-size step
 * and the padding steps that go with it, plus a min-height that accounts
 * for the border so the pill's height is its content plus its edge.
 */
function badgeSizes(mode: Mode): Rule[] {
  const badge = claim(mode, "badge");
  const SIZES: ReadonlyArray<{
    name: string;
    short: string;
    fontSize: string;
    spacingInline: string;
    spacingBlock: string;
  }> = [
    {
      name: "badge-sm",
      short: "sm",
      fontSize: "2xs",
      spacingInline: "1",
      spacingBlock: "0",
    },
    {
      name: "badge-lg",
      short: "lg",
      fontSize: "sm",
      spacingInline: "4",
      spacingBlock: "2",
    },
  ];
  return SIZES.map((size) => [
    new RegExp(`^${size.name}$`),
    function* (_m, ctx) {
      const t = themeOf(ctx);
      const fontSize = t?.fontSize[size.fontSize];
      const spacingInline = t?.spacing[size.spacingInline];
      const spacingBlock = t?.spacing[size.spacingBlock];
      yield {
        [ctx.symbols.selector]: () =>
          `${badge}.${size.name}, ${badge}[variant~="${size.short}"]`,
        ...(fontSize !== undefined ? { "font-size": fontSize } : {}),
        // Sizes own their line box: inherited body leading would swallow the
        // 2px text step between sm and the base, leaving pills the same
        // height with different type. Unitless 1 keeps glyphs centered.
        "line-height": 1,
        ...(spacingInline !== undefined
          ? {
            "padding-inline-start": spacingInline,
            "padding-inline-end": spacingInline,
          }
          : {}),
        ...(spacingBlock !== undefined
          ? {
            "padding-block-start": spacingBlock,
            "padding-block-end": spacingBlock,
          }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: size.name },
  ]) as Rule[];
}

/**
 * The badge's close control — a class on a CHILD of the badge, not a variant
 * on it. An unstyled button that inherits the badge's foreground: no tone
 * awareness needed, because the tone is already on the badge and this only
 * carries the glyph.
 */
function badgeClose(mode: Mode): Rule[] {
  const badge = claim(mode, "badge");
  return [
    [
      /^badge-close$/,
      function* (_m, ctx) {
        const radiusSm = themeOf(ctx)?.radius?.["sm"];
        yield {
          [ctx.symbols.selector]: () => `${badge} .badge-close`,
          "background-color": "transparent",
          border: 0,
          padding: 0,
          color: "inherit",
          // The button base sets font-size md; the closer matches the badge
          // text instead, or the glyph stretches the pill.
          "font-size": "inherit",
          // The × glyph's ink exceeds its em, so as a flex item its line box
          // stretches the pill. Sized as a 1em box with the glyph clipped
          // inside, it centers without contributing height.
          display: "inline-flex",
          "align-items": "center",
          "justify-content": "center",
          width: "1em",
          height: "1em",
          "line-height": 0,
          overflow: "hidden",
          // The button base's min-height (content + padding + border) would
          // keep the UA-sized box; the closer is exactly its glyph box.
          "min-height": 0,
          // Neobrut's button shadow would frame the × as its own object;
          // the closer is glyph furniture, not a control.
          "box-shadow": "none",
          cursor: "pointer",
        };
      },
      { layer: "primitives", autocomplete: "badge-close" },
    ],
  ];
}
