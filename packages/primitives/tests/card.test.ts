import { assert, assertEquals } from "@std/assert";
import {
  contrastRatio,
  indexTree,
  parseTokens,
  resolveAliases,
} from "@spin/theme";
import type { TokenLeaf, TokenTree } from "@spin/theme";
import { validateTokens } from "@spin/theme";

/**
 * The card is the purest expression of the spent-binding rule: a raised
 * surface with a border and some padding. There is nothing about it a theme
 * would answer differently, so it mints no tokens at all and spends `spacing`,
 * `radius`, `shadow` and `border.width` straight out of the CSS.
 *
 * That makes the card the component most exposed to a theme that drops a scale
 * step, so the tests here are about the scales being present and usable.
 */

const EXAMPLES = new URL("../../theme/examples/", import.meta.url);
const THEMES = ["default/light.json", "neobrut.json", "console.json"] as const;

/** Scale steps the card CSS spends. */
const SPENT = [
  "spacing.4",
  "radius.lg",
  "shadow.sm",
  "border.width",
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
  Deno.test(`${name} declares every scale step the card spends`, () => {
    const declared = new Set(Object.keys(indexTree(parse(name)).vars));
    const missing = SPENT.filter(
      (path) => !declared.has(path.replace(/\./g, "-")),
    );
    assertEquals(
      missing,
      [],
      `${name} is missing scale steps the card reads: ${missing.join(", ")}`,
    );
  });

  Deno.test(`${name} card text is legible on its own surface`, () => {
    // A card is a reading surface. Text on it has to clear AA or the theme is
    // unusable for the thing a card is for.
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

  Deno.test(`${name} card edge is distinguishable from its own fill`, () => {
    // The border exists to separate the card from the page behind it. A theme
    // whose border matches its surface renders a card with no edge at all,
    // which no contrast check on text would catch.
    const tree = parse(name);
    const border = resolved(tree, "color.border");
    const surface = resolved(tree, "color.surface");
    const fill = resolved(tree, "color.surface-raised");
    assert(border !== undefined, `${name} has no border color`);
    assert(surface !== undefined, `${name} has no surface color`);
    assert(fill !== undefined, `${name} has no surface-raised fill`);
    assert(
      contrastRatio(border, surface) > 1.05 ||
        contrastRatio(border, fill) > 1.05,
      `${name}: border ${border} is indistinguishable from surface ${surface} and fill ${fill}`,
    );
  });

  Deno.test(`${name} card elevation is a shadow value the engine can render`, () => {
    // A theme may legitimately state `none` — neobrut uses hard borders instead
    // of shadows, and that is a design decision, not a defect. What must not
    // happen is a malformed shadow that the engine drops, leaving the card
    // with neither the shadow it asked for nor a border to fall back on.
    const tree = parse(name);
    const elevation = resolved(tree, "shadow.sm");
    const border = resolved(tree, "color.border");
    assert(elevation !== undefined, `${name} has no shadow.sm`);
    assert(border !== undefined, `${name} has no border to fall back on`);
    if (elevation.trim() === "none") {
      // Flat by choice, so the border has to be carrying the edge.
      assert(
        contrastRatio(border, resolved(tree, "color.surface") ?? "") > 1.05,
        `${name}: shadow is none and the border does not separate the card`,
      );
      return;
    }
    assert(
      /(^0\s)|(\d)/.test(elevation) && !/undefined|NaN/.test(elevation),
      `${name}: shadow.sm is ${
        JSON.stringify(elevation)
      }, which the engine cannot render`,
    );
  });
}

Deno.test("a theme missing a scale step the card spends is reported", () => {
  // With no `card.*` tokens of its own, the card has no other way to fail
  // loudly, so the completeness contract has to carry the scales.
  const doc = JSON.parse(
    Deno.readTextFileSync(new URL("default/light.json", EXAMPLES)),
  ) as { radius: Record<string, unknown> };
  delete doc.radius["lg"];

  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, { required: [...SPENT] });
  assert(
    report.issues.some((issue) => issue.path === "radius.lg"),
    "a theme missing radius.lg should be reported, since the card spends it",
  );
});
