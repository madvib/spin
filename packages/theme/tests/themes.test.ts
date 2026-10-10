import { assert, assertEquals } from "@std/assert";
import {
  contrastRatio,
  cssVarName,
  generateCss,
  generateThemeCss,
  indexTree,
  inkTokens,
  parseTokens,
  validateTokens,
} from "@spin/theme";
import type { ParseResult, ThemeDocument, TokenTree } from "@spin/theme";
import { supportsDark } from "@spin/theme/themes";

/**
 * These tests run the whole package against the example theme that ships with
 * it (`src/themes/`). A starter is what a consumer copies and customises, so
 * what matters here is not that its particular hexes are pleasant but that the
 * shape a real theme has survives the pipeline end to end: two files parse, both
 * validate, one stylesheet comes out with a light block and a dark block, and a
 * dark-mode consumer reads different colors and the same spacing.
 */

// The SHIPPED starter themes, not fixtures: these are the product, and
// a consumer picks one and customises it rather than writing a theme
// from scratch.
const THEMES_DIR = new URL("../src/themes/", import.meta.url);

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
  if (!found) {
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
  "color.on-danger",
  "color.focus-ring",
  // The button is the only component that owns character. Everything else it
  // reads is a scale step, already listed above.
  "button.weight",
  "button.case",
  "button.tracking",
  "button.shadow",
  "button.shadow-hover",
  "focus.width",
  "focus.offset",
  "border.width",
  "color.link",
];


Deno.test("the ink a theme declares is read from the theme itself", () => {
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

Deno.test("the example theme's light document parses into a token tree", async () => {
  const source = await Deno.readTextFile(new URL("default.json", THEMES_DIR));
  const tree = treeOf(parseTokens(source), "default.json");

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
  // Components own their character; each is a group named after the component.
  for (
    const component of ["button", "icon", "checkbox", "switch"]
  ) {
    assert(
      present.has(component),
      `the example theme must state \`${component}\` character tokens`,
    );
  }
});

/**
 * The dark SIDE of the default theme: its `dark` group, as a tree of its own.
 *
 * Not a second document — `dark` is a MODE, and the group inside the one
 * document is what it resolves to. Reading it out here is what lets a test ask
 * "what does dark change?" without pretending the dark side is a theme.
 */
function darkGroup(): TokenTree {
  const tree = treeOf(
    parseTokens(
      Deno.readTextFileSync(new URL("default.json", THEMES_DIR)),
    ),
    "default.json",
  );
  const dark = tree.find((node) => node.path.join(".") === "dark");
  assert(dark !== undefined, "the default theme must carry a dark group");
  return [dark];
}

Deno.test("the default theme carries a dark MODE rather than being a second theme", async () => {
  // `light` and `dark` are two modes of ONE theme. There is no theme named
  // `light` and no document named `dark` — the dark side is a `dark` group
  // inside the same document, which is what `generateCss` scopes to
  // `[data-theme="<name>"][data-mode="dark"]`.
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
  );
  const dark = tree.find((node) => node.path.join(".") === "dark");
  assert(dark !== undefined, "the default theme must carry a dark group");

  // The dark side restates colours and the focus ring; metrics are inherited,
  // because a mode says what CHANGES.
  assertEquals(
    dark?.kind === "group"
      ? dark.children.map((node) => node.path.join("."))
      : [],
    ["dark.color", "dark.focus"],
  );
});

Deno.test("the example theme defines every token path it advertises", async () => {
  const theme = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
  );
  const report = validateTokens(theme, { required: REQUIRED });

  assertEquals(report.issues, []);
  assert(report.valid);
});

Deno.test("the example theme's light document validates on its own", async () => {
  const source = await Deno.readTextFile(new URL("default.json", THEMES_DIR));
  const light = treeOf(parseTokens(source), "default.json");

  assertEquals(validateTokens(light).issues, []);
});

Deno.test("a theme declares the modes it actually has", async () => {
  // Not "every starter carries a dark group" — that was the wrong property, and
  // it was wrong for console, whose BASE is already dark: a terminal palette
  // has no light mode, and generating a `dark` group from its own base
  // restated it and added nothing.
  //
  // What is true of every theme is that its `dark` group only restates tokens
  // it already declares, and that the set of modes a theme reports is derived
  // from that group rather than listed beside it — so adding a mode is a change
  // to the theme and not to a second file that has to agree.
  for (const name of ["default", "neobrut", "console"]) {
    const doc = parseTokens(
      await Deno.readTextFile(new URL(`${name}.json`, THEMES_DIR)),
    );
    if (!doc.ok) throw new Error(`${name}: ${doc.error}`);

    const carriesDark = Object.keys(doc.tree).some((node) =>
      node.toLowerCase() === "dark"
    );
    assertEquals(
      supportsDark(doc as ThemeDocument),
      carriesDark,
      `${name}: the reported modes must follow from whether it declares one`,
    );
  }
});

