import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { variantExtractor } from "../../extractors.ts";
import { primitiveVariants } from "./manifest.ts";
import { ALERT_EXAMPLES } from "./alert.examples.ts";

/**
 * Examples are dogfood: every class in every alert example resolves against
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
  "items-center": true,
  "gap-2": true,
};

const isKnown = (cls: string, known: Set<string>): boolean =>
  known.has(cls) || cls.startsWith("i-");

describe("alert examples resolve", () => {
  for (const example of ALERT_EXAMPLES) {
    it(example.name, () => {
      const known = new Set([
        ...primitiveVariants(),
        ...Object.keys(STRUCTURAL),
      ]);
      const classes = [...example.html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => (m[1] as string).split(/\s+/).filter(Boolean));
      for (const cls of classes) {
        assert(
          isKnown(cls, known),
          `alert example "${example.name}" uses unknown class "${cls}"`,
        );
      }

      // An alert's tones are variant attributes, not classes, so the class
      // check above cannot see them. The variant extractor turns
      // `variant="accent"` into the compound token `alert-accent` — the exact
      // token the tone rule keys on — so proving the API means proving every
      // emitted compound resolves against the component's own vocabulary.
      const emitted = variantExtractor.extract!({
        code: example.html,
        original: example.html,
        extracted: new Set<string>(),
      });
      const tokens = emitted instanceof Set
        ? [...emitted]
        : Array.isArray(emitted)
        ? emitted
        : [];
      for (const token of tokens) {
        if (!token.startsWith("alert-")) continue;
        assert(
          known.has(token),
          `alert example "${example.name}" uses unknown variant "${token}"`,
        );
      }
    });
  }
});
