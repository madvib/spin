import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

/**
 * Alert — `<alert role="status">` and `<alert role="alert">`.
 *
 * A message about something, not a fill. A filled red box shouts, and an
 * alert that shouts is one a reader learns to skip past; the opinion here is
 * a muted surface carrying a strong edge in the tone. The tone marks the
 * alert, the surface stays the surface.
 *
 * The tone is the palette's, read through the component's own tokens. Each
 * variant reads the colour the theme states for its role — `semantic-error`
 * for danger, `accent` for accent — so a theme that re-tints the palette
 * re-tints every alert of that tone, and a component that needs no
 * fill/foreground pairing does not mint one. The tone is the component's own
 * variant: `variant="danger"`, or the class `alert-danger` for a caller
 * writing it directly. The muted form (`alert-danger-muted`) tints the surface
 * with the same colour.
 *
 * `role="alert"` is stated heavier than `role="status"` because the two roles
 * mean different things to the reader: an assertion interrupts, a status
 * waits its turn. The difference is the weight of the edge and nothing else —
 * same surface, same tone, same type.
 *
 * The close affordance is deliberately absent. Dismissing an alert is
 * behaviour, not decoration: a rule can draw an × but cannot remove the
 * message, and an × that does nothing is worse than none.
 */
export function alertRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("alert")) return [];
  return [alertBase(mode), ...alertTones(mode)];
}

function alertTokens(ctx: Parameters<typeof themeOf>[0]) {
  const t = themeOf(ctx);
  return {
    spacing2: t?.spacing?.["2"],
    spacing4: t?.spacing?.["4"],
    radius: t?.radius?.["md"],
    text: t?.colors?.["text"],
    raised: t?.colors?.["surface-raised"],
    border: t?.colors?.["border"],
    borderWidth: t?.borderWidth?.["width"],
    fontSize: t?.fontSize?.["sm"],
    weight: t?.fontWeight?.["medium"],
  };
}

/**
 * The alert itself, and the two roles it can carry.
 *
 * Both roles are yields of one generator because they are states of one
 * component, not tokens a document writes: uno keeps only the first rule
 * matching a token, so a separate rule keyed on a role would never be reached.
 */
function alertBase(mode: Mode): Rule {
  const alert = claim(mode, "alert");
  return [
    /^alert$/,
    function* (_m, ctx) {
      const t = alertTokens(ctx);

      yield {
        [ctx.symbols.selector]: () => alert,
        display: "block",
        ...(t.spacing2 !== undefined
          ? {
            "padding-block-start": t.spacing2,
            "padding-block-end": t.spacing2,
          }
          : {}),
        ...(t.spacing4 !== undefined
          ? {
            "padding-inline-start": t.spacing4,
            "padding-inline-end": t.spacing4,
          }
          : {}),
        ...(t.radius !== undefined ? { "border-radius": t.radius } : {}),
        ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
        ...(t.text !== undefined ? { color: t.text } : {}),
        ...(t.fontSize !== undefined ? { "font-size": t.fontSize } : {}),
        // The surface stays the surface: a hairline on every side. The tone
        // variants recolour only the inline-start edge, and the role states
        // how heavy that edge is — so the colour and the weight are separate
        // decisions.
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { border: `${t.borderWidth} solid ${t.border}` }
          : {}),
      };

      // A status reports without interrupting, so its edge is stated.
      yield {
        [ctx.symbols.selector]: () => `${alert}[role="status"]`,
        ...(t.borderWidth !== undefined
          ? { "border-inline-start-width": `calc(${t.borderWidth} * 3)` }
          : {}),
      };

      // An alert asserts, so the same edge is heavier. The type carries a
      // little more weight too: an assertion is read before a status.
      yield {
        [ctx.symbols.selector]: () => `${alert}[role="alert"]`,
        ...(t.borderWidth !== undefined
          ? { "border-inline-start-width": `calc(${t.borderWidth} * 5)` }
          : {}),
        ...(t.weight !== undefined ? { "font-weight": t.weight } : {}),
      };
    },
    { layer: "primitives", autocomplete: "alert" },
  ];
}

/**
 * The tones an alert can wear, as its own tokens.
 *
 * `alert-accent` rather than a bare `accent` for the same reason badge prefixes
 * its tones: a bare tone name is a palette entry, uno keeps only the first rule
 * matching a token, and two components answering to `accent` means one of them
 * silently ships nothing.
 *
 * Each tone has a fill form and a muted form. The fill form states only the
 * inline-start edge — a tone that filled the surface would be the shouting box
 * this component exists to avoid. The muted form adds an 8% tint of the tone
 * on the surface, copying badge's colorimetry. Both forms use dual selectors
 * (`.alert-{name}` + `[variant~="{name}"]`) so the tone works as a class or
 * as a variant attribute.
 */
const ALERT_TONES: ReadonlyArray<{
  name: string;
  fill: string;
  edge?: string;
}> = [
  { name: "accent", fill: "accent" },
  { name: "success", fill: "semantic-success" },
  { name: "warning", fill: "semantic-warning" },
  { name: "danger", fill: "semantic-error" },
  { name: "primary", fill: "primary" },
  { name: "secondary", fill: "secondary" },
  { name: "neutral", fill: "surface-raised", edge: "border" },
];

function alertTones(mode: Mode): Rule[] {
  const alert = claim(mode, "alert");
  return ALERT_TONES.flatMap((tone) => {
    const { name, fill, edge } = tone;
    return [
      // Fill form. Dual selectors: class and variant attribute.
      [
        new RegExp(`^alert-${name}$`),
        function* (_m, ctx) {
          const colors = themeOf(ctx)?.colors;
          const color = edge !== undefined ? colors?.[edge] : colors?.[fill];
          yield {
            [ctx.symbols.selector]: () =>
              `${alert}.alert-${name}, ${alert}[variant~="${name}"]`,
            ...(color !== undefined
              ? { "border-inline-start-color": color }
              : {}),
          };
        },
        { layer: "primitives", autocomplete: `alert-${name}` },
      ],
      // Muted form
      [
        new RegExp(`^alert-${name}-muted$`),
        function* (_m, ctx) {
          const colors = themeOf(ctx)?.colors;
          const surface = colors?.["surface-raised"] ?? colors?.["surface"];
          const toneColour = edge !== undefined
            ? colors?.[edge]
            : colors?.[fill];
          yield {
            [ctx.symbols.selector]: () =>
              `${alert}.alert-${name}-muted, ${alert}[variant~="${name}-muted"]`,
            ...(toneColour !== undefined
              ? { "border-inline-start-color": toneColour }
              : {}),
            ...(surface !== undefined
              ? {
                "background-color":
                  `color-mix(in oklab, ${surface} 92%, ${toneColour ?? "transparent"})`,
              }
              : {}),
          };
        },
        { layer: "primitives", autocomplete: `alert-${name}-muted` },
      ],
    ];
  }) as Rule[];
}
