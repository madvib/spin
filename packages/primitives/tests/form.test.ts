import { assert, assertEquals } from "@std/assert";
import {
  contrastRatio,
  indexTree,
  parseColor,
  parseTokens,
  resolveAliases,
  validateTokens,
} from "@spin/theme";
import type { TokenLeaf, TokenTree } from "@spin/theme";

/**
 * The form surface spends the scales and mints no tokens of its own — every
 * theme would pad a field, round it and type it the same way, so those are
 * spent bindings read straight out of the CSS. Validation is expressed through
 * `aria-invalid`, which costs no token at all: the border moves to a semantic
 * color the theme already states the meaning of.
 *
 * What these tests guard is the exposure that creates. With no component-owned
 * tokens, a theme that drops a scale step leaves every field unstyled and
 * nothing complains, so the scales the form reads are checked here. So is the
 * thing no scale check would catch: pass and fail colors that are not legible
 * against the field they are drawn on. A validation border is a non-text
 * indicator and needs 3:1, not the 4.5:1 a body of text needs.
 */

const EXAMPLES = new URL("../../theme/examples/", import.meta.url);
const THEMES = ["default/light.json", "neobrut.json", "console.json"] as const;

/** Custom properties the form CSS spends, keyed as `indexTree` keys them. */
const SPENT = [
  "spacing-1",
  "spacing-2",
  "spacing-4",
  "spacing-16",
  "radius-md",
  "radius-sm",
  "font-size-md",
  "font-size-sm",
  "font-weight-medium",
  "font-weight-semibold",
  "border-width",
  "motion-duration-fast",
  "motion-easing-standard",
] as const;

/**
 * Colors a form draws that are not the page's own text and surface. Each one
 * appears as a border or as helper text, so each has to be distinguishable from
 * the field it sits on.
 */
const STATE_COLORS = [
  "color.semantic.success",
  "color.semantic.error",
  "color.focus-ring",
] as const;

function parse(name: string): TokenTree {
  const doc = JSON.parse(Deno.readTextFileSync(new URL(name, EXAMPLES)));
  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
  return parsed.tree;
}

function flatten(nodes: TokenTree): TokenLeaf[] {
  const out: TokenLeaf[] = [];
  for (const node of nodes) {
    if (node.kind === "token") out.push(node);
    else out.push(...flatten(node.children));
  }
  return out;
}

function resolved(tree: TokenTree, path: string): string | undefined {
  const hit = new Map(
    flatten(resolveAliases(tree).tree).map((l) =>
      [l.path.join("."), String(l.value)] as const
    ),
  );
  return hit.get(path);
}

for (const name of THEMES) {
  Deno.test(`${name} declares every scale step the form spends`, () => {
    // No form-owned tokens means a dropped scale step is the only way this
    // breaks, so the contract has to carry the scales explicitly.
    const declared = new Set(Object.keys(indexTree(parse(name)).vars));
    const missing = SPENT.filter((token) => !declared.has(token));
    assertEquals(
      missing,
      [],
      `${name} is missing scale steps the form reads: ${missing.join(", ")}`,
    );
  });

  Deno.test(`${name} form text is legible on the field it is typed in`, () => {
    const tree = parse(name);
    const fill = resolved(tree, "color.surface-raised");
    const ink = resolved(tree, "color.text");
    assert(fill !== undefined, `${name} has no surface-raised`);
    assert(ink !== undefined, `${name} has no text color`);
    const ratio = contrastRatio(fill, ink);
    assert(
      ratio >= 4.5,
      `${name}: ${ink} on ${fill} is ${
        ratio.toFixed(2)
      }:1, below the 4.5:1 floor`,
    );
  });

  for (const token of STATE_COLORS) {
    Deno.test(`${name} ${token} is visible against a form field`, () => {
      // A validation border and a focus ring are non-text indicators, so the
      // bar is 3:1 rather than 4.5:1. Below it a field that failed looks the
      // same as a field that is merely untouched, which is the whole point of
      // marking it.
      const tree = parse(name);
      const indicator = resolved(tree, token);
      const field = resolved(tree, "color.surface-raised");
      assert(indicator !== undefined, `${name} has no ${token}`);
      assert(field !== undefined, `${name} has no surface-raised`);
      const ratio = contrastRatio(indicator, field);
      assert(
        ratio >= 3,
        `${name}: ${token} (${indicator}) on ${field} is ` +
          `${ratio.toFixed(2)}:1, below the 3:1 floor for a non-text indicator`,
      );
    });
  }

  Deno.test(`${name} helper text is legible on the field it annotates`, () => {
    // A note under a field is prose, so it answers to the text floor even
    // though it is small.
    const tree = parse(name);
    const note = resolved(tree, "color.text-muted");
    const field = resolved(tree, "color.surface-raised");
    assert(note !== undefined, `${name} has no text-muted`);
    assert(field !== undefined, `${name} has no surface-raised`);
    const ratio = contrastRatio(note, field);
    assert(
      ratio >= 4.5,
      `${name}: helper text ${note} on ${field} is ` +
        `${ratio.toFixed(2)}:1, below the 4.5:1 floor`,
    );
  });

  Deno.test(`${name} pass and fail indicators are told apart by hue, not just weight`, () => {
    // Two status colors can both be legible against the field and still be the
    // same color to someone looking at them: neobrut's green and red sit at
    // nearly the same luminance, so a contrast ratio between them reads 1.04
    // and tells us nothing. What matters is that they are perceptually
    // different colors, which is a channel-distance question, not a luminance
    // one. Hue is the channel carrying the meaning here, so this deliberately
    // measures hue distance and ignores brightness.
    const tree = parse(name);
    const pass = resolved(tree, "color.semantic.success");
    const fail = resolved(tree, "color.semantic.error");
    assert(pass !== undefined, `${name} has no semantic.success`);
    assert(fail !== undefined, `${name} has no semantic.error`);

    const hueOf = (value: string): number => {
      const { r, g, b } = parseColor(value);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      // A neutral has no hue, so it is reported as 0 and will read as close to
      // anything else neutral — which is the correct verdict.
      if (delta === 0) return 0;
      let hue: number;
      if (max === r) hue = ((g - b) / delta) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
      return hue;
    };

    const a = hueOf(pass);
    const b = hueOf(fail);
    // Shorter way around the wheel, so 350 and 10 count as 20 apart.
    const distance = Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
    assert(
      distance >= 30,
      `${name}: success ${pass} and error ${fail} are only ${
        distance.toFixed(
          0,
        )
      }° apart in hue, so a failed field reads as a valid one`,
    );
  });
}

Deno.test("a theme missing a scale step the form spends is reported", () => {
  // The spent-binding design means a dropped scale is invisible to any
  // component-level check, so the completeness contract has to carry it.
  const doc = JSON.parse(
    Deno.readTextFileSync(new URL("default/light.json", EXAMPLES)),
  ) as { spacing: Record<string, unknown> };
  delete doc.spacing["2"];

  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, {
    required: SPENT.map((t) => t.replace(/-/g, ".")),
  });
  assert(
    report.issues.some((issue) => issue.path === "spacing.2"),
    "a theme missing spacing.2 should be reported, since the form spends it",
  );
});
