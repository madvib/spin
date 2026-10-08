import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseTokens } from "@spin/theme";
import { describeCatalog } from "../../index.ts";
import { primitiveVariants } from "./manifest.ts";
import { FIELDSET_EXAMPLES } from "./fieldset.examples.ts";

/**
 * Examples are dogfood: every class in every fieldset example resolves
 * against the preset's own vocabulary — the primitive variants and the
 * utility names the catalog publishes. An example demonstrating what the
 * package cannot do fails here, not in a user's browser.
 *
 * Layout classes on the demo wrapper (`flex`, `gap-2`…) are structural
 * wrappers, not styled utilities: they lay the group out rather than being
 * the thing it demonstrates, so they are allowlisted as structural.
 */
const STRUCTURAL = new Set([
  "flex",
  "flex-wrap",
  "flex-col",
  "items-center",
  "gap-2",
]);

const THEME = JSON.parse(
  await Deno.readTextFile(
    new URL("../../../../theme/src/themes/default.json", import.meta.url),
  ),
) as Record<string, unknown>;

const parsed = parseTokens(THEME);
if (!parsed.ok) throw new Error(parsed.error);
const UTILITIES = new Set(
  describeCatalog(parsed.tree).flatMap((section) => section.utilities),
);

const isKnown = (cls: string, known: Set<string>): boolean =>
  known.has(cls) || cls.startsWith("i-");

describe("fieldset examples resolve", () => {
  for (const example of FIELDSET_EXAMPLES) {
    it(example.name, () => {
      const classes = [...example.html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => (m[1] as string).split(/\s+/).filter(Boolean));
      const known = new Set([
        ...primitiveVariants(),
        ...UTILITIES,
        ...STRUCTURAL,
      ]);
      for (const cls of classes) {
        assert(
          isKnown(cls, known),
          `fieldset example "${example.name}" uses unknown class "${cls}"`,
        );
      }
    });
  }
});
