import { contrastRatio } from "../pipeline/color.ts";
import { indexTree, resolveAliases } from "../pipeline/resolve.ts";
import type { TokenTree, ValidationIssue } from "../pipeline/types.ts";
import { legibilityFloors, themeSchema } from "./roles.ts";

/**
 * The JSON Schema for a theme document.
 *
 * Derived from the role declarations rather than written out, so a role added
 * to `BASE_ROLES` is required by the schema and validated by the contract in
 * the same change.
 */
export function spinThemeJsonSchema(): Record<string, unknown> {
  return themeSchema();
}

/** Contrast of every declared floor against the resolved base values. */
export function validateLegibility(tree: TokenTree): ValidationIssue[] {
  const index = indexTree(resolveAliases(tree).tree);
  const issues: ValidationIssue[] = [];
  for (const { fg, bg, min } of legibilityFloors()) {
    const fgValue = index.leaves[fg]?.value;
    const bgValue = index.leaves[bg]?.value;
    if (typeof fgValue !== "string" || typeof bgValue !== "string") continue;
    let ratio: number;
    try {
      ratio = contrastRatio(fgValue, bgValue);
    } catch {
      continue;
    }
    if (ratio < min) {
      const fgShort = fg.startsWith("color.") ? fg.slice("color.".length) : fg;
      const bgShort = bg.startsWith("color.") ? bg.slice("color.".length) : bg;
      issues.push({
        path: fg,
        message: `${fgShort} on ${bgShort} is ${
          ratio.toFixed(2)
        }:1 — text needs ${min}:1`,
      });
    }
  }
  return issues;
}
