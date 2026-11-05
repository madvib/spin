import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  contrastRatio,
  cssVarName,
  generateCss,
  generateThemeCss,
  generateTypes,
  inkTokens,
  legibilityFloors,
  parseTokens,
  requiredPaths,
  scaffoldTheme,
  themeGates,
  validateTokens,
} from "../../src/theme/index.ts";
import type {
  ParseResult,
  ThemeDocument,
  TokenLeaf,
  TokenNode,
  TokenTree,
} from "../../src/theme/index.ts";
import {
  type StarterThemeName,
  starterThemes,
  themeModes,
} from "../../src/theme/themes/index.ts";

/**
 * The battery, run over the themes this package ships — and over a theme a
 * PROJECT ships, which is the one the skill tells an author to write.
 *
 * A starter is what a consumer copies, so what matters here is not that its
 * particular hexes are pleasant but that the shape a real theme has survives
 * the pipeline end to end: two files parse, both validate, one stylesheet
 * comes out with a light block and a dark block, and a dark-mode consumer
 * reads different colors and the same spacing.
 *
 * The battery itself lives in the package (`themeGates`), because it has to
 * run against ANY document — a starter, a project's own theme, a file an
 * author is halfway through. A battery that only runs against the shipped
 * starters cannot answer the question the skill asks: "does MY theme pass?".
 */

// The SHIPPED starter themes, not fixtures: these are the product, and
// a consumer picks one and customises it rather than writing a theme
// from scratch.
const THEMES_DIR = new URL("../../src/theme/themes/", import.meta.url);

/** Unwraps a successful parse, failing loudly when the file was rejected. */
function treeOf(result: ParseResult, source: string): TokenTree {
  if (!result.ok) {
    throw new Error(`${source} did not parse: ${result.error}`);
  }
  return result.tree;
}

interface CssBlock {
  selector: string;
  declarations: Record<string, string>;
}

/**
 * Splits flat generated CSS into selector -> custom-property pairs, so
 * assertions target individual declarations instead of exact output text.
 */
function blocks(css: string): CssBlock[] {
  const found: CssBlock[] = [];
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations: Record<string, string> = {};
    for (
      const [, property, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)
    ) {
      declarations[property.trim()] = value.trim();
    }
    found.push({ selector: selector.trim(), declarations });
  }
  return found;
}

function blockWithSelector(css: string, selector: string): CssBlock {
  const found = blocks(css).find((block) => block.selector === selector);
  if (found === undefined) {
    throw new Error(
      `no block for selector "${selector}"; emitted: ${
        blocks(css).map((b) => b.selector).join(" | ")
      }`,
    );
  }
  return found;
}

/**
 * The custom properties a consumer actually reads in one mode: everything the
 * base block declares, with the dark block layered on top for dark mode. This
 * is the browser's own layering, not a reconstruction of it.
 */
function varsInMode(
  css: string,
  mode: "light" | "dark",
): Record<string, string> {
  const base = blockWithSelector(css, ":root").declarations;
  if (mode === "light") return { ...base };
  return {
    ...base,
    ...blockWithSelector(css, ':root[data-mode="dark"]').declarations,
  };
}

/** Follows `var(--x)` chains to a literal, the way a browser resolves them. */
function resolve(vars: Record<string, string>, name: string): string {
  let value = vars[name];
  if (value === undefined) throw new Error(`no value for ${name}`);
  for (let hop = 0; hop < 10; hop++) {
    const reference = /^var\((--[\w-]+)\)$/.exec(value);
    if (reference === null) return value;
    const next = vars[reference[1] as string];
    if (next === undefined) {
      throw new Error(`${name} points at undeclared ${reference[1]}`);
    }
    value = next;
  }
  throw new Error(`${name} did not resolve to a literal value`);
}

/** A length in `rem`/`px` as a plain number, so scales can be compared. */
function toNumber(value: string): number {
  const match = /^(-?\d*\.?\d+)(?:rem|px|em)?$/.exec(value.trim());
  if (match === null) throw new Error(`not a length: ${JSON.stringify(value)}`);
  return Number(match[1]);
}

/** Ordered numbers must already be ascending, naming the offender when not. */
function assertAscending(values: number[], label: string): void {
  for (let i = 1; i < values.length; i++) {
    assert(
      values[i - 1]! < values[i]!,
      `${label}: ${values[i - 1]} must be below ${values[i]} (index ${i})`,
    );
  }
}

