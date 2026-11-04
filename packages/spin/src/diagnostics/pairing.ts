/**
 * An ink the palette does not pair with the fill underneath it.
 *
 * A fill constrains the ink of its OWN state: `hover:bg-accent` is the
 * hover state's pairing, and a chip that brightens its resting ink is not
 * painting that ink on the fill that arrives under a pointer. Inks are
 * collected per state for the same reason.
 */

import type { ClassFacts, Facts, Finding, LiteralFacts } from "./core.ts";

export function checkNoUnpairedInk(
  facts: Facts,
  node: ClassFacts,
): Finding[] {
  if (!facts.readable) return [];
  const fills = new Map<string, string[]>();
  const inks = new Map<string, string[]>();
  for (const cls of node.classes) {
    const cut = cls.lastIndexOf(":");
    const state = cut === -1 ? "" : cls.slice(0, cut);
    const core = cut === -1 ? cls : cls.slice(cut + 1);
    if (core.startsWith("bg-")) {
      const fill = core.slice(3);
      // A surface is the page rather than a fill: body ink sits on it by
      // definition, which is where every floor is measured.
      if (facts.colors.has(fill) && !fill.startsWith("surface")) {
        fills.set(state, [...(fills.get(state) ?? []), fill]);
      }
    } else if (core.startsWith("text-")) {
      const ink = core.slice(5);
      if (facts.colors.has(ink)) {
        inks.set(state, [...(inks.get(state) ?? []), ink]);
      }
    }
  }
  const out: Finding[] = [];
  for (const [state, stated] of inks) {
    const painted = fills.get(state);
    if (painted === undefined) continue;
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
            remedy: `Use \`${expected}\` on that fill`,
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
