/**
 * Token tree -> CSS.
 *
 * The custom property IS the runtime API: nothing here ships JavaScript, and
 * nothing here inlines a resolved value. A `{color.primary}` alias is emitted
 * as `var(--color-primary)`, so a theme switch is a selector swap, not a
 * rebuild.
 *
 * Mode overrides live on the token itself via `$modes`: a token that carries
 * `$modes.dark` emits its override under `<selector>[data-mode="dark"]`, and a
 * token that carries `$modes.light` emits its override under
 * `<selector>[data-mode="light"]`. Light/dark are modes on a theme, not
 * separate themes: no `dark:` variant exists, and nothing sets
 * `data-theme="dark"`.
 */

import {
  aliasTarget,
  cssVarName,
  indexTree,
  type TokenIndex,
} from "./resolve.ts";
import type { CssOptions, TokenLeaf, TokenNode, TokenTree } from "./types.ts";

interface Block {
  selector: string;
  /** `[custom property, value]` in emission order. */
  declarations: [string, string][];
}

/**
 * CSS custom property for a token path.
 * `['color','brand']` with prefix `p` -> `--p-color-brand`.
 */
export { cssVarName } from "./resolve.ts";

/** Render a leaf's value as CSS text, keeping aliases as `var()` references. */
function cssValue(leaf: TokenLeaf, index: TokenIndex, prefix?: string): string {
  return valueAsCss(leaf.value, index, prefix);
}

/**
 * Render a raw value — a leaf's `$value` or one of its `$modes` entries — as
 * CSS text. Same rules either way, so a token's base and its dark value are
 * indistinguishable to the stylesheet.
 */
function valueAsCss(
  value: unknown,
  index: TokenIndex,
  prefix?: string,
): string {
  const target = aliasTarget(value);
  if (target !== null) {
    const referenced = index.nodes[target] ?? index.vars[target];
    if (referenced === undefined) return `{${target}}`;
    return `var(${cssVarName(referenced.path, prefix)})`;
  }
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  // A boolean is a switch the rules read, not a value CSS consumes: `true`
  // projects as the flag `1` and `false` projects as `0` — not silence.
  // Custom properties inherit, and the boot deck's token set stands at
  // `:root`, so an omitted answer would inherit that deck's truth instead
  // of carrying the no the theme gave. A declared `false` is the deck's
  // own answer and overrides it; only an undeclared flag is absent, which
  // is what lets a rule ask `is this decided?` and get a per-theme answer.
  if (typeof value === "boolean") return value ? "1" : "0";
  return JSON.stringify(value);
}

/** Split a tree into its base block and its two mode blocks. */
function collectBlocks(
  tree: TokenTree,
  selector: string,
  prefix: string | undefined,
  darkSelector: string,
  lightSelector: string,
): Block[] {
  const index = indexTree(tree);
  const base: Block = { selector, declarations: [] };
  const light: Block = { selector: lightSelector, declarations: [] };
  const dark: Block = { selector: darkSelector, declarations: [] };

  for (const node of tree) {
    collectLeaves(node, index, prefix, base, light, dark);
  }

  return [base, light, dark];
}

function collectLeaves(
  node: TokenNode,
  index: TokenIndex,
  prefix: string | undefined,
  into: Block,
  light: Block | undefined,
  dark: Block | undefined,
): void {
  if (node.kind === "token") {
    const name = cssVarName(node.path, prefix);
    into.declarations.push([name, cssValue(node, index, prefix)]);
    if (node.modes !== undefined) {
      const lightValue = node.modes["light"];
      if (lightValue !== undefined && light !== undefined) {
        light.declarations.push([
          name,
          valueAsCss(lightValue, index, prefix),
        ]);
      }
      const darkValue = node.modes["dark"];
      if (darkValue !== undefined && dark !== undefined) {
        dark.declarations.push([
          name,
          valueAsCss(darkValue, index, prefix),
        ]);
      }
    }
    return;
  }
  for (const child of node.children) {
    collectLeaves(child, index, prefix, into, light, dark);
  }
}

function renderBlock(block: Block, indent: string): string {
  const body = block.declarations
    .filter(([, value]) => value !== "")
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join("\n");
  return `${block.selector} {\n${body}\n}`;
}

/**
 * Generate the stylesheet for one token tree.
 *
 * Emits the base block under `opts.selector` (default `:root`), and beside it
 * the mode blocks: `<selector>[data-mode="light"]` for the values a token
 * restates for the light mode, `<selector>[data-mode="dark"]` for the dark
 * ones. Empty blocks are omitted, so a document that restates nothing for a
 * mode ships no block for it.
 */
export function generateCss(tree: TokenTree, opts: CssOptions = {}): string {
  const indent = opts.indent ?? "  ";
  const selector = opts.selector ?? ":root";
  const blocks = collectBlocks(
    tree,
    selector,
    opts.prefix,
    `${selector}[data-mode="dark"]`,
    `${selector}[data-mode="light"]`,
  );
  const base = blocks[0];
  if (base !== undefined) {
    const dark = blocks[2];
    const modes = dark !== undefined && dark.declarations.length > 0 ? "light dark" : "light";
    base.declarations.unshift(["--spin-modes", modes]);
  }
  const tokenCss = blocks
    .filter((block) => block.declarations.length > 0)
    .map((block) => renderBlock(block, indent))
    .join("\n\n");
  return tokenCss;
}

