import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseTokens } from "../../../theme/index.ts";
import { describeCatalog } from "../../index.ts";
import { primitiveVariants } from "./manifest.ts";
import { TABLE_EXAMPLES } from "./table.examples.ts";

/**
 * Examples are dogfood: every class in every table example resolves against
 * the preset's own vocabulary — the primitive variants and the utility names
 * the catalog publishes. An example demonstrating what the package cannot do
 * fails here, not in a user's browser.
 *
 * Layout classes on example wrappers (`flex`, `gap-2`…) are structural
 * wrappers, not styled utilities: they lay the example out rather than being
 * the thing it demonstrates. Icon classes (`i-*`) come from the consumer's
 * icon preset, not ours.
 */
const STRUCTURAL: Record<string, true> = {
  flex: true,
  "flex-wrap": true,
  "items-center": true,
  "gap-2": true,
};

const THEME = JSON.parse(
  await readFile(
    new URL("../../../theme/themes/silk.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;

const parsed = parseTokens(THEME);
if (!parsed.ok) throw new Error(parsed.error);
const UTILITIES = new Set(
  describeCatalog(parsed.tree).flatMap((section) => section.utilities),
);

const isKnown = (cls: string, known: Set<string>): boolean =>
  known.has(cls) || cls.startsWith("i-");

describe("table examples resolve", () => {
  for (const example of TABLE_EXAMPLES) {
    it(example.name, () => {
      const classes = [...example.html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => (m[1] as string).split(/\s+/).filter(Boolean));
      const known = new Set([
        ...primitiveVariants(),
        ...UTILITIES,
        ...Object.keys(STRUCTURAL),
      ]);
      for (const cls of classes) {
        assert(
          isKnown(cls, known),
          `table example "${example.name}" uses unknown class "${cls}"`,
        );
      }
    });
  }
});