Deno.test("the example theme's stylesheet is a light block and a dark block", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
  );
  // The NAMED path, which is what a consumer calls. It scopes a theme's dark
  // mode to `[data-theme=<name>][data-mode="dark"]` — so the mode belongs to
  // its theme, and two themes can each carry a dark mode without fighting.
  const css = generateThemeCss({ default: tree });

  assertEquals(
    blocks(css).map((block) => block.selector),
    ['[data-theme="default"]', '[data-theme="default"][data-mode="dark"]'],
  );
});

Deno.test("the light block of the example theme carries the light document's values", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
  );
  const root = blockWithSelector(generateCss(tree), ":root");

  assertEquals(root.declarations["--color-primary"], "#2563eb");
  assertEquals(root.declarations["--color-secondary"], "#6d28d9");
  assertEquals(root.declarations["--color-accent"], "#0f766e");
  assertEquals(root.declarations["--color-semantic-error"], "#b91c1c");
  assertEquals(root.declarations["--spacing-4"], "1rem");
  assertEquals(
    root.declarations["--font-family-sans"],
    "Inter, ui-sans-serif, system-ui, sans-serif",
  );
  assertEquals(root.declarations["--font-size-md"], "1rem");
  assertEquals(root.declarations["--font-weight-bold"], "700");
  assertEquals(root.declarations["--radius-full"], "9999px");
  assertEquals(root.declarations["--breakpoint-lg"], "64rem");
  assertEquals(root.declarations["--z-index-modal"], "2000");
  assertEquals(root.declarations["--motion-duration-base"], "250ms");
  assertEquals(
    root.declarations["--motion-easing-standard"],
    "cubic-bezier(0.2, 0, 0, 1)",
  );
});

Deno.test("every dark declaration lands on a property the light theme declares", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
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

Deno.test("the dark block emits every token the dark document declares", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
  );
  const css = generateCss(tree);
  const darkBlock = blockWithSelector(css, ':root[data-mode="dark"]');
  const declared = Object.values(indexTree(darkGroup()).leaves).map((leaf) =>
    // The leaf paths arrive prefixed with `dark`, which is the mode's own
    // namespace rather than part of the property name.
    cssVarName(leaf.path.slice(1))
  );
  for (const name of declared) {
    assert(
      name in darkBlock.declarations,
      `${name} is declared by the dark document but missing from its block`,
    );
  }
  assertEquals(
    Object.keys(darkBlock.declarations).sort(),
    [...declared].sort(),
  );
});

Deno.test("a dark-mode consumer reads the dark document's colors", async () => {
  const light = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
  );
  const dark = darkGroup();
  const vars = varsInMode(generateCss([...light, ...dark]), "dark");

  assertEquals(vars["--color-primary"], "#60a5fa");
  assertEquals(vars["--color-secondary"], "#a78bfa");
  assertEquals(vars["--color-accent"], "#2dd4bf");
  assertEquals(vars["--color-semantic-success"], "#4ade80");
  assertEquals(vars["--color-semantic-error"], "#f87171");
  assertEquals(vars["--color-surface-raised"], "#111827");
});

Deno.test("roles that reference the neutral ramp follow it into dark mode", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
  );
  const css = generateCss(tree);
  const lightVars = varsInMode(css, "light");
  const darkVars = varsInMode(css, "dark");

  // A surface is a reference, not a value, so the dark document never restates
  // it. Restating it is exactly what would let the two modes drift apart.
  assertEquals(lightVars["--color-surface"], "var(--color-neutral-50)");
  assertEquals(lightVars["--color-text"], "var(--color-neutral-900)");
  assertEquals(lightVars["--color-border"], "var(--color-neutral-200)");

  assertEquals(resolve(lightVars, "--color-surface"), "#f8fafc");
  assertEquals(resolve(darkVars, "--color-surface"), "#0b1120");
  assertEquals(resolve(lightVars, "--color-text"), "#0f172a");
  assertEquals(resolve(darkVars, "--color-text"), "#f8fafc");
  assertEquals(resolve(lightVars, "--color-border"), "#e2e8f0");
  assertEquals(resolve(darkVars, "--color-border"), "#1f2937");
});