/**
 * Generate one stylesheet covering several named themes.
 *
 * Each theme is emitted under `[data-theme="<name>"]`. A theme that carries its
 * own `dark` group also gets a `[data-theme="<name>"][data-mode="dark"]`
 * override block, so a per-theme dark mode does not fight the global one.
 */
export function generateThemeCss(
  themes: Record<string, TokenTree>,
  opts: CssOptions = {},
): string {
  const indent = opts.indent ?? "  ";
  const chunks: string[] = [];

  // The root theme first, so a later scoped block overrides it: the same
  // specificity rule that makes a theme swap a selector swap.
  //
  // And the root theme's blocks are DEFAULTS — `:where()`, so they carry no
  // specificity of their own. A theme in force must beat them, or a project
  // theme's base loses to the root theme's dark block (which is a selector
  // and an attribute, and so is stronger than a bare attribute selector) and
  // the project theme renders the starter's palette instead of its own. With
  // the root theme as a default, the rule holds for every theme: a mode a
  // theme serves but does not override falls back to that theme's own base.
  if (opts.rootTheme !== undefined && themes[opts.rootTheme] !== undefined) {
    const names = Object.keys(themes).join(" ");
    chunks.push(`:where(:root) {\n${indent}--spin-themes: ${names};\n}`);
    for (
      const block of collectBlocks(
        themes[opts.rootTheme] as TokenTree,
        ":where(:root)",
        opts.prefix,
        ':where(:root[data-mode="dark"])',
        ':where(:root[data-mode="light"])',
      )
    ) {
      if (block.declarations.length === 0) continue;
      chunks.push(renderBlock(block, indent));
    }
  }

  for (const name of Object.keys(themes)) {
    const tree = themes[name] as TokenTree;
    const selector = `[data-theme="${name}"]`;
    const blocks = collectBlocks(
      tree,
      selector,
      opts.prefix,
      `${selector}[data-mode="dark"]`,
      `${selector}[data-mode="light"]`,
    );
    const base = blocks[0];
    const dark = blocks[2];
    if (base !== undefined) {
      const declared = opts.modes?.[name]?.join(" ");
      const modes = declared !== undefined && declared.length > 0
        ? declared
        : dark !== undefined && dark.declarations.length > 0
        ? "light dark"
        : "light";
      base.declarations.unshift(["--spin-modes", modes]);
    }
    for (const block of blocks) {
      if (block.declarations.length === 0) continue;
      chunks.push(renderBlock(block, indent));
    }
  }

  return chunks.join("\n\n");
}

/** Every token leaf in a tree in declaration order. */
function baseLeaves(tree: TokenTree): TokenLeaf[] {
  const out: TokenLeaf[] = [];
  for (const node of tree) {
    collectLeafNodes(node, out);
  }
  return out;
}

function collectLeafNodes(node: TokenNode, out: TokenLeaf[]): void {
  if (node.kind === "token") {
    out.push(node);
    return;
  }
  for (const child of node.children) collectLeafNodes(child, out);
}

/**
 * Generate TypeScript declarations for a token tree.
 *
 * Emits an interface from DTCG path to the value CSS will resolve to, plus the
 * two unions a consumer needs: the token paths themselves, and the custom
 * property names they are read through. A top-level `dark` group re-declares
 * existing tokens for dark mode rather than adding new ones, so it is omitted.
 */
export function generateTypes(tree: TokenTree): string {
  const leaves = baseLeaves(tree);

  const fields = leaves.map((leaf) => {
    const literal =
      typeof leaf.value === "string" || typeof leaf.value === "number"
        ? JSON.stringify(leaf.value)
        : "unknown";
    return `  ${JSON.stringify(leaf.path.join("."))}: ${literal};`;
  });

  const paths =
    leaves.map((leaf) => JSON.stringify(leaf.path.join("."))).join(" | ") ||
    "never";
  const vars =
    leaves.map((leaf) => JSON.stringify(cssVarName(leaf.path))).join(" | ") ||
    "never";

  const dark = leaves.some((leaf) => leaf.modes?.["dark"] !== undefined);
  const light = leaves.some((leaf) => leaf.modes?.["light"] !== undefined);

  return [
    "// Generated by @spinjs/spin/theme. Do not edit by hand.",
    "",
    "/** Every token in the document, by DTCG path, with the value CSS resolves to. */",
    "export interface ThemeTokens {",
    ...fields,
    "}",
    ...(dark
      ? [
        "",
        "/**",
        " * These same tokens are re-declared for dark mode under",
        ' * `[data-mode="dark"]`; the path and custom property are unchanged, only',
        " * the resolved value differs.",
        " */",
      ]
      : []),
    ...(light
      ? [
        "",
        "/**",
        " * These same tokens are re-declared for light mode under",
        ' * `[data-mode="light"]`; the path and custom property are unchanged, only',
        " * the resolved value differs.",
        " */",
      ]
      : []),
    "",
    "/** DTCG paths of every token — the keys of `ThemeTokens`. */",
    `export type ThemeTokenPath = ${paths}`,
    "",
    "/** CSS custom properties every token is readable through. */",
    `export type ThemeCssVar = ${vars}`,
    "",
  ].join("\n");
}
