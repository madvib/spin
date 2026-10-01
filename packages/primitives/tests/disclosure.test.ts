import { assert, assertEquals } from "@std/assert";
import {
  contrastRatio,
  parseColor,
  parseTokens,
  resolveAliases,
} from "@spin/theme";
import type { TokenLeaf, TokenTree } from "@spin/theme";
import { validateLegibility, validateTokens } from "@spin/theme";
import { allRequiredRoles } from "@spin/preset";

/**
 * The disclosure is the one component that owns no character at all. A
 * disclosure widget and a dialog are platform primitives — the browser owns
 * the behaviour, the focus handling and the semantics — so the only thing a
 * theme can decide is how long the chevron takes to turn, and even that
 * spends `motion.duration.fast`.
 *
 * That makes the disclosure the component most exposed to a theme that drops
 * a scale step, so the tests here are about the scales being present and
 * usable, and about the open state being reachable.
 *
 * `default/dark.json` is an override set, judged on the merged result: it
 * restates the colors that flip and inherits everything else, because a dark
 * side that had to repeat every metric would be a second theme nobody keeps in
 * sync.
 */

const EXAMPLES = new URL("../../theme/examples/", import.meta.url);

/** Complete themes. Each must satisfy the contract unaided. */
const THEMES = ["default/light.json", "neobrut.json", "console.json"] as const;

/**
 * Scale steps the disclosure CSS spends. Dropping one breaks every disclosure
 * and dialog. The disclosure mints no tokens of its own.
 */
const SPENT = [
  "spacing.2",
  "spacing.4",
  "radius.md",
  "radius.lg",
  "shadow.lg",
  "border.width",
  "color.surface",
  "color.surface-raised",
  "color.text",
  "color.border",
  "color.focus-ring",
  "font.weight.semibold",
  "motion.duration.fast",
  "motion.duration.base",
  "motion.easing.standard",
  "motion.easing.decelerate",
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

/** What a consumer actually reads: the light tree with dark layered on top. */
function merged(tree: TokenTree): TokenTree {
  const dark = tree.find((n) => n.kind === "group" && n.path[0] === "dark");
  if (dark === undefined || dark.kind !== "group") return tree;
  return [...tree.filter((n) => n !== dark), dark];
}

/** A leaf's value with every alias inlined, which is what a disclosure renders. */
function resolved(tree: TokenTree, path: string): string | undefined {
  const hit = new Map(
    flatten(resolveAliases(merged(tree)).tree).map((l) =>
      [l.path.join("."), String(l.value)] as const
    ),
  );
  return hit.get(path);
}

/** A length in px, so values in rem and px can be compared. */
function toPx(value: string | undefined): number {
  if (value === undefined) return NaN;
  const rem = value.match(/^([\d.]+)rem$/);
  if (rem) return Number(rem[1]) * 16;
  const px = value.match(/^([\d.]+)px$/);
  if (px) return Number(px[1]);
  return Number(value);
}

for (const name of THEMES) {
  Deno.test(`${name} declares every token the disclosure needs`, () => {
    const report = validateTokens(parse(name), {
      required: [...allRequiredRoles()],
    });
    const missing = report.issues.filter((issue) =>
      issue.message.startsWith("missing")
    );
    assertEquals(
      missing,
      [],
      `${name} is missing: ${missing.map((i) => i.path).join(", ")}`,
    );
  });

  Deno.test(`${name} disclosure text is legible on its own surface`, () => {
    const issues = validateLegibility(parse(name)).filter((issue) =>
      issue.path.startsWith("color.on-")
    );
    assertEquals(
      issues,
      [],
      `${name} disclosure text fails its contrast floor`,
    );
  });

  Deno.test(`${name} gives a dialog a foreground distinct from its surface`, () => {
    const tree = parse(name);
    const fill = resolved(tree, "color.surface-raised");
    const ink = resolved(tree, "color.text");
    assert(fill !== undefined, `${name} has no surface-raised fill`);
    assert(ink !== undefined, `${name} has no text color`);
    const ratio = contrastRatio(fill, ink);
    assert(
      ratio >= 4.5,
      `${name}: ${ink} on ${fill} is ${
        ratio.toFixed(2)
      }:1, below the 4.5:1 floor`,
    );
  });

  Deno.test(`${name} disclosure foreground parses as a color the engine understands`, () => {
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
    const steps = ["2", "4"].map((s) => toPx(resolved(tree, `spacing.${s}`)));
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
      `${name}: border.width is ${width}, which would render an invisible edge`,
    );
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
    for (
      const path of ["motion.easing.standard", "motion.easing.decelerate"]
    ) {
      const value = resolved(tree, path);
      assert(value !== undefined, `${name} has no ${path}`);
      assert(
        /^(ease|ease-in|ease-out|ease-in-out|linear|cubic-bezier\()/.test(
          value,
        ),
        `${name}: ${path} is ${JSON.stringify(value)}, which is not an easing`,
      );
    }
  });

  Deno.test(`${name} shadow is a value the engine can render`, () => {
    const tree = parse(name);
    const elevation = resolved(tree, "shadow.lg");
    assert(elevation !== undefined, `${name} has no shadow.lg`);
    if (elevation.trim() === "none") return;
    assert(
      /(^0\s)|(\d)/.test(elevation) && !/undefined|NaN/.test(elevation),
      `${name}: shadow.lg is ${
        JSON.stringify(elevation)
      }, which the engine cannot render`,
    );
  });
}

Deno.test("the dark override restates the colors that flip and inherits the metrics", () => {
  const dark = parse("default/dark.json");
  const stated = new Set(flatten(dark).map((l) => l.path.slice(1).join(".")));

  assert(
    !stated.has("shadow.lg"),
    "the dark block should inherit shadow from light, not repeat it",
  );

  for (
    const role of [
      "color.surface",
      "color.surface-raised",
      "color.text",
      "color.border",
      "color.focus-ring",
    ]
  ) {
    assert(
      stated.has(role),
      `the dark block must restate ${role}; colors do not carry over`,
    );
  }

  const mergedTree = merged(parse("default/light.json"));
  for (const path of SPENT) {
    assert(
      resolved(mergedTree, path) !== undefined,
      `merged theme has no ${path}`,
    );
  }
});

Deno.test("a theme missing a spent scale step is reported, not silently unstyled", () => {
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
    "a theme missing spacing.4 should be reported, since the disclosure spends it",
  );
});

Deno.test("every scale step the disclosure reads is a length or a keyword the engine accepts", () => {
  for (const name of THEMES) {
    const tree = parse(name);
    for (
      const path of [
        "border.width",
        "radius.md",
        "radius.lg",
        "spacing.2",
        "spacing.4",
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
