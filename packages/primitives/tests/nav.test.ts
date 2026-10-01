import { assert, assertEquals } from "@std/assert";
import {
  indexTree,
  parseColor,
  parseTokens,
  resolveAliases,
} from "@spin/theme";
import type { TokenLeaf, TokenTree } from "@spin/theme";
import { validateLegibility, validateTokens } from "@spin/theme";
import { allRequiredRoles } from "@spin/preset";

/**
 * The nav is a landmark with spacing from the scale and weight from the type
 * scale. What a nav *is* — a list of links, a set of tabs, a breadcrumb trail
 * — is expressed by the markup inside it, not by a token.
 *
 * The nav mints no tokens of its own. The tests here are about the scales
 * being present and usable, and about the breadcrumb variant being reachable.
 */

const EXAMPLES = new URL("../../theme/examples/", import.meta.url);
const THEMES = ["default/light.json", "neobrut.json", "console.json"] as const;

/** Scale steps the nav CSS spends. */
const SPENT = [
  "spacing.1",
  "spacing.2",
  "spacing.4",
  "color.text",
  "color.text-muted",
  "font.weight.semibold",
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

/** A length in px, so a rem value and a px value can be compared. */
function toPx(value: string | undefined): number {
  if (value === undefined) return NaN;
  const rem = value.match(/^([\d.]+)rem$/);
  if (rem) return Number(rem[1]) * 16;
  const px = value.match(/^([\d.]+)px$/);
  if (px) return Number(px[1]);
  return Number(value);
}

for (const name of THEMES) {
  Deno.test(`${name} declares every scale step the nav spends`, () => {
    const declared = new Set(Object.keys(indexTree(parse(name)).vars));
    const missing = SPENT.filter(
      (path) => !declared.has(path.replace(/\./g, "-")),
    );
    assertEquals(
      missing,
      [],
      `${name} is missing scale steps the nav reads: ${missing.join(", ")}`,
    );
  });

  Deno.test(`${name} nav text is legible on the page surface`, () => {
    const issues = validateLegibility(parse(name)).filter((issue) =>
      issue.path.startsWith("color.on-")
    );
    assertEquals(issues, [], `${name} nav text fails its contrast floor`);
  });

  Deno.test(`${name} gives a nav link a foreground distinct from muted`, () => {
    const tree = parse(name);
    const text = resolved(tree, "color.text");
    const muted = resolved(tree, "color.text-muted");
    assert(text !== undefined, `${name} has no text color`);
    assert(muted !== undefined, `${name} has no muted color`);
    assert(
      text !== muted,
      `${name}: nav text and muted resolve to the same color, so a breadcrumb ` +
        `separator is invisible`,
    );
  });

  Deno.test(`${name} nav foreground parses as a color the engine understands`, () => {
    const ink = resolved(parse(name), "color.text");
    assert(ink !== undefined, `${name} has no text color`);
    const rgb = parseColor(ink);
    assert(
      [rgb.r, rgb.g, rgb.b].every((c) => Number.isFinite(c)),
      `${name}: text ${ink} did not parse to channels`,
    );
  });

  Deno.test(`${name} spends a spacing scale that grows`, () => {
    const tree = parse(name);
    const steps = ["1", "2", "4"].map((s) =>
      toPx(resolved(tree, `spacing.${s}`))
    );
    for (let i = 1; i < steps.length; i++) {
      assert(
        steps[i - 1] < steps[i],
        `${name}: spacing scale is not ordered at index ${i} (${
          steps.join(", ")
        })`,
      );
    }
  });

  Deno.test(`${name} font weight semibold is a real weight`, () => {
    const weight = resolved(parse(name), "font.weight.semibold");
    assert(weight !== undefined, `${name} has no font.weight.semibold`);
    const num = Number(weight);
    assert(
      Number.isFinite(num) && num >= 400,
      `${name}: font.weight.semibold is ${
        JSON.stringify(weight)
      }, which is not a weight`,
    );
  });
}

Deno.test("a theme missing a scale step the nav spends is reported", () => {
  const doc = JSON.parse(
    Deno.readTextFileSync(new URL("default/light.json", EXAMPLES)),
  ) as { spacing: Record<string, unknown> };
  delete doc.spacing["1"];

  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, {
    required: [...allRequiredRoles(), "spacing.1"],
  });
  assert(
    report.issues.some((issue) => issue.path === "spacing.1"),
    "a theme missing spacing.1 should be reported, since the nav spends it",
  );
});

Deno.test("every scale step the nav reads is a length or a keyword the engine accepts", () => {
  for (const name of THEMES) {
    const tree = parse(name);
    for (const path of ["spacing.1", "spacing.2", "spacing.4"]) {
      const value = resolved(tree, path);
      assert(value !== undefined, `${name} has no ${path}`);
      assert(
        value === "0" || /^-?[\d.]+(rem|px|em)$/.test(value),
        `${name}: ${path} is ${JSON.stringify(value)}, which is not a length`,
      );
    }
  }
});
