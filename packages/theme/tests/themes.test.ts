import { assert, assertEquals } from "@std/assert";
import {
  contrastRatio,
  cssVarName,
  generateCss,
  generateThemeCss,
  generateTypes,
  inkTokens,
  parseTokens,
  STROBE_FLOOR_MS,
  validateTokens,
  valuesInMode,
} from "@spin/theme";
import type {
  ParseResult,
  ThemeDocument,
  TokenLeaf,
  TokenNode,
  TokenTree,
} from "@spin/theme";
import {
  type StarterThemeName,
  starterThemes,
  themeModes,
} from "@spin/theme/themes";

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

/** A CSS duration as milliseconds, or `undefined` when it is not a duration. */
function durationMs(value: string): number | undefined {
  const match = /^(\d*\.?\d+)(ms|s)$/.exec(value.trim());
  if (match === null) return undefined;
  const n = Number(match[1]);
  return match[2] === "s" ? n * 1000 : n;
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

/** A shadow's weight: the px lengths it moves, summed. `none` weighs nothing. */
function shadowWeight(value: string): number {
  let total = 0;
  for (const [, length] of value.matchAll(/(-?\d*\.?\d+)px/g)) {
    total += Math.abs(Number(length));
  }
  return total;
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
  // The button is the only component that owns component tokens. Everything
  // else it reads is a scale step, already listed above.
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
  const source = await Deno.readTextFile(new URL("silk.json", THEMES_DIR));
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

Deno.test("the baseline theme carries a dark MODE rather than being a second theme", async () => {
  // `light` and `dark` are two modes of ONE theme. There is no theme named
  // `light` and no document named `dark` — the dark side lives on the tokens
  // themselves as `$modes.dark`, which `generateCss` scopes to
  // `[data-theme="<name>"][data-mode="dark"]`.
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
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
  assertEquals([...varying].sort(), ["color", "focus"]);
});

Deno.test("the example theme defines every token path it advertises", async () => {
  const theme = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
    "silk.json",
  );
  const report = validateTokens(theme, { required: REQUIRED });

  assertEquals(report.issues, []);
  assert(report.valid);
});

Deno.test("the example theme's light document validates on its own", async () => {
  const source = await Deno.readTextFile(new URL("silk.json", THEMES_DIR));
  const light = treeOf(parseTokens(source), "silk.json");

  assertEquals(validateTokens(light).issues, []);
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
  neobrut: ["light"],
  console: ["dark"],
  spin: ["light", "dark"],
} satisfies Record<StarterThemeName, readonly ("light" | "dark")[]>;

Deno.test("a theme states its modes at the root", async () => {
  // The modes are data, not derived from a group's presence: neobrut and
  // console have no `dark` group but different mode postures, and asking "does
  // this theme carry a dark override set?" cannot tell a base-that-is-dark
  // from a theme that never declares one. `modes` says what it serves.
  for (const [name, modes] of Object.entries(DECLARED_MODES)) {
    const doc = JSON.parse(
      await Deno.readTextFile(new URL(`${name}.json`, THEMES_DIR)),
    );
    assertEquals(
      doc.modes,
      modes,
      `${name}: root modes must say what it serves`,
    );
  }
});

Deno.test("a theme that serves a mode it does not override is valid", async () => {
  // The root `modes` says what a theme SERVES, and a mode it serves but
  // does not override falls back to the base values. So a theme that serves
  // dark and restates nothing is a complete theme, not a half-dark one —
  // which is exactly what a dark-only theme with a dark base is.
  //
  // The rule that follows from the claim is the other direction: a value
  // written for a mode the theme does not serve is never shown, and the
  // validator reports it.
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
    "silk.json",
  );
  assertEquals(validateTokens(tree, { modes: ["light", "dark"] }).issues, []);

  const darkless = treeOf(
    parseTokens({
      ...JSON.parse(
        await Deno.readTextFile(new URL("console.json", THEMES_DIR)),
      ),
      modes: ["dark"],
    }),
    "console.json",
  );
  assertEquals(validateTokens(darkless, { modes: ["dark"] }).issues, []);
});

Deno.test("a theme declares the modes it actually has", async () => {
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
      await Deno.readTextFile(new URL(`${name}.json`, THEMES_DIR)),
    );
    assertEquals(
      [...themeModes(doc as ThemeDocument)],
      modes,
      `${name}: the reported modes must follow from its root field`,
    );
  }
});

