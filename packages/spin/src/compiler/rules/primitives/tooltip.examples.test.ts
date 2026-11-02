import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { primitiveVariants } from "./manifest.ts";
import { TOOLTIP_EXAMPLES } from "./tooltip.examples.ts";

/**
 * Examples are dogfood: every class in every tooltip example resolves
 * against the preset's own vocabulary (primitive variants + utility names).
 * An example demonstrating what the package cannot do fails here, not in a
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
  "items-start": true,
  "gap-2": true,
  "relative": true,
  "inline-flex": true,
  "bare": true,
  "peer": true,
  "start-0": true,
  "top-full": true,
  "whitespace-normal": true,
  "whitespace-nowrap": true,
  "peer-hover:visible": true,
  "peer-focus-visible:visible": true,
};

const isKnown = (cls: string, known: Set<string>): boolean =>
  known.has(cls) || cls.startsWith("i-");

describe("tooltip examples resolve", () => {
  for (const example of TOOLTIP_EXAMPLES) {
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
          `tooltip example "${example.name}" uses unknown class "${cls}"`,
        );
      }
    });
  }
});
