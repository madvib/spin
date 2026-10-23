import { assert, assertEquals } from "@std/assert";
import {
  contrastRatio,
  indexTree,
  parseTokens,
  requiredPaths,
  resolveAliases,
  validateLegibility,
  validateTokens,
} from "@spin/theme";
import type { TokenLeaf, TokenNode, TokenTree } from "@spin/theme";

/**
 * The spin theme, held to its own brief.
 *
 * The shipped themes are the product, and spin is the one our own surfaces
 * wear — so its decisions are worth the same gates the package gives every
 * theme, plus the two it does not give any of them: the legibility floors in
 * EVERY mode (the package validates the base document), and the character the
 * brief decided — a flat depth ladder, a hard cut-out, a didone display step.
 */

const SPIN = new URL("../src/themes/spin.json", import.meta.url);

/** The spin document, parsed. */
function spinTree(): TokenTree {
  const parsed = parseTokens(JSON.parse(Deno.readTextFileSync(SPIN)));
  if (!parsed.ok) throw new Error(`spin.json did not parse: ${parsed.error}`);
  return parsed.tree;
}

/**
 * The tree as it reads in one mode.
 *
 * A mode is a variant of a token, so a tree in a mode is the same tree with
 * every leaf worth that mode's value. The package's own `validateLegibility`
 * reads the base document, which is why the floors have to be checked this
 * way to be checked at all in the dark.
 */
function treeInMode(tree: TokenTree, mode: string): TokenTree {
  const walk = (node: TokenNode): TokenNode => {
    if (node.kind === "token") {
      const leaf = node as TokenLeaf;
      return {
        ...leaf,
        value: leaf.modes?.[mode] ?? leaf.value,
        modes: undefined,
      };
    }
    return { ...node, children: node.children.map(walk) };
  };
  return tree.map(walk);
}

/** A token's resolved value in one mode, aliases followed. */
function valueInMode(
  tree: TokenTree,
  mode: string,
  path: string,
): string {
  const resolved = indexTree(
    resolveAliases(treeInMode(tree, mode)).tree,
  ).leaves;
  const leaf = resolved[path];
  if (leaf === undefined) throw new Error(`no token at ${path}`);
  if (typeof leaf.value !== "string") {
    throw new Error(`${path} is not a colour`);
  }
  return leaf.value;
}

/**
 * A shadow's own numbers: the offset it moves by, the blur it softens with.
 *
 * The theme's depth is flat, and an overlay is a cut sheet: a hard offset
 * with no blur. A blurred shadow would be a lit surface, which is the one
 * thing this theme does not do.
 */
function shadowParts(value: string): { offset: number; blur: number } {
  const lengths = [...value.matchAll(/(-?\d*\.?\d+)px/g)].map((match) =>
    Number(match[1])
  );
  return { offset: Math.abs(lengths[0] ?? 0), blur: Math.abs(lengths[2] ?? 0) };
}

/** The elevation a shadow carries: the distance it moves, in px. */
function shadowWeight(value: string): number {
  return [...value.matchAll(/(-?\d*\.?\d+)px/g)].reduce(
    (total, match) => total + Math.abs(Number(match[1])),
    0,
  );
}

Deno.test("the spin theme declares every role, and restates it for the night press", () => {
  // The same gate every theme gets, run on the theme our own surfaces wear:
  // the roles are present, the values are sound, and the dark mode is a
  // promise kept for every colour and focus leaf rather than half kept.
  const report = validateTokens(spinTree(), {
    required: requiredPaths(),
    modes: ["light", "dark"],
  });
  assertEquals(report.issues, []);
  assert(report.valid);
});

Deno.test("every legibility floor holds in both of the spin theme's modes", () => {
  // The package validates the base document's floors; the dark mode is where a
  // palette quietly fails, because the ink and the surface are both re-picked
  // and a colour that read on paper can vanish on charcoal.
  const tree = spinTree();
  for (const mode of ["light", "dark"]) {
    assertEquals(
      validateLegibility(treeInMode(tree, mode)).map((issue) =>
        `${issue.path}: ${issue.message}`
      ),
      [],
      `${mode}: a floor the theme does not meet`,
    );
  }
});

Deno.test("every fill the spin theme paints carries a readable ink, in both modes", () => {
  // The ink pairing is the theme's own answer to "what goes on this fill?",
  // and a fill whose ink cannot be read is a button nobody can read. Every
  // pair is measured in the mode it is painted in.
  const tree = spinTree();
  const pairs = [
    ["color.on-primary", "color.primary"],
    ["color.on-secondary", "color.secondary"],
    ["color.on-accent", "color.accent"],
    ["color.on-danger", "color.semantic.error"],
    ["color.on-semantic-success", "color.semantic.success"],
    ["color.on-semantic-warning", "color.semantic.warning"],
    ["color.on-semantic-error", "color.semantic.error"],
    ["color.on-semantic-info", "color.semantic.info"],
  ] as const;

  for (const mode of ["light", "dark"]) {
    for (const [ink, fill] of pairs) {
      const ratio = contrastRatio(
        valueInMode(tree, mode, ink),
        valueInMode(tree, mode, fill),
      );
      assert(
        ratio >= 4.5,
        `${mode} ${ink} on ${fill} is ${ratio.toFixed(2)}:1, below 4.5:1`,
      );
    }
  }
});