/**
 * The token paths the example theme promises to define, grouped the way a
 * consumer reaches for them.
 */
const REQUIRED = [
  "color",
  "color.primary",
  "color.secondary",
  "color.accent",
  "color.neutral.50",
  "color.neutral.900",
  "color.semantic.success",
  "color.semantic.warning",
  "color.semantic.error",
  "color.semantic.info",
  "spacing.0",
  "spacing.1",
  "spacing.2",
  "spacing.4",
  "spacing.8",
  "spacing.16",
  "font.family.sans",
  "font.family.serif",
  "font.family.mono",
  "font.size.md",
  "font.weight.regular",
  "font.weight.bold",
  "radius.none",
  "radius.sm",
  "radius.md",
  "radius.lg",
  "radius.full",
  "shadow.sm",
  "shadow.md",
  "shadow.lg",
  "breakpoint.sm",
  "breakpoint.md",
  "breakpoint.lg",
  "breakpoint.xl",
  "z-index.base",
  "z-index.dropdown",
  "z-index.modal",
  "z-index.toast",
  "motion.duration.base",
  "motion.easing.standard",
  "color.on-primary",
  "color.on-semantic-error",
  "color.focus-ring",
  // The button owns component tokens for what only a control decides: its
  // elevations. Its type is the label style's business, so no type atom is
  // promised here. Everything else it reads is a scale step, listed above.
  "button.shadow",
  "button.shadow-hover",
  "focus.width",
  "focus.offset",
  "border.width",
  "color.link",
];

test("the ink a theme declares is read from the theme itself", () => {
  // The pairing is a fact about the theme, not a convention a consumer
  // invents: every fill with a contrast floor names its own foreground, and
  // `inkTokens()` answers "which ink goes on this fill?" from those floors.
  const inks = inkTokens();
  assert(inks.includes("on-primary"), "the primary pairs with its own ink");
  assert(
    inks.includes("on-semantic-error"),
    "the error fill pairs with its own ink",
  );
  for (const ink of inks) {
    assert(
      ink.startsWith("on-"),
      `an ink token is named for the fill it sits on: ${ink}`,
    );
  }
});

test("the example theme's light document parses into a token tree", async () => {
  const source = await readFile(new URL("silk.json", THEMES_DIR), "utf8");
  const tree = treeOf(parseTokens(source), "silk.json");

  // The groups the theme MUST have, not every group it happens to have. An
  // exact list makes adding a legitimate group an edit to this file, and the
  // edit pressure is a reason to never add one — which is the opposite of
  // what a fixture should do. The scale groups and the per-component groups
  // are both required, because dropping either is a real defect; an extra one
  // is a theme choosing to state something more, which is its own privilege.
  const present = new Set(tree.map((node) => node.path.join(".")));
  for (
    const group of [
      "color",
      "spacing",
      "font",
      "radius",
      "shadow",
      "breakpoint",
      "z-index",
      "motion",
      // Shared scales every control reads, stated once rather than per
      // component.
      "border",
      "focus",
    ]
  ) {
    assert(
      present.has(group),
      `the example theme must state the \`${group}\` group`,
    );
  }
  // Components own their own tokens; each is a group named after the
  // component.
  for (
    const component of ["button", "icon", "checkbox", "switch"]
  ) {
    assert(
      present.has(component),
      `the example theme must state \`${component}\` component tokens`,
    );
  }
});

/**
 * Every leaf in a subtree, depth-first.
 *
 * The dark side is no longer a group of its own: it lives on each token as
 * `$modes.dark`, so "what does dark change?" is a question about the leaves
 * rather than about a second tree.
 */
function leavesOf(node: TokenNode): TokenLeaf[] {
  if (node.kind === "token") return [node];
  return node.children.flatMap(leavesOf);
}

test("the baseline theme carries a dark MODE rather than being a second theme", async () => {
  // `light` and `dark` are two modes of ONE theme. There is no theme named
  // `light` and no document named `dark` — the dark side lives on the tokens
  // themselves as `$modes.dark`, which `generateCss` scopes to
  // `[data-theme="<name>"][data-mode="dark"]`.
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );

  // The dark side restates colours and the focus ring; metrics are inherited,
  // because a mode says what CHANGES. The set of groups that vary is closed,
  // so the paths carrying a dark value are exactly color and focus.
  const varying = new Set<string>();
  for (const node of tree) {
    for (const leaf of leavesOf(node)) {
      if (leaf.modes !== undefined) varying.add(leaf.path[0] as string);
    }
  }
  deepStrictEqual([...varying].sort(), ["color", "focus"]);
});

