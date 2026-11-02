import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { primitiveVariants } from "./manifest.ts";
import { PANEL_EXAMPLES } from "./panel.examples.ts";

/**
 * Examples are dogfood: every class in every panel example resolves against
 * the preset's own vocabulary (primitive variants + utility names). An
 * example demonstrating what the package cannot do fails here, not in a
 * user's browser.
 */
const STRUCTURAL: Record<string, true> = {
  "bare": true,
  "w-full": true,
  "px-2": true,
  "py-1": true,
  "text-left": true,
};

const isKnown = (cls: string, known: Set<string>): boolean =>
  known.has(cls) || STRUCTURAL[cls] === true;

describe("panel examples resolve", () => {
  for (const example of PANEL_EXAMPLES) {
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
          `panel example "${example.name}" uses unknown class "${cls}"`,
        );
      }
    });
  }
});
