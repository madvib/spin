import { cssVarName, indexTree } from "@spin/theme";
import type { TokenTree } from "@spin/theme";

export interface TokenRow {
  path: string;
  variable: string;
  value: string;
}

const SECTION_PREFIXES: Record<string, string[][]> = {
  "background": [["color"]],
  "text-color": [["color"]],
  "border": [["color"]],
  "padding": [["spacing"]],
  "margin": [["spacing"]],
  "gap": [["spacing"]],
  "sizing": [["spacing"], ["breakpoint"]],
  "type-size": [["font", "size"]],
  "font": [["font", "family"], ["font", "weight"]],
  "radius": [["radius"]],
  "shadow": [["shadow"]],
  "position": [["spacing"], ["breakpoint"], ["z-index"]],
  "transitions": [["motion"]],
  "divide": [["color"]],
};

function formatValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}
export function sectionTokens(
  tree: TokenTree,
  sectionId: string,
  mode: string = "light",
): TokenRow[] {
  const prefixes = SECTION_PREFIXES[sectionId] ?? [];
  return groupTokens(tree, prefixes, mode);
}

export function groupTokens(
  tree: TokenTree,
  prefixes: string[][],
  mode: string = "light",
): TokenRow[] {
  if (prefixes.length === 0) return [];
  const index = indexTree(tree);
  const dark = mode === "dark" ? darkTokenValues(tree) : undefined;
  return Object.values(index.leaves)
    .filter((leaf) =>
      prefixes.some((prefix) =>
        prefix.every((segment, i) => leaf.path[i] === segment)
      )
    )
    .map((leaf) => {
      const path = leaf.path.join(".");
      return {
        path,
        variable: cssVarName(leaf.path),
        value: dark?.get(path) ?? formatValue(leaf.value),
      };
    });
}

function walkLeaves(
  nodes: TokenTree,
): { path: string[]; value: unknown }[] {
  const out: { path: string[]; value: unknown }[] = [];
  for (const node of nodes) {
    if (node.kind === "token") out.push(node);
    else out.push(...walkLeaves(node.children));
  }
  return out;
}

export function darkTokenValues(tree: TokenTree): Map<string, string> {
  const out = new Map<string, string>();
  for (const node of tree) {
    if (node.kind !== "group" || node.name.toLowerCase() !== "dark") continue;
    for (const leaf of walkLeaves(node.children)) {
      out.set(leaf.path.slice(1).join("."), formatValue(leaf.value));
    }
  }
  return out;
}
