import { assert, assertEquals } from "@std/assert";
import { generateCss, generateThemeCss, generateTypes } from "./generate.ts";
import { parseTokens } from "./parse.ts";
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

const DARK: TokenTree = [
  {
    kind: "group",
    name: "dark",
    path: ["dark"],
    children: [
      {
        kind: "group",
        name: "color",
        path: ["dark", "color"],
        children: [
          {
            kind: "token",
            name: "brand",
            path: ["dark", "color", "brand"],
            type: "color",
            value: "#101820",
          },
          {
            kind: "token",
            name: "accent",
            path: ["dark", "color", "accent"],
            type: "color",
            value: "#7fd4ff",
          },
        ],
      },
    ],
  },
];

Deno.test("generateCss emits a custom property per token, named by its dotted path", () => {
  const css = generateCss(LIGHT);
  const root = blockWithSelector(css, ":root");

  assertEquals(root.declarations["--color-brand"], "#ff0000");
  assertEquals(root.declarations["--color-accent"], "#00a0ff");
  assertEquals(root.declarations["--space-sm"], "4px");
});

Deno.test("generateCss puts every token of the tree into the base block", () => {
  const css = generateCss(LIGHT);
  const root = blockWithSelector(css, ":root");
  const names = Object.keys(root.declarations).sort();

  assertEquals(names, ["--color-accent", "--color-brand", "--space-sm"]);
});

Deno.test("a token's per-mode values emit the same CSS as a dark group", () => {
  // The migration's whole contract: a token that carries its dark value in
  // `$modes` and a document that carries it in a `dark` group are the same
  // stylesheet to the last byte. If this fails, the migration is not a
  // migration — it is a rewrite with a regression in it.
  const grouped = {
    color: { brand: { $value: "#000000", $type: "color" } },
    dark: {
      color: { brand: { $value: "#ffffff", $type: "color" } },
    },
  };
  const inline = {
    color: {
      brand: {
        $value: "#000000",
        $type: "color",
        $modes: { dark: "#ffffff" },
      },
    },
  };
  const alias = {
    color: {
      brand: { $value: "#000000", $type: "color" },
      onBrand: { $value: "#111111", $type: "color" },
    },
    dark: {
      color: { onBrand: { $value: "{color.brand}", $type: "color" } },
    },
  };
  const aliasInline = {
    color: {
      brand: { $value: "#000000", $type: "color" },
      onBrand: {
        $value: "#111111",
        $type: "color",
        $modes: { dark: "{color.brand}" },
      },
    },
  };

  for (
    const [withGroup, perToken] of [
      [grouped, inline],
      [alias, aliasInline],
    ]
  ) {
    const fromGroup = generateCss(
      treeOf(parseTokens(JSON.stringify(withGroup))),
    );
    const fromToken = generateCss(
      treeOf(parseTokens(JSON.stringify(perToken))),
    );
    // Same declarations, byte for byte, in the base block: the migration
    // touches no base value.
    const baseOf = (css: string) => css.slice(0, css.indexOf("[data-mode"));
    assertEquals(
      baseOf(fromToken),
      baseOf(fromGroup),
      "the base block is unchanged by the migration",
    );
    // The dark block holds the same declarations. Its ORDER follows the base
    // tree rather than the old group's, because the values now come from the
    // tokens themselves — so this is a set comparison, and a deliberate one:
    // the emitted dark block is ordered by the base it overrides.
    const declsOf = (css: string) =>
      (css.slice(css.indexOf("[data-mode")).match(/--[\w-]+:[^;]+;/g) ?? [])
        .sort();
    assertEquals(
      declsOf(fromToken),
      declsOf(fromGroup),
      "the dark block declares the same values either way",
    );
  }
});

Deno.test("a boolean token emits its flag when on and nothing when off", () => {
  // The flag is the whole mechanism: a rule asks whether the theme declared
  // it, and a false flag is the same answer as no declaration at all.
  const tree = treeOf(parseTokens({
    badge: {
      $type: "boolean",
      pill: { $type: "boolean", $value: true },
      sharp: { $type: "boolean", $value: false },
    },
  }));
  const css = generateCss(tree);
  assert(css.includes("--badge-pill: 1;"), "a true flag emits 1");
  assert(!css.includes("--badge-sharp"), "a false flag emits nothing at all");
});

