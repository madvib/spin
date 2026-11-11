import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { primitiveVariants } from "./manifest.ts";
import { JOIN_EXAMPLES } from "./join.examples.ts";

/**
 * Examples are dogfood: every class in every join example resolves against
 * the preset's own vocabulary (primitive variants + utility names). An
 * example demonstrating what the package cannot do fails here, not in a
 * user's browser.
 *
 * Layout classes on example wrappers (`flex`, `gap-2`…) are utilities the
 * wind4 layer provides; they are allowlisted as structural, not styled.
 * Icon classes (`i-*`) come from the consumer's icon preset, not ours.
 */
const STRUCTURAL: Record<string, true> = {
  "flex": true,
  "flex-wrap": true,
  "flex-col": true,
  "items-center": true,
  "justify-center": true,
  "items-start": true,
  "gap-2": true,
};

const isKnown = (cls: string, known: Set<string>): boolean =>
  known.has(cls) || cls.startsWith("i-");

describe("join examples resolve", () => {
  for (const example of JOIN_EXAMPLES) {
    it(example.name, () => {
      const classes = [...example.html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => (m[1] as string).split(/\s+/).filter(Boolean));
      const known = new Set([
        ...primitiveVariants(),
        ...Object.keys(STRUCTURAL),
      ]);
      for (const cls of classes) {
        assert(
          isKnown(cls, known),
          `join example "${example.name}" uses unknown class "${cls}"`,
        );
      }
    });
  }
});