test("the example theme defines every token path it advertises", async () => {
  const theme = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const report = validateTokens(theme, { required: REQUIRED });

  deepStrictEqual(report.issues, []);
  assert(report.valid);
});

test("the example theme's light document validates on its own", async () => {
  const source = await readFile(new URL("silk.json", THEMES_DIR), "utf8");
  const light = treeOf(parseTokens(source), "silk.json");

  deepStrictEqual(validateTokens(light).issues, []);
});

/**
 * What each starter serves, as a fixture decision.
 *
 * `satisfies` against the registry's own key type is the totality audit: a
 * starter added to the package cannot compile until its mode posture is
 * written down here, so this list can never quietly skip a theme.
 */
const DECLARED_MODES = {
  silk: ["light", "dark"],
  spin: ["light", "dark"],
  material: ["light", "dark"],
  neobrut: ["light", "dark"],
  industrial: ["light", "dark"],
} satisfies Record<StarterThemeName, readonly ("light" | "dark")[]>;

test("a theme states its modes at the root", async () => {
  // The modes are data, not derived from a group's presence: neobrut and
  // console have no `dark` group but different mode postures, and asking "does
  // this theme carry a dark override set?" cannot tell a base-that-is-dark
  // from a theme that never declares one. `modes` says what it serves.
  for (const [name, modes] of Object.entries(DECLARED_MODES)) {
    const doc = JSON.parse(
      await readFile(new URL(`${name}.json`, THEMES_DIR), "utf8"),
    );
    deepStrictEqual(
      doc.modes,
      modes,
      `${name}: root modes must say what it serves`,
    );
  }
});

test("a theme that serves a mode it does not override is valid", async () => {
  // The root `modes` says what a theme SERVES, and a mode it serves but
  // does not override falls back to the base values. So a theme that serves
  // dark and restates nothing is a complete theme, not a half-dark one —
  // which is exactly what a dark-only theme with a dark base is.
  //
  // The rule that follows from the claim is the other direction: a value
  // written for a mode the theme does not serve is never shown, and the
  // validator reports it.
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  deepStrictEqual(validateTokens(tree, { modes: ["light", "dark"] }).issues, []);

  const darkOnlyDoc = structuredClone(
    JSON.parse(await readFile(new URL("industrial.json", THEMES_DIR), "utf8")),
  ) as Record<string, unknown>;
  for (const group of Object.values(darkOnlyDoc)) {
    if (group && typeof group === "object") {
      for (const leaf of Object.values(group as Record<string, unknown>)) {
        if (leaf && typeof leaf === "object") delete (leaf as Record<string, unknown>)["$modes"];
      }
    }
  }
  darkOnlyDoc["modes"] = ["dark"];
  const darkless = treeOf(parseTokens(darkOnlyDoc), "industrial.json");
  deepStrictEqual(validateTokens(darkless, { modes: ["dark"] }).issues, []);
});

test("a theme declares the modes it actually has", async () => {
  // Not "every starter carries a dark group" — that was the wrong property,
  // and it was wrong for console, whose BASE is already dark: a terminal
  // palette has no light mode, and generating a `dark` group from its own
  // base restated it and added nothing.
  //
  // The set of modes a theme reports is what it DECLARES at its root, so a
  // theme that drops the field answers nothing rather than answering from a
  // group's presence — and adding a mode is a change to the theme document,
  // which is the one file a theme owns.
  for (const [name, modes] of Object.entries(DECLARED_MODES)) {
    const doc = JSON.parse(
      await readFile(new URL(`${name}.json`, THEMES_DIR), "utf8"),
    );
    deepStrictEqual(
      [...themeModes(doc as ThemeDocument)],
      modes,
      `${name}: the reported modes must follow from its root field`,
    );
  }
});

test("the example theme's stylesheet is a light block and a dark block", async () => {
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  // The NAMED path, which is what a consumer calls. It scopes a theme's dark
  // mode to `[data-theme=<name>][data-mode="dark"]` — so the mode belongs to
  // its theme, and two themes can each carry a dark mode without fighting.
  const css = generateThemeCss({ silk: tree });

  deepStrictEqual(
    blocks(css).map((block) => block.selector),
    ['[data-theme="silk"]', '[data-theme="silk"][data-mode="dark"]'],
  );
});