Deno.test("every starter's loop duration holds the strobe floor", async () => {
  // `motion.duration.slow` is what every endless animation in the system
  // spends: the skeleton's pulse and the `animate-spin` / `animate-ping` /
  // `animate-pulse` utilities. A slow step under the floor turns each of
  // them into a strobe — a defect rather than a character choice — so the
  // browser check flags the loop and this suite refuses the theme that
  // minted it.
  for (const [name, modes] of Object.entries(DECLARED_MODES)) {
    const tree = treeOf(
      parseTokens(
        await Deno.readTextFile(new URL(`${name}.json`, THEMES_DIR)),
      ),
      `${name}.json`,
    );
    for (const mode of modes) {
      const slow = valuesInMode(tree, mode).get("motion.duration.slow");
      const ms = typeof slow === "string" ? durationMs(slow) : undefined;
      assert(
        ms !== undefined,
        `${name}: motion.duration.slow must be a duration`,
      );
      assert(
        ms >= STROBE_FLOOR_MS,
        `${name} (${mode}): a ${ms}ms loop is a strobe; the floor is ${STROBE_FLOOR_MS}ms`,
      );
    }
  }
});

Deno.test("the example theme's stylesheet is a light block and a dark block", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
    "silk.json",
  );
  // The NAMED path, which is what a consumer calls. It scopes a theme's dark
  // mode to `[data-theme=<name>][data-mode="dark"]` — so the mode belongs to
  // its theme, and two themes can each carry a dark mode without fighting.
  const css = generateThemeCss({ silk: tree });

  assertEquals(
    blocks(css).map((block) => block.selector),
    ['[data-theme="silk"]', '[data-theme="silk"][data-mode="dark"]'],
  );
});

Deno.test("the light block of the example theme carries the light document's values", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
    "silk.json",
  );
  const root = blockWithSelector(generateCss(tree), ":root");

  assertEquals(root.declarations["--color-primary"], "#1c62c2");
  assertEquals(root.declarations["--color-secondary"], "#1a2434");
  assertEquals(root.declarations["--color-accent"], "#006974");
  assertEquals(root.declarations["--color-semantic-error"], "#a6312b");
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
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
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

Deno.test("the dark block emits every token the dark document declares", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
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
  assertEquals(
    Object.keys(darkBlock.declarations).sort(),
    [...declared].sort(),
  );
});

Deno.test("a dark-mode consumer reads the dark document's colors", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
    "silk.json",
  );
  const vars = varsInMode(generateCss(tree), "dark");

  assertEquals(vars["--color-primary"], "#8db9fa");
  assertEquals(vars["--color-secondary"], "#dadee5");
  assertEquals(vars["--color-accent"], "#71c7d1");
  assertEquals(vars["--color-semantic-success"], "#72cf88");
  assertEquals(vars["--color-semantic-error"], "#f38277");
  assertEquals(vars["--color-surface-raised"], "#18202a");
});

Deno.test("roles that reference the neutral ramp follow it into dark mode", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
    "silk.json",
  );
  const css = generateCss(tree);
  const lightVars = varsInMode(css, "light");
  const darkVars = varsInMode(css, "dark");

  // A surface is a reference, not a value, so the dark document never restates
  // it. Restating it is exactly what would let the two modes drift apart.
  assertEquals(lightVars["--color-surface"], "var(--color-neutral-50)");
  assertEquals(lightVars["--color-text"], "var(--color-neutral-900)");
  assertEquals(lightVars["--color-border"], "var(--color-neutral-200)");

  assertEquals(resolve(lightVars, "--color-surface"), "#f7f8fb");
  assertEquals(resolve(darkVars, "--color-surface"), "#0d121a");
  assertEquals(resolve(lightVars, "--color-text"), "#050d1c");
  assertEquals(resolve(darkVars, "--color-text"), "#f3f5f8");
  assertEquals(resolve(lightVars, "--color-border"), "#e4e8ef");
  assertEquals(resolve(darkVars, "--color-border"), "#1d242f");
});

Deno.test("spacing, typography and layering are the same scale in both modes", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
    "silk.json",
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
  assertEquals(darkVars["--radius-md"], "0.5rem");
  assertEquals(darkVars["--z-index-toast"], "3000");
  assertEquals(darkVars["--font-weight-semibold"], "600");
  assertEquals(darkVars["--breakpoint-xl"], "80rem");
  assertEquals(
    darkVars["--shadow-lg"],
    "0 16px 40px -8px rgb(15 19 30 / 0.16), 0 4px 12px -4px rgb(15 19 30 / 0.08)",
  );
  assertEquals(
    darkVars["--motion-easing-decelerate"],
    "cubic-bezier(0, 0, 0, 1)",
  );
});

