import type { Theme } from "@spinjs/theme/theme-types";
import type { SpinRule, ThemeContext } from "../../utils/lookup.ts";
import { fallback } from "./shared.ts";

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
export function alertRules(roots: readonly string[]): SpinRule[] {
  if (!roots.includes("alert")) return [];
  return [alertBase(), ...alertTones()];
}

function alertTokens(ctx: ThemeContext | undefined) {
  // The alert reads the label style — the small-medium advisory type — and
  // an assertion reads the body-emphasized weight: an assertion is read before
  // a status. Styles are required: a field the theme does not state is
  // absent, and its declaration is dropped.
  const label = ctx?.theme?.alert?.type ?? ctx?.theme?.font?.style?.label;
  const strong = ctx?.theme?.font?.style?.["body-emphasized"];
  return {
    spacing2: fallback(ctx?.theme?.alert?.padding, ctx?.theme?.spacing?.[2]),
    spacing4: fallback(ctx?.theme?.alert?.["padding-inline"], ctx?.theme?.spacing?.[4]),
    radius: fallback(ctx?.theme?.alert?.radius, ctx?.theme?.radius?.md),
    text: ctx?.theme?.color?.text,
    raised: ctx?.theme?.color?.["surface-raised"],
    // The hairline the alert wears on every side. The tone variants
    // recolour the leading edge alone, so this is the quiet frame around
    // them — and it is the alert's own ink, falling back to the page's.
    border: fallback(ctx?.theme?.alert?.edge, ctx?.theme?.color?.border),
    borderWidth: ctx?.theme?.border?.width,
    fontSize: label?.["font-size"],
    weight: strong?.["font-weight"],
  };
}

/**
 * The alert itself, and the two roles it can carry.
 *
 * Both roles are yields of one generator because they are states of one
 * component, not tokens a document writes: uno keeps only the first rule
 * matching a token, so a separate rule keyed on a role would never be reached.
 */
function alertBase(): SpinRule {
  const alert = "alert";
  return [
    /^alert$/,
    function* (_m, ctx) {
      const t = alertTokens(ctx);

      yield {
        [ctx.symbols.selector]: () => alert,
        display: "block",
        // The alert is a block, so this says nothing on its own — but the
        // moment a consumer lays an alert out as a ROW (`class="flex
        // items-center gap-2"`, the horizontal form the examples show), the
        // row it becomes has to wrap. A row of alert content that cannot
        // wrap pushes its content out of the alert, and an alert that has
        // lost its content is not a message.
        "flex-wrap": "wrap",
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
        // decisions. The hairline's own ink is the alert's (`alert.edge`),
        // which falls back to the page's.
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

/**
 * A tone's fill from the fixed tone table — a typed read per tone name.
 * The table keys are flat dash-names (`semantic-success`), so each maps to
 * its nested path outright; a name the theme does not state reads undefined.
 */
function toneFill(
  palette: Theme["color"],
  name: string,
): string | undefined {
  switch (name) {
    case "accent":
      return palette?.accent;
    case "primary":
      return palette?.primary;
    case "secondary":
      return palette?.secondary;
    case "surface-raised":
      return palette?.["surface-raised"];
    case "border":
      return palette?.border;
    case "semantic-success":
      return palette?.semantic?.success;
    case "semantic-warning":
      return palette?.semantic?.warning;
    case "semantic-error":
      return palette?.semantic?.error;
    default:
      return undefined;
  }
}

function alertTones(): SpinRule[] {
  const alert = "alert";
  return ALERT_TONES.flatMap((tone) => {
    const { name, fill, edge } = tone;
    return [
      // Fill form. Dual selectors: class and variant attribute.
      [
        new RegExp(`^alert-${name}$`),
        function* (_m, ctx) {
          // Static: tone names are compile-time table keys, not class suffixes.
          const color = toneFill(ctx?.theme?.color, edge ?? fill);
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
          const surface = ctx?.theme?.color?.["surface-raised"] ??
            ctx?.theme?.color?.surface;
          // Static: tone names are compile-time table keys, not class suffixes.
          const toneColour = toneFill(ctx?.theme?.color, edge ?? fill);
          yield {
            [ctx.symbols.selector]: () =>
              `${alert}.alert-${name}-muted, ${alert}[variant~="${name}-muted"]`,
            ...(toneColour !== undefined
              ? { "border-inline-start-color": toneColour }
              : {}),
            ...(surface !== undefined
              ? {
                "background-color": `color-mix(in oklab, ${surface} 92%, ${
                  toneColour ?? "transparent"
                })`,
              }
              : {}),
          };
        },
        { layer: "primitives", autocomplete: `alert-${name}-muted` },
      ],
    ];
  }) as SpinRule[];
}
