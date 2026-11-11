import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { generateCss, generateThemeCss, generateTypes } from "./generate.ts";
import { parseTokens } from "./parse.ts";
import { catppuccinPalette, compactSpacing, minimalTheme, starterThemes } from "../themes/index.ts";
import type { TokenTree } from "./types.ts";

interface CssBlock {
  selector: string;
  declarations: Record<string, string>;
}

/** The parsed tree of a token document, asserted to have parsed. */
function treeOf(result: ReturnType<typeof parseTokens>): TokenTree {
  if (!result.ok) throw new Error(`document must parse: ${result.error}`);
  return result.tree;
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
  if (!found) {
    throw new Error(
      `no block for selector "${selector}"; emitted: ${
        blocks(css).map((b) => b.selector).join(" | ")
      }`,
    );
  }
  return found;
}

function blockMentioning(css: string, needle: string): CssBlock {
  const found = blocks(css).find((block) => block.selector.includes(needle));
  if (!found) {
    throw new Error(
      `no block mentioning "${needle}"; emitted: ${
        blocks(css).map((b) => b.selector).join(" | ")
      }`,
    );
  }
  return found;
}

const LIGHT: TokenTree = [
  {
    kind: "group",
    name: "color",
    path: ["color"],
    children: [
      {
        kind: "token",
        name: "brand",
        path: ["color", "brand"],
        type: "color",
        value: "#ff0000",
      },
      {
        kind: "token",
        name: "accent",
        path: ["color", "accent"],
        type: "color",
        value: "#00a0ff",
      },
    ],
  },
  {
    kind: "group",
    name: "space",
    path: ["space"],
    children: [
      {
        kind: "token",
        name: "sm",
        path: ["space", "sm"],
        type: "dimension",
        value: "4px",
      },
    ],
  },
];

const LIGHT_WITH_DARK_MODES: TokenTree = [
  {
    kind: "group",
    name: "color",
    path: ["color"],
    children: [
      {
        kind: "token",
        name: "brand",
        path: ["color", "brand"],
        type: "color",
        value: "#ff0000",
        modes: { dark: "#101820" },
      },
      {
        kind: "token",
        name: "accent",
        path: ["color", "accent"],
        type: "color",
        value: "#00a0ff",
        modes: { dark: "#7fd4ff" },
      },
    ],
  },
  {
    kind: "group",
    name: "space",
    path: ["space"],
    children: [
      {
        kind: "token",
        name: "sm",
        path: ["space", "sm"],
        type: "dimension",
        value: "4px",
      },
    ],
  },
];

const MIDNIGHT: TokenTree = [
  {
    kind: "group",
    name: "color",
    path: ["color"],
    children: [
      {
        kind: "token",
        name: "brand",
        path: ["color", "brand"],
        type: "color",
        value: "#101820",
      },
      {
        kind: "token",
        name: "accent",
        path: ["color", "accent"],
        type: "color",
        value: "#7fd4ff",
      },
    ],
  },
];

test("generateCss emits a custom property per token, named by its dotted path", () => {
  const css = generateCss(LIGHT);
  const root = blockWithSelector(css, ":root");

  deepStrictEqual(root.declarations["--color-brand"], "#ff0000");
  deepStrictEqual(root.declarations["--color-accent"], "#00a0ff");
  deepStrictEqual(root.declarations["--space-sm"], "4px");
});

test("generateCss puts every token of the tree into the base block", () => {
  const css = generateCss(LIGHT);
  const root = blockWithSelector(css, ":root");
  const names = Object.keys(root.declarations).sort();

  deepStrictEqual(names, ["--color-accent", "--color-brand", "--space-sm", "--spin-modes"]);
});


test("a token's $modes.dark value — literal or alias — lands in the dark block", () => {
  const doc = {
    color: {
      $type: "color",
      brand: {
        $value: "#000000",
        $modes: { dark: "#ffffff" },
      },
      "on-brand": {
        $value: "#111111",
        $modes: { dark: "{color.brand}" },
      },
    },
  };
  const css = generateCss(treeOf(parseTokens(JSON.stringify(doc))));
  const base = blockWithSelector(css, ":root");
  const dark = blockWithSelector(css, ':root[data-mode="dark"]');

  deepStrictEqual(base.declarations["--color-brand"], "#000000");
  deepStrictEqual(base.declarations["--color-on-brand"], "#111111");
  deepStrictEqual(dark.declarations["--color-brand"], "#ffffff");
  deepStrictEqual(dark.declarations["--color-on-brand"], "var(--color-brand)");
});

