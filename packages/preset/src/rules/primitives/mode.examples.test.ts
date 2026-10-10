import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { primitiveVariants } from "./manifest.ts";
import { MODE_EXAMPLES } from "./mode.examples.ts";

/**
 * Examples are dogfood: every class in every mode example resolves against
 * the preset's own vocabulary (primitive variants + utility names). An
 * example demonstrating what the package cannot do fails here, not in a
 * user's browser.
 *
 * The mode examples use no wrapper and no layout classes: one button per
 * row, an icon class the consumer's icon preset provides (`i-*`).
 */
const STRUCTURAL: Record<string, true> = {};

const isKnown = (cls: string, known: Set<string>): boolean =>
  known.has(cls) || cls.startsWith("i-");

describe("mode examples resolve", () => {
  for (const example of MODE_EXAMPLES) {
    it(example.name, () => {
      const classes = [...example.html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => (m[1] as string).split(/\s+/).filter(Boolean));
      const known = new Set([...primitiveVariants(), ...Object.keys(STRUCTURAL)]);
      for (const cls of classes) {
        assert(
          isKnown(cls, known),
          `mode example "${example.name}" uses unknown class "${cls}"`,
        );
      }
    });
  }
});
