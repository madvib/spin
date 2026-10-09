import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { primitiveVariants } from "./manifest.ts";
import { CARD_EXAMPLES } from "./card.examples.ts";

/**
 * Examples are dogfood: every class in every card example resolves against
 * the preset's own vocabulary (primitive variants + utility names). An
 * example demonstrating what the package cannot do fails here, not in a
 * user's browser.
 *
 * Layout classes on example wrappers (`flex`, `gap-2`…) are utilities the
 * wind4 layer provides; they are allowlisted as structural, not styled.
 */
const STRUCTURAL: Record<string, true> = {
  flex: true,
  "flex-wrap": true,
  "items-center": true,
  "gap-2": true,
  "gap-8": true,
  block: true,
  "w-full": true,
};

const isKnown = (cls: string, known: Set<string>): boolean =>
  known.has(cls) || STRUCTURAL[cls] === true;

describe("card examples resolve", () => {
  for (const example of CARD_EXAMPLES) {
    it(example.name, () => {
      const classes = [...example.html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => (m[1] as string).split(/\s+/).filter(Boolean));
      const known = new Set([...primitiveVariants(), ...Object.keys(STRUCTURAL)]);
      for (const cls of classes) {
        assert(
          isKnown(cls, known),
          `card example "${example.name}" uses unknown class "${cls}"`,
        );
      }
    });
  }
});
