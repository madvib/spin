import { assert, assertEquals } from "@std/assert";
import {
  contrastRatio,
  indexTree,
  parseColor,
  parseTokens,
  resolveAliases,
} from "@spin/theme";
import type { TokenLeaf, TokenTree } from "@spin/theme";
import { validateLegibility, validateTokens } from "@spin/theme";
import { allRequiredRoles } from "@spin/preset";

/**
 * The group is the one place where a component reaches into another: a joined
 * control has to flatten its children's radii and lift a focused child above
 * its siblings' borders. That is a relationship, and CSS has no other way to
 * express one.
 *
 * The group mints no tokens of its own. The tests here are about the scales
 * being present and usable, and about the tooltip being reachable.
 */

const EXAMPLES = new URL("../../theme/examples/", import.meta.url);
const THEMES = ["default/light.json", "neobrut.json", "console.json"] as const;

/** Scale steps the group CSS spends. */
const SPENT = [
  "spacing.1",
  "spacing.2",
  "radius.sm",
  "radius.md",
  "radius.full",
  "border.width",
  "color.surface",
  "color.text",
  "color.border",
  "color.focus-ring",
  "focus.width",
  "font.size.xs",
  "motion.duration.fast",
  "motion.easing.standard",
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
  Deno.test(`${name} declares every scale step the group spends`, () => {
    const declared = new Set(Object.keys(indexTree(parse(name)).vars));
    const missing = SPENT.filter(
      (path) => !declared.has(path.replace(/\./g, "-")),
    );
    assertEquals(
      missing,
      [],
      `${name} is missing scale steps the group reads: ${missing.join(", ")}`,
    );
  });

  Deno.test(`${name} group text is legible on its own surface`, () => {
    const issues = validateLegibility(parse(name)).filter((issue) =>
      issue.path.startsWith("color.on-")
    );
    assertEquals(issues, [], `${name} group text fails its contrast floor`);
  });

  Deno.test(`${name} gives a tooltip a foreground distinct from its surface`, () => {
    const tree = parse(name);
    const fill = resolved(tree, "color.surface");
    const ink = resolved(tree, "color.text");
    assert(fill !== undefined, `${name} has no surface fill`);
    assert(ink !== undefined, `${name} has no text color`);
    const ratio = contrastRatio(fill, ink);
    assert(
      ratio >= 4.5,
      `${name}: ${ink} on ${fill} is ${
        ratio.toFixed(2)
      }:1, below the 4.5:1 floor`,
    );
  });

  Deno.test(`${name} group foreground parses as a color the engine understands`, () => {
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
    const steps = ["1", "2"].map((s) => toPx(resolved(tree, `spacing.${s}`)));
    for (let i = 1; i < steps.length; i++) {
      assert(
        steps[i - 1] < steps[i],
        `${name}: spacing scale is not ordered at index ${i} (${
          steps.join(", ")
        })`,
      );
    }
  });

  Deno.test(`${name} border weight is a real stroke width`, () => {
    const width = resolved(parse(name), "border.width");
    assert(width !== undefined, `${name} has no border.width`);
    const px = toPx(width);
    assert(
      px >= 1,
      `${name}: border.width is ${width}, which would render an invisible seam`,
    );
  });

  Deno.test(`${name} focus ring is a real width`, () => {
    const width = resolved(parse(name), "focus.width");
    assert(width !== undefined, `${name} has no focus.width`);
    const px = toPx(width);
    assert(
      px >= 1,
      `${name}: focus.width is ${width}, which would render an invisible ring`,
    );
  });

  Deno.test(`${name} motion durations are real lengths of time`, () => {
    const tree = parse(name);
    const value = resolved(tree, "motion.duration.fast");
    assert(value !== undefined, `${name} has no motion.duration.fast`);
    assert(
      /^[\d.]+(ms|s)$/.test(value),
      `${name}: motion.duration.fast is ${
        JSON.stringify(value)
      }, which is not a duration`,
    );
  });

  Deno.test(`${name} motion easings are keywords the engine accepts`, () => {
    const tree = parse(name);
    const value = resolved(tree, "motion.easing.standard");
    assert(value !== undefined, `${name} has no motion.easing.standard`);
    assert(
      /^(ease|ease-in|ease-out|ease-in-out|linear|cubic-bezier\()/.test(
        value,
      ),
      `${name}: motion.easing.standard is ${
        JSON.stringify(value)
      }, which is not an easing`,
    );
  });
}

Deno.test("a theme missing a scale step the group spends is reported", () => {
  const doc = JSON.parse(
    Deno.readTextFileSync(new URL("default/light.json", EXAMPLES)),
  ) as { radius: Record<string, unknown> };
  delete doc.radius["full"];

  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, {
    required: [...allRequiredRoles(), "radius.full"],
  });
  assert(
    report.issues.some((issue) => issue.path === "radius.full"),
    "a theme missing radius.full should be reported, since the group spends it",
  );
});

Deno.test("every scale step the group reads is a length or a keyword the engine accepts", () => {
  for (const name of THEMES) {
    const tree = parse(name);
    for (
      const path of [
        "border.width",
        "radius.sm",
        "radius.md",
        "radius.full",
        "focus.width",
        "spacing.1",
        "spacing.2",
      ]
    ) {
      const value = resolved(tree, path);
      assert(value !== undefined, `${name} has no ${path}`);
      assert(
        value === "0" || /^-?[\d.]+(rem|px|em)$/.test(value),
        `${name}: ${path} is ${JSON.stringify(value)}, which is not a length`,
      );
    }
  }
});