test("a boolean token emits its answer loudly: 1 when on, 0 when off", () => {
  // The flag is a switch a rule reads through the sheet, and custom
  // properties inherit: the boot deck's full token set stands at `:root`,
  // so silence would inherit that deck's answer instead of carrying the
  // no. A declared `false` is the deck's own answer — it projects `0` and
  // overrides the inherited one. Only an UNdeclared flag is absent.
  const tree = treeOf(parseTokens({
    badge: {
      $type: "boolean",
      pill: { $type: "boolean", $value: true },
      sharp: { $type: "boolean", $value: false },
    },
  }));
  const css = generateCss(tree);
  assert(css.includes("--badge-pill: 1"), "a true flag emits 1");
  assert(css.includes("--badge-sharp: 0"), "a false flag emits the no it gave");
});

test("generateCss honours a custom prefix on every property name", () => {
  const css = generateCss(LIGHT, { prefix: "spin" });
  const root = blockWithSelector(css, ":root");

  deepStrictEqual(root.declarations["--spin-color-brand"], "#ff0000");
});

test("generateCss honours a custom selector for the base block", () => {
  const css = generateCss(LIGHT, { selector: ".app-theme" });

  deepStrictEqual(
    blockWithSelector(css, ".app-theme").declarations["--color-brand"],
    "#ff0000",
  );
});

test("generateCss keeps the base block on the light values when a dark mode is present", () => {
  const css = generateCss(LIGHT_WITH_DARK_MODES);
  const root = blockWithSelector(css, ":root");

  deepStrictEqual(root.declarations["--color-brand"], "#ff0000");
  deepStrictEqual(root.declarations["--color-accent"], "#00a0ff");
});

test("generateCss emits $modes.dark overrides as a separate block", () => {
  const css = generateCss(LIGHT_WITH_DARK_MODES);
  const dark = blockMentioning(css, "dark");

  deepStrictEqual(dark.declarations["--color-brand"], "#101820");
  deepStrictEqual(dark.declarations["--color-accent"], "#7fd4ff");
});

test("generateCss gives the dark block the same property names as the base block", () => {
  const css = generateCss(LIGHT_WITH_DARK_MODES);
  const root = blockWithSelector(css, ":root");
  const dark = blockMentioning(css, "dark");

  for (const property of Object.keys(dark.declarations)) {
    assert(
      property in root.declarations,
      `"${property}" only exists in the dark block, so it would not override anything`,
    );
  }
});

test("a token's light value lands in the light block, and the base keeps its own", () => {
  // The light mode is the other side of the same axis as the dark one: a
  // theme whose own face is its dark face restates its light mode the same
  // way, and the restatement lands in its own block rather than over the
  // base.
  const doc = {
    color: {
      $type: "color",
      brand: { $value: "#101820", $modes: { light: "#f8f8ff" } },
      accent: { $value: "#00a0ff" },
    },
  };
  const css = generateCss(treeOf(parseTokens(JSON.stringify(doc))));

  deepStrictEqual(
    blockWithSelector(css, ":root").declarations["--color-brand"],
    "#101820",
  );
  deepStrictEqual(
    blockWithSelector(css, ':root[data-mode="light"]').declarations[
      "--color-brand"
    ],
    "#f8f8ff",
  );
  // A token the light mode does not restate is not restated: the block
  // carries only what the mode says, and the base answers the rest.
  deepStrictEqual(
    blockWithSelector(css, ':root[data-mode="light"]').declarations[
      "--color-accent"
    ],
    undefined,
  );
});

test("a document with no light restatement ships no light block", () => {
  // A block nobody asked for is a block that can disagree with the base.
  const css = generateCss(LIGHT);

  deepStrictEqual(
    blocks(css).some((block) => block.selector.includes('data-mode="light"')),
    false,
  );
});

test("generateCss emits an alias token as a reference to its target variable", () => {
  const aliased: TokenTree = [{
    kind: "group",
    name: "color",
    path: ["color"],
    children: [
      {
        kind: "token",
        name: "primary",
        path: ["color", "primary"],
        type: "color",
        value: "#ff0000",
      },
      {
        kind: "token",
        name: "action",
        path: ["color", "action"],
        type: "color",
        value: "{color.primary}",
      },
    ],
  }];
  const css = generateCss(aliased);
  const root = blockWithSelector(css, ":root");

  deepStrictEqual(root.declarations["--color-action"], "var(--color-primary)");
});