test("the light block of the example theme carries the light document's values", async () => {
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const root = blockWithSelector(generateCss(tree), ":root");

  deepStrictEqual(root.declarations["--color-primary"], "#1c62c2");
  deepStrictEqual(root.declarations["--color-secondary"], "#1a2434");
  deepStrictEqual(root.declarations["--color-accent"], "#006974");
  deepStrictEqual(root.declarations["--color-semantic-error"], "#a6312b");
  deepStrictEqual(root.declarations["--spacing-4"], "1rem");
  deepStrictEqual(
    root.declarations["--font-family-sans"],
    "Inter, ui-sans-serif, system-ui, sans-serif",
  );
  deepStrictEqual(root.declarations["--font-size-md"], "1rem");
  deepStrictEqual(root.declarations["--font-weight-bold"], "700");
  deepStrictEqual(root.declarations["--radius-full"], "9999px");
  deepStrictEqual(root.declarations["--breakpoint-lg"], "64rem");
  deepStrictEqual(root.declarations["--z-index-modal"], "2000");
  deepStrictEqual(root.declarations["--motion-duration-base"], "250ms");
  deepStrictEqual(
    root.declarations["--motion-easing-standard"],
    "cubic-bezier(0.2, 0, 0, 1)",
  );
});

test("every dark declaration lands on a property the light theme declares", async () => {
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const css = generateCss(tree);
  const lightVars = varsInMode(css, "light");
  const darkBlock = blockWithSelector(css, ':root[data-mode="dark"]');

  const names = Object.keys(darkBlock.declarations);
  assert(names.length > 0);
  for (const name of names) {
    assert(
      lightVars[name] !== undefined,
      `${name} is declared only in dark mode, so it is a new token, not an override`,
    );
  }
});

test("the dark block emits every token the dark document declares", async () => {
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const css = generateCss(tree);
  const darkBlock = blockWithSelector(css, ':root[data-mode="dark"]');
  // Every leaf the document gives a dark value, whatever spelling it uses:
  // a `$modes.dark` entry on the token, which is the spelling the shipped
  // themes now carry.
  const declared = tree.flatMap(leavesOf).flatMap((leaf) =>
    leaf.modes !== undefined && "dark" in leaf.modes
      ? [cssVarName(leaf.path)]
      : []
  );
  for (const name of declared) {
    assert(
      name in darkBlock.declarations,
      `${name} is declared by the dark document but missing from its block`,
    );
  }
  deepStrictEqual(
    Object.keys(darkBlock.declarations).sort(),
    [...declared].sort(),
  );
});

test("a dark-mode consumer reads the dark document's colors", async () => {
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const vars = varsInMode(generateCss(tree), "dark");

  deepStrictEqual(vars["--color-primary"], "#8db9fa");
  deepStrictEqual(vars["--color-secondary"], "#dadee5");
  deepStrictEqual(vars["--color-accent"], "#71c7d1");
  deepStrictEqual(vars["--color-semantic-success"], "#72cf88");
  deepStrictEqual(vars["--color-semantic-error"], "#f38277");
  deepStrictEqual(vars["--color-surface-raised"], "#18202a");
});

test("roles that reference the neutral ramp follow it into dark mode", async () => {
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const css = generateCss(tree);
  const lightVars = varsInMode(css, "light");
  const darkVars = varsInMode(css, "dark");

  // A surface is a reference, not a value, so the dark document never restates
  // it. Restating it is exactly what would let the two modes drift apart.
  deepStrictEqual(lightVars["--color-surface"], "var(--color-neutral-50)");
  deepStrictEqual(lightVars["--color-text"], "var(--color-neutral-900)");
  deepStrictEqual(lightVars["--color-border"], "var(--color-neutral-200)");

  deepStrictEqual(resolve(lightVars, "--color-surface"), "#f7f8fb");
  deepStrictEqual(resolve(darkVars, "--color-surface"), "#0d121a");
  deepStrictEqual(resolve(lightVars, "--color-text"), "#050d1c");
  deepStrictEqual(resolve(darkVars, "--color-text"), "#f3f5f8");
  deepStrictEqual(resolve(lightVars, "--color-border"), "#e4e8ef");
  deepStrictEqual(resolve(darkVars, "--color-border"), "#1d242f");
});

