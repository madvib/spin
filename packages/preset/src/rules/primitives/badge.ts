import type { Theme } from "@spinjs/theme/theme-types";
import type { SpinRule } from "../../utils/lookup.ts";
import { fallback } from "./shared.ts";

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
): SpinRule[] {
  if (!roots.includes("badge")) return [];
  return [
    badgeBase(),
    ...badgeTones(),
    ...badgeSizes(),
    ...badgeClose(),
  ];
}

/** The shared shape every tone keeps: a small inline pill. */
function badgeBase(): SpinRule {
  const badge = "badge";
  return [
    /^badge$/,
    function* (_m, ctx) {
      const spacing2 = ctx?.theme?.spacing?.[2];
      const spacing1 = ctx?.theme?.spacing?.[1];
      const borderWidth = ctx?.theme?.border?.width;
      const borderColor = ctx?.theme?.color?.border;
      // The badge wears its own tuple — the word on a pill.
      const s = ctx?.theme?.badge?.type ?? ctx?.theme?.font?.style?.label;
      const sizeXs = s?.["font-size"];
      const weightMedium = s?.["font-weight"];
      const edge = fallback(ctx?.theme?.badge?.edge, ctx?.theme?.border?.width) ??
        borderWidth;
      // `badge.pill` is a boolean token. The rule context carries references,
      // not values — every deck builds one shared rule — so the decision
      // cannot be structural here; the fan reads the variable the theme's own
      // sheet declares: a deck that answers yes carries `--badge-pill: 1`, a
      // deck that answers no — or never decides — carries nothing, and the
      // branch computes to its own square. Presence asks once for the whole
      // system; the browser answers per deck.
      // Static: the `pill` flag is a fixed step name, not a class suffix.
      const pill = ctx?.theme?.badge?.pill !== undefined;
      const pillRadius = ctx?.theme?.radius?.full;
      yield {
        [ctx.symbols.selector]: () => badge,
        display: "inline-flex",
        "align-items": "center",
        ...(spacing1 !== undefined ? { gap: spacing1 } : {}),
        ...(pill && pillRadius !== undefined
          ? { "border-radius": `calc(var(--badge-pill, 0) * ${pillRadius})` }
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
  { name: "danger", fill: "semantic-error", on: "on-semantic-error" },
  { name: "info", fill: "semantic-info", on: "on-semantic-info" },
];

/**
 * A tone's fill from the fixed tone table — a typed read per tone name.
 * The table keys are flat dash-names (`on-semantic-error`), so each maps to
 * its nested path outright; a name the theme does not state reads undefined.
 */
function toneColor(
  palette: Theme["color"],
  name: string,
): string | undefined {
  switch (name) {
    case "primary":
      return palette?.primary;
    case "secondary":
      return palette?.secondary;
    case "surface-raised":
      return palette?.["surface-raised"];
    case "border":
      return palette?.border;
    case "accent":
      return palette?.accent;
    case "semantic-success":
      return palette?.semantic?.success;
    case "semantic-warning":
      return palette?.semantic?.warning;
    case "semantic-error":
      return palette?.semantic?.error;
    case "semantic-info":
      return palette?.semantic?.info;
    default:
      return undefined;
  }
}

/** A tone's ink from the fixed tone table — the fill's pairing, typed. */
function toneInk(
  palette: Theme["color"],
  name: string,
): string | undefined {
  switch (name) {
    case "on-primary":
      return palette?.["on-primary"];
    case "on-secondary":
      return palette?.["on-secondary"];
    case "text":
      return palette?.text;
    case "on-accent":
      return palette?.["on-accent"];
    case "on-semantic-success":
      return palette?.["on-semantic-success"];
    case "on-semantic-warning":
      return palette?.["on-semantic-warning"];
    case "on-semantic-error":
      return palette?.["on-semantic-error"];
    case "on-semantic-info":
      return palette?.["on-semantic-info"];
    default:
      return undefined;
  }
}

function badgeTones(): SpinRule[] {
  const badge = "badge";
  return TONES.flatMap((tone) => {
    const { name, fill, on, edge } = tone;
    return [
      // Fill form. Keyed `badge-*`: bare `tone-*` keys belong to the
      // shared utilities, and uno keeps only the first rule matching a
      // token — a bare key here would shadow (or lose to) the utility.
      [
        new RegExp(`^badge-${name}$`),
        function* (_m, ctx) {
          // Static: tone names are compile-time table keys, not class suffixes.
          const bg = toneColor(ctx?.theme?.color, fill);
          const fg = toneInk(ctx?.theme?.color, on);
          const edgeColor = edge !== undefined
            ? toneColor(ctx?.theme?.color, edge)
            : undefined;
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
          const surface = ctx?.theme?.color?.["surface-raised"] ??
            ctx?.theme?.color?.surface;
          // The tone's colour: the edge for neutral (its identity is the
          // border), the fill for the chromatic tones.
          // Static: tone names are compile-time table keys, not class suffixes.
          const toneColour = edge !== undefined
            ? toneColor(ctx?.theme?.color, edge)
            : toneColor(ctx?.theme?.color, fill);
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
function badgeSizes(): SpinRule[] {
  const badge = "badge";
  const SIZES: ReadonlyArray<{
    name: string;
    short: string;
    fontSize: string;
    spacingInline: "1" | "4";
    spacingBlock: "0" | "2";
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
      // The badge's sizes are the badge style at its steps: sm keeps the
      // badge style's own 2xs, lg takes the label step — read through the
      // styles' sizes, so moving the styles moves the sizes with them.
      const style = ctx?.theme?.badge?.type ?? ctx?.theme?.font?.style?.label;
      const label = ctx?.theme?.font?.style?.label;
      const fontSize = size.fontSize === "2xs" ? style?.["font-size"] : label?.["font-size"];
      // Static: the size table states fixed spacing steps, not class suffixes.
      const spacingInline = ctx?.theme?.spacing?.[size.spacingInline];
      const spacingBlock = ctx?.theme?.spacing?.[size.spacingBlock];
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
  ]) as SpinRule[];
}

/**
 * The badge's close control — a class on a CHILD of the badge, not a variant
 * on it. An unstyled button that inherits the badge's foreground: no tone
 * awareness needed, because the tone is already on the badge and this only
 * carries the glyph.
 */
function badgeClose(): SpinRule[] {
  const badge = "badge";
  return [
    [
      /^badge-close$/,
      function* (_m, ctx) {
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
