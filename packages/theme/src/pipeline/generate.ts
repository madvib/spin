/**
 * Token tree -> CSS.
 *
 * The custom property IS the runtime API: nothing here ships JavaScript, and
 * nothing here inlines a resolved value. A `{color.primary}` alias is emitted
 * as `var(--color-primary)`, so a theme switch is a selector swap, not a
 * rebuild.
 *
 * A top-level group named `dark` is the dark override set. It is emitted as a
 * second block under `:root[data-theme="dark"]` with the leading `dark` segment
 * dropped, so `dark.color.brand` overrides `--color-brand` rather than defining
 * a second, dead variable. Its tokens are not repeated in the base block.
 */

import {
  aliasTarget,
  cssVarName,
  indexTree,
  type TokenIndex,
} from "./resolve.ts";
import type { CssOptions, TokenLeaf, TokenNode, TokenTree } from "./types.ts";

/** Selector a top-level `dark` group's overrides are written under. */
const DARK_SELECTOR = ':root[data-theme="dark"]';

/** Name of the group that holds dark overrides. */
const DARK_GROUP = "dark";

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
  const target = aliasTarget(leaf.value);
  if (target !== null) {
    const referenced = index.nodes[target] ?? index.vars[target];
    if (referenced === undefined) return `{${target}}`;
    return `var(${cssVarName(referenced.path, prefix)})`;
  }
  if (typeof leaf.value === "string") return leaf.value;
  if (typeof leaf.value === "number") return String(leaf.value);
  return JSON.stringify(leaf.value);
}

/** Split a tree into its base block and its dark override block. */
function collectBlocks(
  tree: TokenTree,
  selector: string,
  prefix: string | undefined,
  darkSelector: string,
): Block[] {
  const index = indexTree(tree);
  const base: Block = { selector, declarations: [] };
  const dark: Block = { selector: darkSelector, declarations: [] };

  for (const node of tree) {
    const isDarkRoot = node.kind === "group" &&
      node.name.toLowerCase() === DARK_GROUP;
    collectLeaves(
      node,
      index,
      prefix,
      isDarkRoot ? dark : base,
      // The dark root is a VARIANT, not a namespace: strip its own segment so
      // `dark.color.brand` lands on the same property as `color.brand`.
      isDarkRoot,
    );
  }

  return [base, dark];
}

function collectLeaves(
  node: TokenNode,
  index: TokenIndex,
  prefix: string | undefined,
  block: Block,
  stripRoot: boolean,
): void {
  if (node.kind === "token") {
    const path = stripRoot ? node.path.slice(1) : node.path;
    block.declarations.push([
      cssVarName(path, prefix),
      cssValue(node, index, prefix),
    ]);
    return;
  }
  for (const child of node.children) {
    collectLeaves(child, index, prefix, block, stripRoot);
  }
}

function renderBlock(block: Block, indent: string): string {
  const body = block.declarations
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join("\n");
  return `${block.selector} {\n${body}\n}`;
}

/**
 * Generate the stylesheet for one token tree.
 *
 * Emits the base block under `opts.selector` (default `:root`) and, when the
 * tree has a top-level `dark` group, an override block under
 * `:root[data-theme="dark"]`. Empty blocks are omitted.
 */
export function generateCss(tree: TokenTree, opts: CssOptions = {}): string {
  const indent = opts.indent ?? "  ";
  const blocks = collectBlocks(
    tree,
    opts.selector ?? ":root",
    opts.prefix,
    DARK_SELECTOR,
  );
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

  for (const name of Object.keys(themes)) {
    const tree = themes[name] as TokenTree;
    const selector = `[data-theme="${name}"]`;
    const blocks = collectBlocks(
      tree,
      selector,
      opts.prefix,
      `${selector}[data-mode="dark"]`,
    );
    for (const block of blocks) {
      if (block.declarations.length === 0) continue;
      chunks.push(renderBlock(block, indent));
    }
  }

  return chunks.join("\n\n");
}

/**
 * Every base leaf of a tree, i.e. everything except the top-level `dark`
 * variant subtree.
 *
 * `dark.color.brand` re-declares the SAME token as `color.brand` for another
 * mode; it is not a second token, and listing it would both duplicate a key
 * and advertise a custom property (`--dark-color-brand`) that never exists.
 */
function baseLeaves(tree: TokenTree): TokenLeaf[] {
  const out: TokenLeaf[] = [];
  for (const node of tree) {
    if (node.kind === "group" && node.name.toLowerCase() === DARK_GROUP) {
      continue;
    }
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

  const dark = tree.some((node) =>
    node.kind === "group" && node.name.toLowerCase() === DARK_GROUP
  );

  return [
    "// Generated by @spin/theme. Do not edit by hand.",
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
        ' * `[data-theme="dark"]`; the path and custom property are unchanged, only',
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
