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
import { primitiveVariants } from "@spin/primitives";

/**
 * The feedback surface spends the scales and mints no tokens. Progress, loading
 * and accessibility are states rather than components, expressed through ARIA
 * so the browser and assistive technology agree about what is happening without
 * a class.
 *
 * What makes feedback worth testing is the spinner and the visually-hidden
 * recipe. A spinner inherits currentColor, so it has to be legible on whatever
 * surface it appears. The visually-hidden recipe is fixed at `1px` — a value a
 * theme may not restate.
 */

const EXAMPLES = new URL("../../theme/examples/", import.meta.url);
const THEMES = ["default/light.json", "neobrut.json", "console.json"] as const;

/** Scale steps the feedback CSS spends. */
const SPENT = [
  "spacing.1",
  "spacing.2",
  "radius.full",
  "color.primary",
  "color.surface-raised",
  "motion.duration.fast",
  "motion.duration.base",
  "motion.easing.standard",
] as const;

/** The feedback's visually-hidden variant. */
const VARIANTS = ["visually-hidden"] as const;

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
  Deno.test(`${name} declares every scale step the feedback surface spends`, () => {
    const declared = new Set(Object.keys(indexTree(parse(name)).vars));
    const missing = SPENT.filter(
      (path) => !declared.has(path.replace(/\./g, "-")),
    );
    assertEquals(
      missing,
      [],
      `${name} is missing scale steps the feedback surface reads: ${
        missing.join(", ")
      }`,
    );
  });

  Deno.test(`${name} feedback text is legible on its own surface`, () => {
    const issues = validateLegibility(parse(name)).filter((issue) =>
      issue.path.startsWith("color.on-")
    );
    assertEquals(issues, [], `${name} feedback text fails its contrast floor`);
  });

  Deno.test(`${name} gives a progress bar a fill distinct from its track`, () => {
    const tree = parse(name);
    const fill = resolved(tree, "color.primary");
    const track = resolved(tree, "color.surface-raised");
    assert(fill !== undefined, `${name} has no primary fill`);
    assert(track !== undefined, `${name} has no surface-raised track`);
    assert(
      fill !== track,
      `${name}: progress fill and track resolve to the same color, so a ` +
        `progress bar is invisible`,
    );
  });

  Deno.test(`${name} feedback foreground parses as a color the engine understands`, () => {
    const ink = resolved(parse(name), "color.primary");
    assert(ink !== undefined, `${name} has no primary color`);
    const rgb = parseColor(ink);
    assert(
      [rgb.r, rgb.g, rgb.b].every((c) => Number.isFinite(c)),
      `${name}: primary ${ink} did not parse to channels`,
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

  Deno.test(`${name} motion durations are real lengths of time`, () => {
    const tree = parse(name);
    for (const path of ["motion.duration.fast", "motion.duration.base"]) {
      const value = resolved(tree, path);
      assert(value !== undefined, `${name} has no ${path}`);
      assert(
        /^[\d.]+(ms|s)$/.test(value),
        `${name}: ${path} is ${JSON.stringify(value)}, which is not a duration`,
      );
    }
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

Deno.test("feedback variants are reachable from the global set the lint uses", () => {
  for (const variant of VARIANTS) {
    assertEquals(
      primitiveVariants().has(variant),
      true,
      `--${variant} is defined by the feedback surface but missing from the lint vocabulary`,
    );
  }
});

Deno.test("a theme missing a scale step the feedback surface spends is reported", () => {
  const doc = JSON.parse(
    Deno.readTextFileSync(new URL("default/light.json", EXAMPLES)),
  ) as { spacing: Record<string, unknown> };
  delete doc.spacing["2"];

  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, {
    required: [...allRequiredRoles(), "spacing.2"],
  });
  assert(
    report.issues.some((issue) => issue.path === "spacing.2"),
    "a theme missing spacing.2 should be reported, since the feedback surface spends it",
  );
});

Deno.test("every scale step the feedback surface reads is a length or a keyword the engine accepts", () => {
  for (const name of THEMES) {
    const tree = parse(name);
    for (const path of ["radius.full", "spacing.1", "spacing.2"]) {
      const value = resolved(tree, path);
      assert(value !== undefined, `${name} has no ${path}`);
      assert(
        value === "0" || /^-?[\d.]+(rem|px|em)$/.test(value),
        `${name}: ${path} is ${JSON.stringify(value)}, which is not a length`,
      );
    }
  }
});
