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
 * The button is the one component that owns character, so it is where the
 * contract gets tested hardest.
 *
 * The architecture the button now embodies:
 *
 *   Spent bindings  metrics the CSS reads straight off a scale — `spacing`,
 *                   `radius`, `font-size`, `motion-duration`. No button token
 *                   exists for them, and there should not be one.
 *   Character       `button.*` tokens for the decisions a theme genuinely owns:
 *                   the hover lift, the offset shadow, the case, the tracking.
 *
 * The tests below assert both halves. A theme that drops a scale step breaks
 * every button, so the scales are checked here too even though the button does
 * not name them.
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
 * The character tokens a button owns. Everything else it reads is a scale step
 * the CSS spends directly, so a button token appearing here means a theme owns
 * a decision rather than merely consuming one.
 */
const CHARACTER = [
  "button.weight",
  "button.case",
  "button.tracking",
  "button.border-width",
  "button.shadow",
  "button.shadow-hover",
  "button.hover-lift-x",
  "button.hover-lift-y",
] as const;

/** The focus ring is shared, so every component states the same two steps. */
const FOCUS = ["focus.width", "focus.offset"] as const;

/** Scale steps the button CSS spends. Dropping one breaks every button. */
const SPENT = [
  "spacing.1",
  "spacing.2",
  "spacing.4",
  "spacing.8",
  "radius.md",
  "font.size.sm",
  "font.size.md",
  "font.size.lg",
  "motion.duration.fast",
  "motion.easing.standard",
  "border.width",
  ...FOCUS,
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

/** A leaf's value with every alias inlined, which is what a button renders. */
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
  Deno.test(`${name} declares every token the button needs`, () => {
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

  Deno.test(`${name} keeps button text legible on its own fill`, () => {
    const issues = validateLegibility(parse(name)).filter((issue) =>
      issue.path.startsWith("color.on-")
    );
    assertEquals(issues, [], `${name} button text fails its contrast floor`);
  });

  Deno.test(`${name} gives a filled button a foreground distinct from its fill`, () => {
    const tree = parse(name);
    const fill = resolved(tree, "color.primary");
    const ink = resolved(tree, "color.on-primary");
    assert(fill !== undefined, `${name} has no primary fill`);
    assert(ink !== undefined, `${name} has no on-primary foreground`);
    const ratio = contrastRatio(fill, ink);
    assert(
      ratio >= 4.5,
      `${name}: ${ink} on ${fill} is ${
        ratio.toFixed(2)
      }:1, below the 4.5:1 floor`,
    );
  });

  Deno.test(`${name} button foreground parses as a color the engine understands`, () => {
    const ink = resolved(parse(name), "color.on-primary");
    assert(ink !== undefined, `${name} has no on-primary`);
    const rgb = parseColor(ink);
    assert(
      [rgb.r, rgb.g, rgb.b].every((c) => Number.isFinite(c)),
      `${name}: on-primary ${ink} did not parse to channels`,
    );
  });

  Deno.test(`${name} spends a spacing scale that grows`, () => {
    // The button's padding is a spacing step, so a scale that does not grow
    // makes every button in the theme feel wrong in a way no token-level test
    // would attribute to the button.
    const tree = parse(name);
    const steps = ["1", "2", "4", "8"].map((s) =>
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

  Deno.test(`${name} spends a type scale that grows`, () => {
    const tree = parse(name);
    const steps = ["sm", "md", "lg"].map((s) =>
      toPx(resolved(tree, `font.size.${s}`))
    );
    assert(
      steps[0] < steps[1] && steps[1] < steps[2],
      `${name}: font.size is not ordered (${steps.join(", ")})`,
    );
  });

  Deno.test(`${name} states a text-transform the engine accepts`, () => {
    // `text-transform` is not a DTCG type, so the vocabulary grew one. A typo
    // here emits an invalid declaration and drops the whole rule silently.
    const value = resolved(parse(name), "button.case");
    assert(value !== undefined, `${name} has no button.case`);
    assert(
      ["none", "capitalize", "uppercase", "lowercase"].includes(value),
      `${name}: button.case is ${JSON.stringify(value)}`,
    );
  });

  Deno.test(`${name} border weight is a real stroke width`, () => {
    // The button, the input and the card all read this one step, so a theme
    // with a fractional or zero stroke renders controls that vanish.
    const width = resolved(parse(name), "border.width");
    assert(width !== undefined, `${name} has no border.width`);
    const px = toPx(width);
    assert(
      px >= 1,
      `${name}: border.width is ${width}, which would render an invisible edge`,
    );
  });
}

Deno.test("the dark override restates the colors that flip and inherits the metrics", () => {
  // The contract is asymmetric on purpose: colors are restated, metrics are
  // inherited, and the merged result is what renders.
  const dark = parse("default/dark.json");
  const stated = new Set(flatten(dark).map((l) => l.path.slice(1).join(".")));

  assert(
    !stated.has("button.shadow"),
    "the dark block should inherit button character from light, not repeat it",
  );

  for (
    const role of [
      "color.primary",
      "color.on-primary",
      "color.on-danger",
      "color.surface",
      "color.text",
      "color.focus-ring",
    ]
  ) {
    assert(
      stated.has(role),
      `the dark block must restate ${role}; colors do not carry over`,
    );
  }

  const mergedTree = merged(parse("default/light.json"));
  for (const path of [...CHARACTER, ...SPENT]) {
    assert(
      resolved(mergedTree, path) !== undefined,
      `merged theme has no ${path}`,
    );
  }
});

Deno.test("a theme that differentiates only by color is not a differentiated button", () => {
  // The point of semantic tokens is that a theme changes the character of the
  // control, not just its palette. Identical character across themes would mean
  // the layer is a repaint, which is the failure it exists to prevent.
  const shape = (name: string) =>
    [
      "button.case",
      "button.tracking",
      "button.border-width",
      "button.hover-lift-x",
    ]
      .map((p) => resolved(parse(name), p))
      .join("|");

  const shapes = new Map(THEMES.map((n) => [n, shape(n)] as const));
  assertEquals(
    new Set(shapes.values()).size,
    shapes.size,
    `themes collapse to one button: ${
      [...shapes].map(([k, v]) => `${k}=${v}`).join("  ")
    }`,
  );
});

Deno.test("a theme missing a character token is reported, not half-rendered", () => {
  // Without a declared case or lift the declaration is dropped and the button
  // silently falls back to the browser default.
  const doc = JSON.parse(
    Deno.readTextFileSync(new URL("default/light.json", EXAMPLES)),
  ) as Record<string, Record<string, unknown>>;
  delete (doc["button"] as Record<string, unknown>)["case"];

  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, {
    required: [...allRequiredRoles()],
  });
  assert(
    report.issues.some((issue) => issue.path === "button.case"),
    "a theme missing button.case should be reported",
  );
});

Deno.test("a theme missing a spent scale step is reported, not silently unstyled", () => {
  // The button has no `padding` token of its own, so if the spacing scale loses
  // a step the button renders with no padding and nothing complains. This is
  // the failure mode the spent-binding design creates, so it gets a test.
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
    "a theme missing spacing.2 should be reported, since the button spends it",
  );
});

Deno.test("every character token the button reads is a length or a keyword the engine accepts", () => {
  for (const name of THEMES) {
    const tree = parse(name);
    // Sizes, lifts and the ring are lengths; the case is a keyword.
    for (
      const path of [
        "button.border-width",
        "button.hover-lift-x",
        "button.hover-lift-y",
        "focus.width",
        "focus.offset",
      ]
    ) {
      const value = resolved(tree, path);
      assert(value !== undefined, `${name} has no ${path}`);
      // A bare `0` is a valid CSS length and is what a theme that wants no lift
      // states; anything else needs a unit or the declaration is dropped.
      assert(
        value === "0" || /^-?[\d.]+(rem|px|em)$/.test(value),
        `${name}: ${path} is ${JSON.stringify(value)}, which is not a length`,
      );
    }
  }
});
