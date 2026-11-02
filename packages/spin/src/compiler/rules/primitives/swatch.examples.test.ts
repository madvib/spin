import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { primitiveVariants } from "./manifest.ts";
import { SWATCH_EXAMPLES } from "./swatch.examples.ts";

const STRUCTURAL: Record<string, true> = {
  flex: true,
  "flex-wrap": true,
  "items-center": true,
  "justify-center": true,
  "gap-2": true,
};

const isKnown = (cls: string, known: Set<string>): boolean =>
  known.has(cls) || cls.startsWith("i-");

describe("swatch examples resolve", () => {
  for (const example of SWATCH_EXAMPLES) {
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
          `swatch example "${example.name}" uses unknown class "${cls}"`,
        );
      }
    });
  }
});
