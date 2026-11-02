import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { primitiveVariants } from "./manifest.ts";
import { FIELD_EXAMPLES, INPUT_EXAMPLES, TEXTAREA_EXAMPLES } from "./field.examples.ts";

const STRUCTURAL: Record<string, true> = {
  "flex": true,
  "flex-wrap": true,
  "items-center": true,
  "gap-2": true,
};

const isKnown = (cls: string, known: Set<string>): boolean =>
  known.has(cls) || cls.startsWith("i-");

for (const [label, examples] of [
  ["field", FIELD_EXAMPLES],
  ["input", INPUT_EXAMPLES],
  ["textarea", TEXTAREA_EXAMPLES],
] as const) {
  describe(`${label} examples resolve`, () => {
    for (const example of examples) {
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
            `${label} example "${example.name}" uses unknown class "${cls}"`,
          );
        }
      });
    }
  });
}