test("generateThemeCss emits one value block per theme", () => {
  const themes: Record<string, TokenTree> = {
    daylight: LIGHT,
    midnight: MIDNIGHT,
  };
  const css = generateThemeCss(themes);

  const valueBlock = (needle: string): CssBlock => {
    const found = blocks(css).find((block) =>
      block.selector.includes(needle) &&
      block.declarations["--color-brand"] !== undefined
    );
    if (found === undefined) throw new Error(`no value block for "${needle}"`);
    return found;
  };
  deepStrictEqual(valueBlock("daylight").declarations["--color-brand"], "#ff0000");
  deepStrictEqual(valueBlock("midnight").declarations["--color-brand"], "#101820");
});

test("generateThemeCss scopes each theme to its own selector", () => {
  const css = generateThemeCss({ daylight: LIGHT, midnight: MIDNIGHT });
  const selectors = blocks(css).map((block) => block.selector);

  for (const theme of ["daylight", "midnight"]) {
    const scoped = selectors.filter((selector) => selector.includes(theme));
    // The base plus the runtime mode metadata the pickers read from CSS.
    assert(scoped.length >= 1, `expected a block scoping "${theme}"`);
    assert(
      scoped.every((selector) => selector.startsWith(`[data-theme="${theme}"]`)),
      `every "${theme}" block scopes to its own selector: ${scoped}`,
    );
  }
});

test("generateThemeCss gives each theme the values of its own token set", () => {
  const distinct: TokenTree = [{
    kind: "group",
    name: "color",
    path: ["color"],
    children: [
      {
        kind: "token",
        name: "brand",
        path: ["color", "brand"],
        type: "color",
        value: "#00ff00",
      },
    ],
  }];
  const css = generateThemeCss({
    daylight: LIGHT,
    midnight: MIDNIGHT,
    neon: distinct,
  });

  deepStrictEqual(
    blockMentioning(css, "neon").declarations["--color-brand"],
    "#00ff00",
  );
});
test("two themes aliasing different styles emit distinct type vars per theme", () => {
  const docFor = (buttonTarget: string, h1Target: string) => ({
    font: {
      family: { sans: { $type: "fontFamily", $value: "Inter" } },
      size: {
        md: { $type: "dimension", $value: "1rem" },
        lg: { $type: "dimension", $value: "2rem" },
      },
      weight: { regular: { $type: "fontWeight", $value: 400 } },
      tracking: { normal: { $type: "dimension", $value: "0em" } },
      leading: { relaxed: { $type: "dimension", $value: 1.625 } },
      style: {
        label: {
          $type: "typography",
          $value: {
            family: "{font.family.sans}",
            size: "{font.size.md}",
            weight: "{font.weight.regular}",
            tracking: "{font.tracking.normal}",
            leading: "{font.leading.relaxed}",
          },
        },
        code: {
          $type: "typography",
          $value: {
            family: "{font.family.sans}",
            size: "{font.size.lg}",
            weight: "{font.weight.regular}",
            tracking: "{font.tracking.normal}",
            leading: "{font.leading.relaxed}",
          },
        },
        title: {
          $type: "typography",
          $value: {
            family: "{font.family.sans}",
            size: "{font.size.lg}",
            weight: "{font.weight.regular}",
            tracking: "{font.tracking.normal}",
            leading: "{font.leading.relaxed}",
          },
        },
      },
    },
    button: { type: { $type: "typography", $value: `{${buttonTarget}}` } },
    element: { h1: { type: { $type: "typography", $value: `{${h1Target}}` } } },
  });
  const a = treeOf(parseTokens(docFor("font.style.label", "font.style.label")));
  const b = treeOf(parseTokens(docFor("font.style.code", "font.style.title")));
  const css = generateThemeCss({ a, b });
  const valueBlock = (needle: string): CssBlock => {
    const found = blocks(css).find((block) =>
      block.selector.includes(needle) &&
      block.declarations["--button-type-size"] !== undefined
    );
    if (found === undefined) throw new Error(`no value block for "${needle}"`);
    return found;
  };
  deepStrictEqual(
    valueBlock('"a"').declarations["--button-type-size"],
    "var(--font-style-label-size)",
  );
  deepStrictEqual(
    valueBlock('"b"').declarations["--button-type-size"],
    "var(--font-style-code-size)",
  );
  deepStrictEqual(
    valueBlock('"b"').declarations["--element-h1-type-size"],
    "var(--font-style-title-size)",
  );
  deepStrictEqual(
    valueBlock('"a"').declarations["--element-h1-type-size"],
    "var(--font-style-label-size)",
  );
});


