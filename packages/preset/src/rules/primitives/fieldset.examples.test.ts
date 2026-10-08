import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { primitiveVariants } from "./manifest.ts";
import { FIELDSET_EXAMPLES } from "./fieldset.examples.ts";

/**
 * Examples are dogfood: every class in every fieldset example resolves
 * against the preset's own vocabulary (primitive variants + utility names).
 * An example demonstrating what the package cannot do fails here, not in a
 * user's browser.
 *
 * Fieldset examples use bare tags only — no classes at all — so this test
 * asserts the examples stay classless.
 */
const STRUCTURAL = new Set([
  "flex",
  "flex-wrap",
  "items-center",
  "gap-2",
]);

const isKnown = (cls: string, known: Set<string>): boolean =>
  known.has(cls) || cls.startsWith("i-");

describe("fieldset examples resolve", () => {
  for (const example of FIELDSET_EXAMPLES) {
    it(example.name, () => {
      const classes = [...example.html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => (m[1] as string).split(/\s+/).filter(Boolean));
      const known = new Set([...primitiveVariants(), ...STRUCTURAL]);
      for (const cls of classes) {
        assert(
          isKnown(cls, known),
          `fieldset example "${example.name}" uses unknown class "${cls}"`,
        );
      }
    });
  }
});
