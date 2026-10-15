/**
 * Token tree -> CSS.
 *
 * The custom property IS the runtime API: nothing here ships JavaScript, and
 * nothing here inlines a resolved value. A `{color.primary}` alias is emitted
 * as `var(--color-primary)`, so a theme switch is a selector swap, not a
 * rebuild.
 *
 * A top-level group named `dark` is the dark override set. It is emitted as a
 * second block under `<selector>[data-mode="dark"]` with the leading `dark`
 * segment dropped, so `dark.color.brand` overrides `--color-brand` rather
 * than defining a second, dead variable. Light/dark are modes on a theme, not
 * themes: no `dark:` variant exists, and nothing sets `data-theme="dark"`.
 * Its tokens are not repeated in the base block.
 */

import {
  aliasTarget,
  cssVarName,
  indexTree,
  type TokenIndex,
} from "./resolve.ts";
import type { CssOptions, TokenLeaf, TokenNode, TokenTree } from "./types.ts";

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
  // emits as the flag `1` and `false` emits as nothing. A false flag is
  // absence — the same shape a missing token has — which is what lets a rule
  // ask `is this declared?` and get a per-theme answer.
  if (typeof value === "boolean") return value ? "1" : "";
  return JSON.stringify(value);
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
    // The `dark` root is a VARIANT, not a namespace: strip its own segment so
    // `dark.color.brand` lands on the same property as `color.brand`. A token
    // carrying its own `$modes` does the same job from inside itself, so both
    // spellings emit identical CSS — which is the migration's contract.
    collectLeaves(
      node,
      index,
      prefix,
      isDarkRoot ? dark : base,
      dark,
      isDarkRoot,
    );
  }

  return [base, dark];
}

function collectLeaves(
  node: TokenNode,
  index: TokenIndex,
  prefix: string | undefined,
  into: Block,
  dark: Block | undefined,
  stripRoot: boolean,
): void {
  if (node.kind === "token") {
    const path = stripRoot ? node.path.slice(1) : node.path;
    into.declarations.push([
      cssVarName(path, prefix),
      cssValue(node, index, prefix),
    ]);
    // A token's own mode values land in the mode block beside its base, which
    // is what lets the `dark` group go away without changing a byte of
    // emitted CSS.
    if (node.modes !== undefined && dark !== undefined) {
      const value = node.modes[DARK_GROUP];
      if (value !== undefined) {
        dark.declarations.push([
          cssVarName(path, prefix),
          valueAsCss(value, index, prefix),
        ]);
      }
    }
    return;
  }
  for (const child of node.children) {
    collectLeaves(child, index, prefix, into, dark, stripRoot);
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
 * Emits the base block under `opts.selector` (default `:root`) and, when the
 * tree has a top-level `dark` group, an override block under
 * `<selector>[data-mode="dark"]`. Empty blocks are omitted.
 */
export function generateCss(tree: TokenTree, opts: CssOptions = {}): string {
  const indent = opts.indent ?? "  ";
  const selector = opts.selector ?? ":root";
  const blocks = collectBlocks(
    tree,
    selector,
    opts.prefix,
    `${selector}[data-mode="dark"]`,
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

  // The root theme first, so a later scoped block overrides it: the same
  // specificity rule that makes a theme swap a selector swap.
  if (opts.rootTheme !== undefined && themes[opts.rootTheme] !== undefined) {
    for (
      const block of collectBlocks(
        themes[opts.rootTheme] as TokenTree,
        ":root",
        opts.prefix,
        ':root[data-mode="dark"]',
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
        ' * `[data-mode="dark"]`; the path and custom property are unchanged, only',
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