/** True when `types` has a token key at exactly `path`, dotted segments and all. */
function declaresPath(types: string, path: string): boolean {
  return new RegExp(
    `(^|[^\\w.$-])${path.replace(/\./g, "\\.")}($|[^\\w-])`,
    "m",
  ).test(types);
}

test("generateTypes names every token path in the emitted type", () => {
  const types = generateTypes(LIGHT);

  assert(
    types.includes("ThemeTokens"),
    "the emitted declaration should be ThemeTokens",
  );
  for (const path of ["color.brand", "color.accent", "space.sm"]) {
    assert(
      declaresPath(types, path),
      `the type is missing the "${path}" key; got: ${types}`,
    );
  }
});

test("generateTypes declares exactly the custom properties generateCss emits", () => {
  const tree = LIGHT_WITH_DARK_MODES;
  const emitted = new Set<string>();

  for (const block of blocks(generateCss(tree))) {
    for (const property of Object.keys(block.declarations)) {
      // Runtime metadata, not tokens: the pickers read it from CSS, and
      // no typed token map declares it.
      if (property.startsWith("--spin-")) continue;
      emitted.add(property);
    }
  }

  const declared = new Set(generateTypes(tree).match(/"--[\w-]+"/g) ?? []);
  const asNames = [...declared].map((name) => name.replaceAll('"', "")).sort();

  assert(emitted.size > 0, "the fixture should emit at least one property");
  deepStrictEqual(asNames, [...emitted].sort());
});

test("every shipped theme declares the whole spacing scale", () => {
  // The utility vocabulary is dense — `p-1`..`p-16` — so a scale with holes
  // makes every step inside a hole a class that silently does nothing. The
  // shipped themes used to declare 0,1,2,4,8,16, which meant `p-3`, `p-5`,
  // `p-6`, `gap-6` and friends emitted no rule at all, in the studio, the
  // reference and the example app alike, with nothing to say so.
  const REQUIRED = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "10",
    "12",
    "16",
    "20",
    "24",
  ];
  for (const [name, theme] of Object.entries(starterThemes)) {
    const scale = theme.spacing as Record<string, unknown>;
    const declared = Object.keys(scale).filter((key) => !key.startsWith("$"));
    const missing = REQUIRED.filter((step) => !declared.includes(step));
    deepStrictEqual(missing, [], `${name} is missing spacing steps`);
  }
});

test("a theme in force beats the root theme's dark block", () => {
  // The bug this covers: the root theme's dark block was `:root[data-mode="dark"]`
  // — a pseudo-class and an attribute — while a project's theme block was a bare
  // `[data-theme="x"]`. The dark block won, so a project theme rendered the
  // starter's palette in dark mode, and the rule "a mode you serve but do not
  // override falls back to your base" was false for every theme but the first.
  const starter = parseTokens(minimalTheme);
  assert(starter.ok);
  const css = generateThemeCss(
    { starter: starter.tree, project: starter.tree },
    { rootTheme: "starter" },
  );

  // The root theme's blocks are defaults: no specificity of their own, so any
  // theme in force beats them.
  assert(
    css.includes(":where(:root) {") &&
      css.includes(':where(:root[data-mode="dark"]) {'),
    "the root theme's blocks carry no specificity",
  );
  // A project's own block is a bare attribute selector, and it is written after
  // the defaults, so a token both declare resolves to the project's.
  assert(
    css.includes('[data-theme="project"] {') &&
      css.indexOf('[data-theme="project"] {') > css.indexOf(":where(:root) {"),
    "a theme in force is written after the defaults",
  );
});

test("generateThemeCss writes each theme's declared modes, not a structural guess", () => {
  const css = generateThemeCss(
    { console: MIDNIGHT },
    { modes: { console: ["dark"] } },
  );
  deepStrictEqual(
    blockWithSelector(css, '[data-theme="console"]').declarations["--spin-modes"],
    "dark",
  );
});

