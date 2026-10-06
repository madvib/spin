import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

/**
 * Alert — `<alert role="status">` and `<alert role="alert">`.
 *
 * A message about something, not a fill. A filled red box shouts, and an
 * alert that shouts is one a reader learns to skip past; the opinion here is
 * a quiet surface carrying a strong edge in the tone. The tone marks the
 * alert, the surface stays the surface.
 *
 * The tone is the palette's rather than the component's. Each variant reads
 * the same colour `tone-{name}-quiet` states on its border, so a theme that
 * re-tints `semantic-error` re-tints every danger alert, and a component that
 * needs no fill/foreground pairing does not mint one. `tone-{name}-quiet` also
 * fits as a class a caller writes directly: `<alert class="tone-danger-quiet">`
 * states the same edge, and the variant is that reading with the component's
 * name on it.
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
    spacing2: t?.spacing["2"],
    spacing4: t?.spacing["4"],
    radius: t?.radius?.["md"],
    text: t?.colors["text"],
    raised: t?.colors["surface-raised"],
    border: t?.colors["border"],
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
        // The quiet surface: a hairline on every side. The tone variants
        // recolour only the inline-start edge, and the role states how heavy
        // that edge is — so the colour and the weight are separate decisions.
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
 * Each states only the inline-start edge. A tone that filled the surface would
 * be the shouting box this component exists to avoid, and a tone that coloured
 * the other three hairlines would read as an outline rather than as a mark.
 */
function alertTones(mode: Mode): Rule[] {
  const alert = claim(mode, "alert");
  const TONES: ReadonlyArray<readonly [token: string, fill: string]> = [
    ["alert-accent", "accent"],
    ["alert-success", "semantic-success"],
    ["alert-warning", "semantic-warning"],
    ["alert-danger", "semantic-error"],
  ];
  return TONES.map(([token, fill]) => [
    new RegExp(`^${token}$`),
    function* (_m, ctx) {
      const color = themeOf(ctx)?.colors[fill];
      yield {
        [ctx.symbols.selector]: () => `${alert}.${token}`,
        ...(color !== undefined ? { "border-inline-start-color": color } : {}),
      };
    },
    { layer: "primitives", autocomplete: token },
  ]) as Rule[];
}