Deno.test("spacing, typography and layering are the same scale in both modes", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
  );
  const css = generateCss(tree);
  const lightVars = varsInMode(css, "light");
  const darkVars = varsInMode(css, "dark");

  for (const step of ["0", "1", "2", "4", "8", "16"]) {
    assertEquals(darkVars[`--spacing-${step}`], lightVars[`--spacing-${step}`]);
  }
  for (const layer of ["base", "dropdown", "modal", "toast"]) {
    assertEquals(
      darkVars[`--z-index-${layer}`],
      lightVars[`--z-index-${layer}`],
    );
  }
  assertEquals(darkVars["--spacing-4"], "1rem");
  assertEquals(darkVars["--radius-md"], "0.25rem");
  assertEquals(darkVars["--z-index-toast"], "3000");
  assertEquals(darkVars["--font-weight-semibold"], "600");
  assertEquals(darkVars["--breakpoint-xl"], "80rem");
  assertEquals(
    darkVars["--shadow-lg"],
    "0 12px 32px -8px rgba(15, 23, 42, 0.16)",
  );
  assertEquals(
    darkVars["--motion-easing-decelerate"],
    "cubic-bezier(0, 0, 0, 1)",
  );
});

Deno.test("the example theme's spacing scale grows with its step number", async () => {
  const light = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
  );
  const dark = darkGroup();
  const vars = varsInMode(generateCss([...light, ...dark]), "light");

  assertAscending(
    ["0", "1", "2", "4", "8", "16"].map((step) =>
      toNumber(vars[`--spacing-${step}`] as string)
    ),
    "spacing",
  );
});

Deno.test("the example theme's radii round off from square to fully round", async () => {
  const light = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
  );
  const dark = darkGroup();
  const vars = varsInMode(generateCss([...light, ...dark]), "light");

  assertAscending(
    ["none", "sm", "md", "lg", "full"].map((name) =>
      toNumber(vars[`--radius-${name}`] as string)
    ),
    "radius",
  );
});

Deno.test("the example theme's breakpoints and z-index layers are ordered", async () => {
  const light = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
  );
  const dark = darkGroup();
  const vars = varsInMode(generateCss([...light, ...dark]), "light");

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
  assertEquals(Number(vars["--z-index-base"]), 0);
});

Deno.test("the example theme's text is legible on its own surfaces in both modes", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
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

Deno.test("the example theme's status colors are legible in both modes", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
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
Deno.test("every tone fill+on pair meets 4.5:1 in every shipped theme and mode", async () => {
  const pairs = [
    ["--color-primary", "--color-on-primary"],
    ["--color-secondary", "--color-on-secondary"],
    ["--color-accent", "--color-on-accent"],
    ["--color-semantic-success", "--color-on-semantic-success"],
    ["--color-semantic-warning", "--color-on-semantic-warning"],
    ["--color-semantic-error", "--color-on-danger"],
  ] as const;

  for (const name of ["default", "neobrut", "console"] as const) {
    const tree = treeOf(
      parseTokens(await Deno.readTextFile(new URL(`${name}.json`, THEMES_DIR))),
      `${name}.json`,
    );
    const css = generateCss(tree);
    const hasDark = tree.find((node) => node.path.join(".") === "dark") !== undefined;
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
          `${name} ${mode} ${fill} on ${fg} is ${ratio.toFixed(2)}:1, below 4.5:1`,
        );
      }
    }
  }
});

Deno.test("the example theme is addressable as the named 'default' theme", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("default.json", THEMES_DIR))),
    "default.json",
  );
  const css = generateThemeCss({ default: tree });

  assertEquals(
    blocks(css).map((block) => block.selector),
    ['[data-theme="default"]', '[data-theme="default"][data-mode="dark"]'],
  );
  assertEquals(
    blockWithSelector(
      css,
      '[data-theme="default"]',
    ).declarations["--color-primary"],
    "#2563eb",
  );
  assertEquals(
    blockWithSelector(
      css,
      '[data-theme="default"][data-mode="dark"]',
    ).declarations["--color-primary"],
    "#60a5fa",
  );
});
