/**
 * An ink the palette does not pair with the fill underneath it.
 *
 * A fill constrains the ink of its OWN state: `hover:bg-accent` is the
 * hover state's pairing, and a chip that brightens its resting ink is not
 * painting that ink on the fill that arrives under a pointer. Inks are
 * collected per state for the same reason.
 *
 * A fill with NO ink is the same defect as a fill with the wrong one: the
 * palette pairs `bg-primary` with `text-on-primary`, and a filled element
 * wearing no ink inherits whatever the page says — legible in one theme,
 * dark-on-dark in the next. Three shapes of silence are deliberate rather
 * than missing: `bg-transparent` in the same state says the fill is not
 * there (an overlay that opts out of the paint), `currentColor` inks are
 * the author's own word (a glyph that takes the ink it sits beside), and a
 * surface is the page rather than a fill (body ink sits on it by
 * definition, which is where every floor is measured).
 */

import type { ClassFacts, Facts, Finding, LiteralFacts } from "./core.ts";

export function checkNoUnpairedInk(
  facts: Facts,
  node: ClassFacts,
): Finding[] {
  if (!facts.readable) return [];
  // A third-party override paints fills the palette never paired: the
  // palette has no answer for them, so absence here is the escape's
  // business, not a missing ink.
  if (node.escaped === true) return [];
  const fills = new Map<string, string[]>();
  const inks = new Map<string, string[]>();
  for (const cls of node.classes) {
    const cut = cls.lastIndexOf(":");
    const state = cut === -1 ? "" : cls.slice(0, cut);
    const core = cut === -1 ? cls : cls.slice(cut + 1);
    if (core.startsWith("bg-")) {
      const fill = core.slice(3).split("/")[0] as string;
      // An explicitly unpainted box opts out state by state: `bg-transparent`
      // in the same state as a fill says the fill is not there, so the
      // resting opt-out does not excuse a missing hover ink and a hover
      // opt-out does not excuse a missing resting one.
      if (fill === "transparent") {
        fills.delete(state);
        continue;
      }
      // `currentColor` fills take whatever ink they sit beside, and a surface
      // is the page rather than a fill: body ink sits on it by definition,
      // which is where every floor is measured.
      if (fill === "current" || fill === "currentColor") continue;
      if (facts.colors.has(fill) && !fill.startsWith("surface")) {
        fills.set(state, [...(fills.get(state) ?? []), fill]);
      }
    } else if (core.startsWith("text-")) {
      const raw = core.slice(5).split("/")[0] as string;
      const tokenName = facts.colors.has(raw) ? raw : facts.colors.has("text-" + raw) ? "text-" + raw : undefined;
      if (tokenName !== undefined) {
        inks.set(state, [...(inks.get(state) ?? []), raw]);
      }
    }
  }
  const out: Finding[] = [];
  for (const [state, painted] of fills) {
    const stated = inks.get(state);
    if (stated === undefined || stated.length === 0) {
      // One fill, no ink: a legibility defect with a named remedy. Two fills
      // in one state is a machine-state merge the rule cannot scope — either
      // fill could be the one on screen — so the rule says nothing rather
      // than name the wrong pairing.
      if (painted.length !== 1) continue;
      const fill = painted[0] as string;
      const expected = `on-${fill}`;
      if (!facts.inks.has(expected)) {
        out.push({
          messageId: "undeclared",
          data: { ink: "none", fill },
          position: node.position,
          remedy: "Paint a paired fill, or declare the pairing in the theme.",
        });
      } else {
        out.push({
          messageId: "absence",
          data: { fill, expected: `text-${expected}` },
          position: node.position,
          remedy: `Pair \`bg-${fill}\` with \`text-${expected}\`.`,
        });
      }
      continue;
    }
    // Two fills in one state is a machine-state merge the rule cannot scope:
    // an ink on screen could pair with either fill, so naming one pairing
    // risks the wrong remedy. The rule stands down rather than guess.
    if (painted.length !== 1) continue;
    for (const ink of stated) {
      for (const fill of painted) {
        const expected = `on-${fill}`;
        if (!facts.inks.has(expected)) {
          out.push({
            messageId: "undeclared",
            data: { ink: `text-${ink}`, fill },
            position: node.position,
            remedy: "Paint a paired fill, or declare the pairing in the theme.",
          });
        } else if (ink !== expected) {
          out.push({
            messageId: "mismatch",
            data: { ink: `text-${ink}`, fill, expected: `text-${expected}` },
            position: node.position,
            remedy: `Use \`text-${expected}\` on that fill.`,
          });
        }
      }
    }
  }
  return out;
}
/**
 * A token referenced by hand.
 *
 * A custom property is generated output, never an interface. When a
 * component spends a token it reads the theme the generator already
 * injected, so a renamed token cannot leave it pointing at nothing and a
 * literal string cannot sit in the source where nothing checks it.
 */
export function checkNoHandwrittenTokens(
  facts: Facts,
  node: LiteralFacts,
): Finding[] {
  if (!facts.readable) return [];
  const out: Finding[] = [];
  for (const match of node.text.matchAll(/var\(\s*--([a-z0-9-]+)\s*\)/g)) {
    const token = match[1] as string;
    out.push({
      messageId: "handwritten",
      data: {
        token,
        group: token.split("-")[0] ?? "",
        step: token,
        // The token's path in the theme, which is what a reader asks for:
        // the variable is the generator's spelling of it, and the path is
        // the token's own name.
        path: facts.paths.get(`--${token}`) ?? token,
      },
      position: node.position,
      remedy: "Read the theme's token `" +
        (facts.paths.get(`--${token}`) ?? token) + "`.",
    });
  }
  return out;
}