Deno.test("the spin theme's text and its link read on the page, in both modes", () => {
  // The page is the surface everything is read against, and the link is the
  // one colour in running text: a link nobody can read is a page that lies.
  const tree = spinTree();
  for (const mode of ["light", "dark"]) {
    for (
      const [ink, surface] of [
        ["color.text", "color.surface"],
        ["color.text", "color.surface-raised"],
        ["color.text-muted", "color.surface"],
        ["color.link", "color.surface"],
      ] as const
    ) {
      const ratio = contrastRatio(
        valueInMode(tree, mode, ink),
        valueInMode(tree, mode, surface),
      );
      assert(
        ratio >= 4.5,
        `${mode} ${ink} on ${surface} is ${ratio.toFixed(2)}:1, below 4.5:1`,
      );
    }
  }
});

Deno.test("the spin theme separates with rules, and cuts only its overlays", () => {
  // The depth ladder is flat: a card rests on the page with no shadow at all,
  // and only an overlay is cut out of the sheet — a hard offset with no blur.
  // A blurred shadow anywhere in the theme would be a lit surface, which is
  // the one thing this theme does not do.
  const tree = spinTree();
  const shadows = ["shadow.sm", "shadow.md", "shadow.lg"] as const;

  for (const mode of ["light", "dark"]) {
    const values = shadows.map((path) => valueInMode(tree, mode, path));
    for (const value of values) {
      assertEquals(
        shadowParts(value).blur,
        0,
        `${mode}: "${value}" is blurred, and this theme is drawn rather than lit`,
      );
    }
    const weights = values.map(shadowWeight);
    assertEquals(
      weights[0],
      0,
      `${mode}: the resting step must carry no elevation`,
    );
    assertEquals(
      weights[1],
      0,
      `${mode}: the middle step must carry no elevation`,
    );
    assert(
      weights[2]! > 0,
      `${mode}: the floating step must be cut out of the sheet`,
    );
    assert(
      shadowParts(values[2]!).offset > 0,
      `${mode}: the cut-out must move the sheet, not merely shadow it`,
    );
  }
});

Deno.test("the spin theme's button rests flat and is cut loose when it is touched", () => {
  // The button's character: a printed caption on a block of ink, flat at rest
  // and lifted by a hard offset on hover — drawn, not lit.
  const tree = spinTree();
  for (const mode of ["light", "dark"]) {
    const rest = valueInMode(tree, mode, "button.shadow");
    assertEquals(
      shadowWeight(rest),
      0,
      `${mode}: a button at rest must sit on the page, not above it`,
    );
    const hover = valueInMode(tree, mode, "button.shadow-hover");
    assertEquals(
      shadowParts(hover).blur,
      0,
      `${mode}: the hover lift must be hard, not blurred`,
    );
    assert(
      shadowWeight(hover) > shadowWeight(rest),
      `${mode}: touching a button must lift it`,
    );
  }
});

Deno.test("the spin theme's type scale ends in a display step that is a scale, not a size", () => {
  // A headline reads as a headline because of the jump: the top step is
  // several times the body, and the step is named for the job it does.
  const tree = spinTree();
  const sizes = indexTree(resolveAliases(tree).tree).leaves;
  const steps = Object.keys(sizes)
    .filter((path) => path.startsWith("font.size."))
    .map((path) => ({
      path,
      rem: Number(String(sizes[path]?.value).replace("rem", "")),
    }))
    .sort((a, b) => a.rem - b.rem);

  assert(steps.length > 1, "the theme must declare a scale");
  for (let i = 1; i < steps.length; i++) {
    assert(
      steps[i - 1]!.rem < steps[i]!.rem,
      `${steps[i - 1]!.path} must be smaller than ${steps[i]!.path}`,
    );
  }
  const top = steps[steps.length - 1]!;
  assertEquals(
    top.path,
    "font.size.display",
    "the top of the scale is the poster",
  );
  const body = steps.find((step) => step.path === "font.size.md");
  assert(body !== undefined, "the scale must have a body step");
  assert(
    top.rem / body.rem >= 3,
    `the display step is ${top.rem}rem against a ${body.rem}rem body: a jump of ${
      (top.rem / body.rem).toFixed(2)
    }× is not a scale`,
  );
});