test("spacing, typography and layering are the same scale in both modes", async () => {
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const css = generateCss(tree);
  const lightVars = varsInMode(css, "light");
  const darkVars = varsInMode(css, "dark");

  for (const step of ["0", "1", "2", "4", "8", "16"]) {
    deepStrictEqual(darkVars[`--spacing-${step}`], lightVars[`--spacing-${step}`]);
  }
  for (const layer of ["base", "dropdown", "modal", "toast"]) {
    deepStrictEqual(
      darkVars[`--z-index-${layer}`],
      lightVars[`--z-index-${layer}`],
    );
  }
  deepStrictEqual(darkVars["--spacing-4"], "1rem");
  deepStrictEqual(darkVars["--radius-md"], "0.5rem");
  deepStrictEqual(darkVars["--z-index-toast"], "3000");
  deepStrictEqual(darkVars["--font-weight-semibold"], "600");
  deepStrictEqual(darkVars["--breakpoint-xl"], "80rem");
  deepStrictEqual(
    darkVars["--shadow-lg"],
    "0 16px 40px -8px rgb(15 19 30 / 0.16), 0 4px 12px -4px rgb(15 19 30 / 0.08)",
  );
  deepStrictEqual(
    darkVars["--motion-easing-decelerate"],
    "cubic-bezier(0, 0, 0, 1)",
  );
});

test("the example theme's spacing scale grows with its step number", async () => {
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const vars = varsInMode(generateCss(tree), "light");

  assertAscending(
    ["0", "1", "2", "4", "8", "16"].map((step) =>
      toNumber(vars[`--spacing-${step}`] as string)
    ),
    "spacing",
  );
});

test("the example theme's radii round off from square to fully round", async () => {
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const vars = varsInMode(generateCss(tree), "light");

  assertAscending(
    ["none", "sm", "md", "lg", "full"].map((name) =>
      toNumber(vars[`--radius-${name}`] as string)
    ),
    "radius",
  );
});

test("the example theme's breakpoints and z-index layers are ordered", async () => {
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const vars = varsInMode(generateCss(tree), "light");

  assertAscending(
    ["sm", "md", "lg", "xl"].map((name) =>
      toNumber(vars[`--breakpoint-${name}`] as string)
    ),
    "breakpoint",
  );
  assertAscending(
    ["base", "dropdown", "modal", "toast"].map((name) =>
      Number(vars[`--z-index-${name}`])
    ),
    "z-index",
  );
  deepStrictEqual(Number(vars["--z-index-base"]), 0);
});

test("the example theme's text is legible on its own surfaces in both modes", async () => {
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const css = generateCss(tree);

  for (const mode of ["light", "dark"] as const) {
    const vars = varsInMode(css, mode);
    for (const role of ["--color-text", "--color-text-muted"]) {
      for (const background of ["--color-surface", "--color-surface-raised"]) {
        const ratio = contrastRatio(
          resolve(vars, role),
          resolve(vars, background),
        );
        assert(
          ratio >= 4.5,
          `${mode} ${role} on ${background} is ${
            ratio.toFixed(2)
          }:1, below 4.5:1`,
        );
      }
    }
  }
});

test("the example theme's status colors are legible in both modes", async () => {
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const css = generateCss(tree);

  for (const mode of ["light", "dark"] as const) {
    const vars = varsInMode(css, mode);
    const surface = resolve(vars, "--color-surface");
    for (const name of ["success", "warning", "error", "info"]) {
      const ratio = contrastRatio(
        vars[`--color-semantic-${name}`] as string,
        surface,
      );
      assert(
        ratio >= 4.5,
        `${mode} semantic.${name} on the surface is ${
          ratio.toFixed(2)
        }:1, below 4.5:1`,
      );
    }
  }
});

/**
 * Every tone fill+on pair per shipped theme per mode meets 4.5:1.
 *
 * A fill with no legible foreground is a button you cannot read. Each
 * tone-* variant is checked against its own on-* foreground in every
 * mode the theme ships. Neutral/text pairs are skipped: their fill is a
 * surface, and text-on-surface legibility is covered by the text floors
 * test above.
 */