Deno.test("the example theme's spacing scale grows with its step number", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
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

Deno.test("the example theme's radii round off from square to fully round", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
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

Deno.test("the example theme's breakpoints and z-index layers are ordered", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
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
  assertEquals(Number(vars["--z-index-base"]), 0);
});

Deno.test("every starter's elevation ladder ascends in every mode", async () => {
  // Three steps or none: a theme whose md and lg spell the same shadow
  // spends one elevation wearing two names, and every surface that asks for
  // "the step above the page" gets the resting picture back. The step a
  // component spends is its role — a card rests ON the page, a dialog floats
  // above it — and how loud each step is stays the theme's to state.
  //
  // A theme may also declare a FLAT ladder: two steps that both say `none`.
  // That is a decision rather than the defect above — this theme separates
  // with rules, spends no elevation on a card, and cuts only the overlay
  // out of the sheet — and it is not one shadow under two names. So the
  // ladder must never step DOWN, and a tie is allowed exactly where the
  // tied step declares no elevation at all. Two steps that spell the same
  // real shadow are still a defect, and still fail here.
  for (const name of Object.keys(starterThemes) as StarterThemeName[]) {
    const tree = treeOf(
      parseTokens(await Deno.readTextFile(new URL(`${name}.json`, THEMES_DIR))),
      `${name}.json`,
    );
    const css = generateCss(tree);
    const hasDark = tree.find((node) =>
      node.path.join(".") === "dark"
    ) !== undefined;
    const modes = hasDark ? ["light", "dark"] as const : ["light"] as const;

    for (const mode of modes) {
      const vars = varsInMode(css, mode);
      const shadows = ["sm", "md", "lg"].map((step) =>
        resolve(vars, `--shadow-${step}`)
      );
      const weights = shadows.map(shadowWeight);
      for (let i = 1; i < weights.length; i++) {
        const previous = weights[i - 1]!;
        const current = weights[i]!;
        assert(
          previous <= current,
          `${name} ${mode} shadow: ${shadows[i - 1]} must not be louder than ${
            shadows[i]
          } (index ${i})`,
        );
        assert(
          previous !== current || shadows[i - 1]!.trim() === "none",
          `${name} ${mode} shadow: ${shadows[i - 1]} and ${
            shadows[i]
          } are one elevation under two names (index ${i})`,
        );
      }
    }
  }
});

Deno.test("the example theme's text is legible on its own surfaces in both modes", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
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

Deno.test("the example theme's status colors are legible in both modes", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
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
Deno.test("every tone fill+on pair meets 4.5:1 in every shipped theme and mode", async () => {
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
      parseTokens(await Deno.readTextFile(new URL(`${name}.json`, THEMES_DIR))),
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

Deno.test("the example theme is addressable as the named 'silk' theme", async () => {
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
    "silk.json",
  );
  const css = generateThemeCss({ silk: tree });

  assertEquals(
    blocks(css).map((block) => block.selector),
    ['[data-theme="silk"]', '[data-theme="silk"][data-mode="dark"]'],
  );
  assertEquals(
    blockWithSelector(
      css,
      '[data-theme="silk"]',
    ).declarations["--color-primary"],
    "#1c62c2",
  );
  assertEquals(
    blockWithSelector(
      css,
      '[data-theme="silk"][data-mode="dark"]',
    ).declarations["--color-primary"],
    "#8db9fa",
  );
});

Deno.test("the checked-in token types are what the baseline generates", async () => {
  // `theme-types.d.ts` is a generated artifact: it says which tokens the
  // baseline carries, and a component that spends a token the artifact
  // does not name does not compile. Drift therefore surfaces as a compile
  // error in someone else's checkout, so the freshness check lives here with
  // the theme that generates it.
  const tree = treeOf(
    parseTokens(await Deno.readTextFile(new URL("silk.json", THEMES_DIR))),
    "silk.json",
  );
  const checkedIn = await Deno.readTextFile(
    new URL("../src/theme-types.d.ts", import.meta.url),
  );
  assertEquals(
    checkedIn,
    generateTypes(tree),
    "run `deno task types` in packages/theme to regenerate",
  );
});
