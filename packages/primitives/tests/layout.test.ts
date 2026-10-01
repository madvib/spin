import { assert, assertEquals } from "@std/assert";
import { indexTree, parseTokens, resolveAliases } from "@spin/theme";
import type { TokenLeaf, TokenTree } from "@spin/theme";
import { validateLegibility, validateTokens } from "@spin/theme";
import { allRequiredRoles } from "@spin/preset";
import { primitiveVariants } from "@spin/primitives";

/**
 * The layout is the purest expression of the spent-binding rule: a container
 * and the landmarks. There is nothing about a landmark a theme would answer
 * differently, so it mints no tokens at all and spends `spacing` straight out
 * of the CSS.
 *
 * What makes layout worth testing is the container variants and the section
 * rhythm. A container caps the column at 80ch and centers it; a fluid container
 * goes full width with gutters only; a section stacks on the spacing scale.
 * The grid gutter is a custom property consumed by the utility layer.
 */

const EXAMPLES = new URL("../../theme/examples/", import.meta.url);
const THEMES = ["default/light.json", "neobrut.json", "console.json"] as const;

/** Scale steps the layout CSS spends. */
const SPENT = [
  "spacing.4",
] as const;

/** The layout's container and overflow variants. */
const VARIANTS = ["container", "container-fluid", "overflow-auto"] as const;

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
  Deno.test(`${name} declares every scale step the layout spends`, () => {
    const declared = new Set(Object.keys(indexTree(parse(name)).vars));
    const missing = SPENT.filter(
      (path) => !declared.has(path.replace(/\./g, "-")),
    );
    assertEquals(
      missing,
      [],
      `${name} is missing scale steps the layout reads: ${missing.join(", ")}`,
    );
  });

  Deno.test(`${name} layout text is legible on the page surface`, () => {
    const issues = validateLegibility(parse(name)).filter((issue) =>
      issue.path.startsWith("color.on-")
    );
    assertEquals(issues, [], `${name} layout text fails its contrast floor`);
  });

  Deno.test(`${name} spends a spacing scale that grows`, () => {
    const tree = parse(name);
    const steps = ["4"].map((s) => toPx(resolved(tree, `spacing.${s}`)));
    for (let i = 1; i < steps.length; i++) {
      assert(
        steps[i - 1] < steps[i],
        `${name}: spacing scale is not ordered at index ${i} (${
          steps.join(", ")
        })`,
      );
    }
  });
}

Deno.test("layout variants are reachable from the global set the lint uses", () => {
  for (const variant of VARIANTS) {
    assertEquals(
      primitiveVariants().has(variant),
      true,
      `--${variant} is defined by the layout but missing from the lint vocabulary`,
    );
  }
});

Deno.test("a theme missing a scale step the layout spends is reported", () => {
  const doc = JSON.parse(
    Deno.readTextFileSync(new URL("default/light.json", EXAMPLES)),
  ) as { spacing: Record<string, unknown> };
  delete doc.spacing["4"];

  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, {
    required: [...allRequiredRoles(), "spacing.4"],
  });
  assert(
    report.issues.some((issue) => issue.path === "spacing.4"),
    "a theme missing spacing.4 should be reported, since the layout spends it",
  );
});