test("every tone fill+on pair meets 4.5:1 in every shipped theme and mode", async () => {
  const pairs = [
    ["--color-primary", "--color-on-primary"],
    ["--color-secondary", "--color-on-secondary"],
    ["--color-accent", "--color-on-accent"],
    ["--color-semantic-success", "--color-on-semantic-success"],
    ["--color-semantic-warning", "--color-on-semantic-warning"],
    ["--color-semantic-error", "--color-on-semantic-error"],
  ] as const;

  for (const name of Object.keys(starterThemes) as StarterThemeName[]) {
    const tree = treeOf(
      parseTokens(await readFile(new URL(`${name}.json`, THEMES_DIR), "utf8")),
      `${name}.json`,
    );
    const css = generateCss(tree);
    const hasDark = tree.find((node) =>
      node.path.join(".") === "dark"
    ) !== undefined;
    const modes = hasDark ? ["light", "dark"] as const : ["light"] as const;

    for (const mode of modes) {
      const vars = varsInMode(css, mode);
      for (const [fill, fg] of pairs) {
        const ratio = contrastRatio(
          resolve(vars, fill),
          resolve(vars, fg),
        );
        assert(
          ratio >= 4.5,
          `${name} ${mode} ${fill} on ${fg} is ${
            ratio.toFixed(2)
          }:1, below 4.5:1`,
        );
      }
    }
  }
});

test("the example theme is addressable as the named 'silk' theme", async () => {
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const css = generateThemeCss({ silk: tree });

  deepStrictEqual(
    blocks(css).map((block) => block.selector),
    ['[data-theme="silk"]', '[data-theme="silk"][data-mode="dark"]'],
  );
  deepStrictEqual(
    blockWithSelector(
      css,
      '[data-theme="silk"]',
    ).declarations["--color-primary"],
    "#1c62c2",
  );
  deepStrictEqual(
    blockWithSelector(
      css,
      '[data-theme="silk"][data-mode="dark"]',
    ).declarations["--color-primary"],
    "#8db9fa",
  );
});

test("the checked-in token types are what the baseline generates", async () => {
  // `theme-types.d.ts` is a generated artifact: it says which tokens the
  // baseline carries, and a component that spends a token the artifact does
  // not name does not compile. Drift therefore surfaces as a compile error in
  // someone else's checkout, so the freshness check lives here with the theme
  // that generates it.
  const tree = treeOf(
    parseTokens(await readFile(new URL("silk.json", THEMES_DIR), "utf8")),
    "silk.json",
  );
  const checkedIn = await readFile(
    new URL("../../src/theme/theme-types.d.ts", import.meta.url),
    "utf8",
  );
  deepStrictEqual(
    checkedIn,
    generateTypes(tree),
    "run `deno task types` in packages/theme to regenerate",
  );
});

/* ------------------------------------------------------------- the battery -- */

/**
 * The battery, over every starter this package ships.
 *
 * The starters are the product, so they are held to the same gates a
 * project's own theme is: the completeness of the document, the floors in
 * every mode it serves, the ladders, the loop, and the modes.
 */
test("every starter passes the battery", async () => {
  for (const name of Object.keys(starterThemes) as StarterThemeName[]) {
    const text = await readFile(
      new URL(`${name}.json`, THEMES_DIR),
      "utf8",
    );
    const report = themeGates(text);
    deepStrictEqual(
      report.issues.map((issue) => `${issue.path}: ${issue.message}`),
      [],
      `${name} does not pass the battery`,
    );
    assert(report.valid);
  }
});

/**
 * A PROJECT's theme: a document written for a product, not for the package.
 *
 * It is built from a starter because that is how a project usually starts —
 * a fork — and then broken in the ways a theme breaks: an unreadable badge, a
 * ladder that descends, a loop under the strobe floor, a dark mode that
 * restates nothing, ink that cannot be read on a raised sheet, a fill with no
 * ink of its own, a status colour that is a word nobody can read, and a dark
 * mode that restates the spacing.
 */
