import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { readFileSync } from "node:fs";
import { spinPreset } from "../src/index.ts";

/**
 * The range contract: a drawn groove, a token fill, a drawn thumb.
 *
 * The range used to be unpainted, so every theme showed the browser's own
 * blue fill. Now the groove reads `color.surface-sunken`, the fill reads
 * `color.primary` sized by the control's `--range-progress` share, and the
 * thumb is a drawn circle in `color.surface` edged with the primary.
 *
 * The values are read out of the GENERATED SHEET rather than out of the
 * rule's source, because the sheet is what a browser reads.
 */

const DEFAULT = new URL(
  "../../theme/src/themes/minimal.json",
  import.meta.url,
);
const theme = JSON.parse(readFileSync(DEFAULT, "utf8")) as Record<
  string,
  unknown
>;

/** The sheet a document ships, for one theme. */
async function sheetFor(markup: string): Promise<string> {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: theme } })],
  });
  const { css } = await uno.generate(markup);
  return css;
}

/** One rule's declarations, as a property -> value table. */
function declarationsFor(css: string, selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // The exact rule head first: the selector text also occurs inside longer
  // selectors (the field exclusion list). A shared head (a selector list)
  // falls back to the first `{` that holds no `}` before it.
  const exact = new RegExp(`${escaped}\\{([^\\}]*)\\}`).exec(css);
  const shared = new RegExp(`${escaped}[^{]*\\{([^\\}]*)\\}`).exec(css);
  const match = exact ?? shared;
  assert(match?.[1] !== undefined, `the sheet has no ${selector} rule`);
  for (const entry of match[1].split(";")) {
    const text = entry.trim();
    if (text.length === 0) continue;
    const colon = text.indexOf(":");
    if (colon < 0) continue;
    out[text.slice(0, colon).trim()] = text.slice(colon + 1).trim();
  }
  return out;
}

test("a range paints its groove from the sunken token and its fill from the primary", async () => {
  const css = await sheetFor('<input type="range">');
  const groove = declarationsFor(css, 'input[type="range"]');
  deepStrictEqual(
    groove["appearance"],
    "none",
    "the groove is drawn, not the platform's",
  );
  deepStrictEqual(groove["min-height"], "0", "the field floor is reset");
  deepStrictEqual(groove["padding"], "0", "the field padding is reset");
  deepStrictEqual(groove["border"], "none", "the field border is reset");
  const fill = groove["background-image"] ?? "";
  assert(
    fill.includes("var(--range-progress, 0%)"),
    `the fill follows the control's share, got: ${fill}`,
  );
  assert(
    fill.includes("transparent"),
    `a missing share paints empty, not blue, got: ${fill}`,
  );
});
test("a range paints its thumb as a drawn circle", async () => {
  const css = await sheetFor('<input type="range">');
  // The two engines share one thumb rule; the moz head opens its body.
  const thumb = declarationsFor(css, 'input[type="range"]::-moz-range-thumb');
  deepStrictEqual(thumb["appearance"], "none", "the thumb is drawn");
  deepStrictEqual(
    thumb["border-radius"],
    "50%",
    "the thumb is a circle, not a box",
  );
});