test("generateThemeCss without declarations keeps the structural derivation", () => {
  const css = generateThemeCss({ daylight: LIGHT });
  deepStrictEqual(
    blockWithSelector(css, '[data-theme="daylight"]').declarations["--spin-modes"],
    "light",
  );
});

test("a palette facet emits after its theme carrying only its own ink", () => {
  // The composition this covers: `<html data-theme="minimal"
  // data-palette="catppuccin">` resolves the palette's ink over the theme's
  // space. The facet block must come later at equal specificity (so it wins
  // ties) and must carry only the leaves the facet states (so it never
  // clobbers the theme's spacing or type along with its ink).
  const minimal = treeOf(parseTokens(minimalTheme));
  const palette = treeOf(parseTokens(catppuccinPalette));
  const css = generateThemeCss(
    { minimal },
    { palettes: { catppuccin: palette }, paletteModes: { catppuccin: ["light", "dark"] } },
  );
  const themeBlock = blockWithSelector(css, '[data-theme="minimal"]');
  const facetBlock = blockWithSelector(css, '[data-palette="catppuccin"]');
  deepStrictEqual(facetBlock.declarations["--color-surface"], "#eff1f5");
  deepStrictEqual(
    blockWithSelector(css, '[data-palette="catppuccin"][data-mode="dark"]').declarations["--color-surface"],
    "#11111b",
  );
  assert(
    css.indexOf('[data-palette="catppuccin"]') > css.indexOf('[data-theme="minimal"]'),
    "the palette block is written after the theme block",
  );
  for (const property of Object.keys(facetBlock.declarations)) {
    assert(
      property === "--spin-modes" || property.startsWith("--color-"),
      `a palette block carries only ink: ${property}`,
    );
  }
  deepStrictEqual(themeBlock.declarations["--color-surface"] !== undefined, true);
});

test("a spacing facet emits last carrying only its own space, never modes", () => {
  // The composition this covers: `<div data-spacing="compact">` tightens
  // gaps without touching ink or type. Spacing is mode-invariant, so the
  // facet ships one block and no `[data-mode]` companion.
  const minimal = treeOf(parseTokens(minimalTheme));
  const palette = treeOf(parseTokens(catppuccinPalette));
  const spacing = treeOf(parseTokens(compactSpacing));
  const css = generateThemeCss(
    { minimal },
    { palettes: { catppuccin: palette }, spacings: { compact: spacing } },
  );
  const facetBlock = blockWithSelector(css, '[data-spacing="compact"]');
  deepStrictEqual(facetBlock.declarations["--spacing-4"], "0.875rem");
  assert(
    css.indexOf('[data-spacing="compact"]') > css.indexOf('[data-palette="catppuccin"]'),
    "the spacing block is written after the palette block",
  );
  for (const property of Object.keys(facetBlock.declarations)) {
    assert(
      property.startsWith("--spacing-") || property.startsWith("--card-") ||
        property.startsWith("--alert-"),
      `a spacing block carries only space: ${property}`,
    );
  }
  assert(
    blocks(css).every((block) => !block.selector.startsWith('[data-spacing="compact"][')),
    "a spacing facet ships no mode block",
  );
});

test("a palette block and a spacing block compose without clobbering", () => {
  // The nested-subtree case: `<div data-theme="minimal"
  // data-spacing="compact"><aside data-palette="catppuccin"
  // data-mode="dark">` resolves compact's space and catppuccin's dark ink
  // at once. Each block must lack the other's axis entirely.
  const minimal = treeOf(parseTokens(minimalTheme));
  const palette = treeOf(parseTokens(catppuccinPalette));
  const spacing = treeOf(parseTokens(compactSpacing));
  const css = generateThemeCss(
    { minimal },
    { palettes: { catppuccin: palette }, spacings: { compact: spacing } },
  );
  const paletteBlock = blockWithSelector(css, '[data-palette="catppuccin"]');
  const spacingBlock = blockWithSelector(css, '[data-spacing="compact"]');
  assert(
    Object.keys(paletteBlock.declarations).every((property) => !property.startsWith("--spacing-")),
    "the palette block carries no spacing",
  );
  assert(
    Object.keys(spacingBlock.declarations).every((property) => !property.startsWith("--color-")),
    "the spacing block carries no ink",
  );
  deepStrictEqual(
    blockWithSelector(css, '[data-palette="catppuccin"][data-mode="dark"]').declarations["--color-text"],
    "#cdd6f4",
  );
});