function projectTheme(
  broken:
    | "badge"
    | "ladder"
    | "loop"
    | "mode"
    | "raised"
    | "ink"
    | "status"
    | "scale"
    | "none",
): string {
  const doc = JSON.parse(
    JSON.stringify(starterThemes.silk),
  ) as Record<string, unknown>;
  const color = doc["color"] as Record<string, unknown>;
  const spacing = doc["spacing"] as Record<string, unknown>;
  const motion = doc["motion"] as Record<string, unknown>;
  const duration = motion["duration"] as Record<string, unknown>;

  if (broken === "badge") {
    // White on a pale amber: the ink nobody chose, on a fill nobody checked.
    color["on-semantic-warning"] = {
      $type: "color",
      $value: "#f7f8fb",
    };
  }
  if (broken === "ladder") {
    // The fourth step smaller than the second: a scale with no shape.
    spacing["4"] = { $type: "dimension", $value: "0.125rem" };
  }
  if (broken === "loop") {
    duration["loop"] = { $type: "duration", $value: "120ms" };
  }
  if (broken === "raised") {
    // A raised sheet darker than the page: the ink holds on the page and
    // nowhere else.
    color["surface-raised"] = { $type: "color", $value: "#555555" };
  }
  if (broken === "ink") {
    // The secondary fill with its own ink on it: a badge with a word in it.
    color["on-secondary"] = { $type: "color", $value: "#1a2434" };
  }
  if (broken === "status") {
    // A status colour worn as ink on the page, and too pale to read.
    (color["semantic"] as Record<string, unknown>)["success"] = {
      $type: "color",
      $value: "#b8f0c6",
    };
  }
  if (broken === "scale") {
    // A dark mode with its own spacing: a second set of decisions that the
    // scales gate never measured.
    spacing["4"] = {
      $type: "dimension",
      $value: "1rem",
      $modes: { dark: "1.5rem" },
    };
  }
  if (broken === "mode") {
    // A theme that serves a dark mode and restates nothing for it: every
    // override goes, so the dark rendering is the light rendering.
    stripModes(doc);
  }
  return JSON.stringify(doc);
}

/** Every mode override in a document, removed. */
function stripModes(node: unknown): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const entry of node) stripModes(entry);
    return;
  }
  const record = node as Record<string, unknown>;
  delete record["$modes"];
  for (const value of Object.values(record)) stripModes(value);
}

test("the battery catches a project theme's unreadable badge", () => {
  const report = themeGates(projectTheme("badge"));
  const legibility = report.gates.find((gate) => gate.gate === "legibility");
  assert(
    legibility?.issues.some((issue) =>
      issue.path === "color.on-semantic-warning" &&
      issue.message.includes("4.5:1")
    ),
    `the unreadable badge is not reported: ${JSON.stringify(report.issues)}`,
  );
});

test("the battery catches a project theme's descending ladder", () => {
  const report = themeGates(projectTheme("ladder"));
  const scales = report.gates.find((gate) => gate.gate === "scales");
  assert(
    scales?.issues.some((issue) =>
      issue.path === "spacing.4" && issue.message.includes("descends")
    ),
    `the descending ladder is not reported: ${JSON.stringify(report.issues)}`,
  );
});

test("the battery catches a project theme's strobe", () => {
  const report = themeGates(projectTheme("loop"));
  const motion = report.gates.find((gate) => gate.gate === "motion");
  assert(
    motion?.issues.some((issue) =>
      issue.path === "motion.duration.loop" && issue.message.includes("strobe")
    ),
    `the strobe is not reported: ${JSON.stringify(report.issues)}`,
  );
});

test("the battery catches a project theme's dark mode that restates nothing", () => {
  const report = themeGates(projectTheme("mode"));
  const modes = report.gates.find((gate) => gate.gate === "modes");
  assert(
    modes?.issues.some((issue) => issue.message.includes("restates nothing")),
    `the mode that restates nothing is not reported: ${
      JSON.stringify(report.issues)
    }`,
  );
});

test("the battery catches text that cannot be read on a raised sheet", () => {
  // The page and the sheet above it are two surfaces, and the ink owes the
  // floor on both: a card the reader cannot read is a card nobody reads.
  const report = themeGates(projectTheme("raised"));
  const legibility = report.gates.find((gate) => gate.gate === "legibility");
  assert(
    legibility?.issues.some((issue) =>
      issue.path === "color.text" &&
      issue.message.includes("surface-raised") &&
      issue.message.includes("4.5:1")
    ),
    `the unreadable sheet is not reported: ${JSON.stringify(report.issues)}`,
  );
});

test("the battery catches a fill with no ink of its own", () => {
  // The badge spends the secondary fill as a pill with a word on it, so the
  // ink on it is a floor and not a habit.
  const report = themeGates(projectTheme("ink"));
  const legibility = report.gates.find((gate) => gate.gate === "legibility");
  assert(
    legibility?.issues.some((issue) =>
      issue.path === "color.on-secondary" &&
      issue.message.includes("4.5:1")
    ),
    `the fill with no ink is not reported: ${JSON.stringify(report.issues)}`,
  );
});