Deno.test("generateCss honours a custom prefix on every property name", () => {
  const css = generateCss(LIGHT, { prefix: "spin" });
  const root = blockWithSelector(css, ":root");

  assertEquals(root.declarations["--spin-color-brand"], "#ff0000");
});

Deno.test("generateCss honours a custom selector for the base block", () => {
  const css = generateCss(LIGHT, { selector: ".app-theme" });

  assertEquals(
    blockWithSelector(css, ".app-theme").declarations["--color-brand"],
    "#ff0000",
  );
});

Deno.test("generateCss keeps the base block on the light values when a dark variant is present", () => {
  const css = generateCss([...LIGHT, ...DARK]);
  const root = blockWithSelector(css, ":root");

  assertEquals(root.declarations["--color-brand"], "#ff0000");
  assertEquals(root.declarations["--color-accent"], "#00a0ff");
});

Deno.test("generateCss emits the dark group as a separate block", () => {
  const css = generateCss([...LIGHT, ...DARK]);
  const dark = blockMentioning(css, "dark");

  assertEquals(dark.declarations["--color-brand"], "#101820");
  assertEquals(dark.declarations["--color-accent"], "#7fd4ff");
});

Deno.test("generateCss gives the dark block the same property names as the base block", () => {
  const css = generateCss([...LIGHT, ...DARK]);
  const root = blockWithSelector(css, ":root");
  const dark = blockMentioning(css, "dark");

  for (const property of Object.keys(dark.declarations)) {
    assert(
      property in root.declarations,
      `"${property}" only exists in the dark block, so it would not override anything`,
    );
  }
});

Deno.test("generateCss emits an alias token as a reference to its target variable", () => {
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

  assertEquals(root.declarations["--color-action"], "var(--color-primary)");
});

Deno.test("generateThemeCss emits one block per theme", () => {
  const themes: Record<string, TokenTree> = {
    daylight: LIGHT,
    midnight: DARK,
  };
  const css = generateThemeCss(themes);

  assertEquals(
    blockMentioning(css, "daylight").declarations["--color-brand"],
    "#ff0000",
  );
  assertEquals(
    blockMentioning(css, "midnight").declarations["--color-brand"],
    "#101820",
  );
});

Deno.test("generateThemeCss scopes each theme to its own selector", () => {
  const css = generateThemeCss({ daylight: LIGHT, midnight: DARK });
  const selectors = blocks(css).map((block) => block.selector);

  for (const theme of ["daylight", "midnight"]) {
    const scoped = selectors.filter((selector) => selector.includes(theme));
    assertEquals(
      scoped.length,
      1,
      `expected exactly one block scoping "${theme}"`,
    );
  }
});

Deno.test("generateThemeCss gives each theme the values of its own token set", () => {
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
    midnight: DARK,
    neon: distinct,
  });

  assertEquals(
    blockMentioning(css, "neon").declarations["--color-brand"],
    "#00ff00",
  );
});

/** True when `types` has a token key at exactly `path`, dotted segments and all. */
function declaresPath(types: string, path: string): boolean {
  return new RegExp(
    `(^|[^\\w.$-])${path.replace(/\./g, "\\.")}($|[^\\w-])`,
    "m",
  ).test(types);
}

Deno.test("generateTypes names every token path in the emitted type", () => {
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

Deno.test("generateTypes declares exactly the custom properties generateCss emits", () => {
  const tree = [...LIGHT, ...DARK];
  const emitted = new Set<string>();

  for (const block of blocks(generateCss(tree))) {
    for (const property of Object.keys(block.declarations)) {
      emitted.add(property);
    }
  }

  const declared = new Set(generateTypes(tree).match(/"--[\w-]+"/g) ?? []);
  const asNames = [...declared].map((name) => name.replaceAll('"', "")).sort();

  assert(emitted.size > 0, "the fixture should emit at least one property");
  assertEquals(asNames, [...emitted].sort());
});
