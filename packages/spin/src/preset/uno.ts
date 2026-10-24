/**
 * Token tree -> UnoCSS theme object.
 *
 * The Uno theme is a derived view, never a second source of truth: values are
 * the resolved token values (aliases inlined) so ecosystem tooling reads real
 * colors and lengths, and a top-level `dark` group is omitted because it
 * re-declares existing tokens for another mode rather than adding new ones.
 */

import { LOOP_STEP, resolveAliases } from "../theme/index.ts";
import type { TokenLeaf, TokenNode, TokenTree } from "../theme/index.ts";

export interface UnoTheme {
  colors: Record<string, unknown>;
  spacing: Record<string, string>;
  fontSize: Record<string, string>;
  fontFamily: Record<string, string>;
  fontWeight: Record<string, string>;
  radius: Record<string, string>;
  shadow: Record<string, string>;
  breakpoint: Record<string, string>;
  zIndex: Record<string, string>;
  transitionDuration: Record<string, string>;
  transitionTimingFunction: Record<string, string>;
}

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

function nest(
  root: Record<string, unknown>,
  path: string[],
  value: string,
): void {
  let node = root;
  for (const segment of path.slice(0, -1)) {
    const next = node[segment];
    if (typeof next !== "object" || next === null) {
      node[segment] = {};
    }
    node = node[segment] as Record<string, unknown>;
  }
  node[path[path.length - 1] as string] = value;
}

/**
 * Map a token tree onto the UnoCSS theme shape.
 *
 * Colors nest by token path (`color.neutral.50` -> `colors.neutral["50"]`);
 * every other group lands flat under its Uno key (`spacing.4` ->
 * `spacing["4"]`, `motion.duration.base` -> `transitionDuration["base"]`).
 */
export function toUnoTheme(tree: TokenTree): UnoTheme {
  const theme: UnoTheme = {
    colors: {},
    spacing: {},
    fontSize: {},
    fontFamily: {},
    fontWeight: {},
    radius: {},
    shadow: {},
    breakpoint: {},
    zIndex: {},
    transitionDuration: {},
    transitionTimingFunction: {},
  };
  const resolved = resolveAliases(tree).tree;
  for (const node of resolved) {
    if (node.kind === "group" && node.name.toLowerCase() === "dark") continue;
    const leaves = node.kind === "token" ? [node] : walk(node.children);
    for (const leaf of leaves) {
      const [root, ...rest] = leaf.path;
      const value = textValue(leaf.value);
      if (root === "color" && rest.length > 0) {
        nest(theme.colors, rest.map((s) => s.toLowerCase()), value);
      } else if (root === "spacing" && rest.length === 1) {
        theme.spacing[rest[0] as string] = value;
      } else if (root === "font" && rest[0] === "size" && rest.length === 2) {
        theme.fontSize[rest[1] as string] = value;
      } else if (root === "font" && rest[0] === "family" && rest.length === 2) {
        theme.fontFamily[rest[1] as string] = value;
      } else if (root === "font" && rest[0] === "weight" && rest.length === 2) {
        theme.fontWeight[rest[1] as string] = value;
      } else if (root === "radius" && rest.length === 1) {
        theme.radius[rest[0] as string] = value;
      } else if (root === "shadow" && rest.length === 1) {
        theme.shadow[rest[0] as string] = value;
      } else if (root === "breakpoint" && rest.length === 1) {
        theme.breakpoint[rest[0] as string] = value;
      } else if (root === "z-index" && rest.length === 1) {
        theme.zIndex[rest[0] as string] = value;
      } else if (
        root === "motion" && rest[0] === "duration" && rest.length === 2
      ) {
        // The loop is a duration but not a transition's: the Uno shape has no
        // slot for the period of an endless animation, and putting it where a
        // transition's duration goes is how `duration-loop` became a
        // transition. The loop is spent off the custom property instead.
        if (rest[1] === LOOP_STEP) continue;
        theme.transitionDuration[rest[1] as string] = value;
      } else if (
        root === "motion" && rest[0] === "easing" && rest.length === 2
      ) {
        theme.transitionTimingFunction[rest[1] as string] = value;
      }
    }
  }
  return theme;
}

function walk(nodes: TokenNode[]): TokenLeaf[] {
  const out: TokenLeaf[] = [];
  for (const node of nodes) {
    if (node.kind === "token") out.push(node);
    else out.push(...walk(node.children));
  }
  return out;
}