test("the battery catches a status colour nobody can read", () => {
  // A status colour is worn as ink on the page as often as it is worn as a
  // fill, so it owes the text floor.
  const report = themeGates(projectTheme("status"));
  const legibility = report.gates.find((gate) => gate.gate === "legibility");
  assert(
    legibility?.issues.some((issue) =>
      issue.path === "color.semantic.success" &&
      issue.message.includes("4.5:1")
    ),
    `the unreadable status colour is not reported: ${
      JSON.stringify(report.issues)
    }`,
  );
});

test("the battery catches a mode that restates the spacing", () => {
  // The scales are judged once, on the base document, so a dark mode with
  // its own spacing is a second set of decisions nobody measured.
  const report = themeGates(projectTheme("scale"));
  const invariance = report.gates.find((gate) => gate.gate === "invariance");
  assert(
    invariance?.issues.some((issue) =>
      issue.path === "spacing.4" &&
      issue.message.includes("ink and focus")
    ),
    `the restated spacing is not reported: ${JSON.stringify(report.issues)}`,
  );
});

test("a project theme that breaks nothing passes the battery", () => {
  const report = themeGates(projectTheme("none"));
  deepStrictEqual(
    report.issues.map((issue) => `${issue.path}: ${issue.message}`),
    [],
  );
  assert(report.valid);
});

test("the body ink owes a floor on the page and on the sheet above it", () => {
  // Two surfaces, two floors: a card is a surface the reader reads on, and
  // the ink that holds on the page has to hold there too.
  const floors = legibilityFloors();
  deepStrictEqual(
    floors.find((floor) =>
      floor.fg === "color.text" && floor.bg === "color.surface"
    ),
    { fg: "color.text", bg: "color.surface", min: 4.5 },
  );
  deepStrictEqual(
    floors.find((floor) =>
      floor.fg === "color.text" && floor.bg === "color.surface-raised"
    ),
    { fg: "color.text", bg: "color.surface-raised", min: 4.5 },
  );
});

test("a status colour owes the text floor on the page", () => {
  // A status colour is worn as ink on the page as often as it is worn as a
  // fill, so it owes four and a half to one rather than the non-text three.
  for (const name of ["success", "warning", "error", "info"]) {
    deepStrictEqual(
      legibilityFloors().find((floor) => floor.fg === `color.semantic.${name}`),
      { fg: `color.semantic.${name}`, bg: "color.surface", min: 4.5 },
    );
  }
});

test("the ink on the secondary and the accent fill is a role the contract asks for", () => {
  // The badge spends the secondary and the accent tones as filled pills with
  // a word on them, so the ink on them is a role with a floor — like the ink
  // on the primary — and a scaffold writes it.
  const paths = requiredPaths();
  assert(paths.includes("color.on-secondary"), "the secondary fill has an ink");
  assert(paths.includes("color.on-accent"), "the accent fill has an ink");
  const floors = legibilityFloors();
  deepStrictEqual(
    floors.find((floor) => floor.fg === "color.on-secondary"),
    { fg: "color.on-secondary", bg: "color.secondary", min: 4.5 },
  );
  deepStrictEqual(
    floors.find((floor) => floor.fg === "color.on-accent"),
    { fg: "color.on-accent", bg: "color.accent", min: 4.5 },
  );
  const scaffolded = new Set(
    scaffoldTheme()
      .flatMap((node) => leavesOf(node))
      .map((leaf) => leaf.path.join(".")),
  );
  assert(
    scaffolded.has("color.on-secondary"),
    "the scaffold writes the ink on the secondary fill",
  );
  assert(
    scaffolded.has("color.on-accent"),
    "the scaffold writes the ink on the accent fill",
  );
});

test("@spinjs/spin/theme re-exports starterThemes and individual starters", async () => {
  const rootExports = await import("../../src/theme/index.ts");
  const subpathExports = await import("../../src/theme/themes/index.ts");
  assert.strictEqual(rootExports.starterThemes, subpathExports.starterThemes);
  assert.strictEqual(rootExports.starterGroups, subpathExports.starterGroups);
  assert.strictEqual(rootExports.spinTheme, subpathExports.spinTheme);
  assert.strictEqual(rootExports.silkTheme, subpathExports.silkTheme);
  assert.strictEqual(rootExports.materialTheme, subpathExports.materialTheme);
  assert.strictEqual(rootExports.neobrutTheme, subpathExports.neobrutTheme);
  assert.strictEqual(rootExports.industrialTheme, subpathExports.industrialTheme);
});
