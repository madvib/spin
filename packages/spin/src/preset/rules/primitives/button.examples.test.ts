import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { primitiveVariants } from "./manifest.ts";
import { BUTTON_EXAMPLES } from "./button.examples.ts";

/**
 * Examples are dogfood: every class in every button example resolves against
 * the preset's own vocabulary (primitive variants + utility names). An
 * example demonstrating what the package cannot do fails here, not in a
 * user's browser.
 *
 * Layout classes on example wrappers (`flex`, `gap-2`…) are utilities the
 * wind4 layer provides; they are allowlisted as structural, not styled.
 * Icon classes (`i-*`) come from the consumer's icon preset, not ours.
 */
const STRUCTURAL = new Set([
  "flex",
  "flex-wrap",
  "items-center",
  "gap-2",
  // The ink a bare button asks for: `bare` opts out of the paint, so the
  // example spells the page's ink itself. A utility, not a variant.
  "text-text",
]);

const isKnown = (cls: string, known: Set<string>): boolean =>
  known.has(cls) || cls.startsWith("i-");

describe("button examples resolve", () => {
  for (const example of BUTTON_EXAMPLES) {
    it(example.name, () => {
      const classes = [...example.html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => (m[1] as string).split(/\s+/).filter(Boolean));
      const known = new Set([...primitiveVariants(), ...STRUCTURAL]);
      for (const cls of classes) {
        assert(
          isKnown(cls, known),
          `button example "${example.name}" uses unknown class "${cls}"`,
        );
      }
    });
  }
});
