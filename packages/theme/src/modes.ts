/**
 * Modes: what a theme declares, and what any token in it is worth.
 *
 * A mode is a *variant of a token*, not a second theme and not a group beside
 * one. `modes` at the document root says which modes the theme SERVES;
 * `$modes` on a token says how that token varies. Everything else about a
 * theme — spacing, type, radius, shadow — is mode-invariant, which is a
 * design fact rather than an accident: dark mode changes ink and surface,
 * not space.
 *
 * One meaning, everywhere: the root field is the set of modes the theme
 * answers to. A mode it serves but does not override falls back to the base
 * values, so a dark-only theme whose base is already dark is a complete
 * theme — it serves dark, and it has nothing to restate. The other side of
 * the same rule: a value written for a mode the theme does not serve is
 * never shown, so the validator reports it.
 *
 * These two questions are the ones a consumer actually asks, and they belong
 * here rather than in each consumer: "what modes does this theme serve?", and
 * "what is this token worth in that mode?".
 */

import type { TokenTree } from "./pipeline/types.ts";
import type { TokenLeaf } from "./pipeline/types.ts";

/** A raw theme document, as authored. */
type ThemeDocument = Record<string, unknown>;

/** The modes a document serves, as declared at its root. */
export type Mode = "light" | "dark";

/**
 * Every mode the system serves, as a runtime list.
 *
 * The union above derives from nothing at runtime, and the wire needs a
 * value: the contract's picklists read this, so a mode cannot exist in the
 * type and not in what a validator accepts.
 */
export const MODES: readonly Mode[] = ["light", "dark"];

/**
 * The modes a theme serves.
 *
 * Read from the root `modes` field, never derived from a group's presence:
 * existence could not tell a base-that-is-dark from a theme that never
 * declares one, which is the conflation that produced a `dark` group
 * restating a console base and adding nothing. No field means no claim.
 */
export function themeModes(theme: ThemeDocument): readonly Mode[] {
  const raw = theme["modes"];
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is Mode =>
    entry === "light" || entry === "dark"
  );
}

/** Whether a theme renders both ways. */
export function supportsDark(theme: ThemeDocument): boolean {
  return themeModes(theme).includes("dark");
}

/** Every leaf in a tree, depth-first. */
function leavesOf(tree: TokenTree): readonly TokenLeaf[] {
  const out: TokenLeaf[] = [];
  const walk = (node: TokenTree[number]): void => {
    if (node.kind === "token") {
      out.push(node);
      return;
    }
    for (const child of node.children) walk(child);
  };
  for (const node of tree) walk(node);
  return out;
}

/**
 * What every token is worth in one mode, keyed by its dotted path.
 *
 * A token's `$modes.<mode>` takes precedence over its `$value`; a token that
 * does not vary is worth its base value in every mode, which is what makes
 * "everything else is mode-invariant" a fact rather than a convention. This
 * is the same rule the emitter applies, so a consumer reading this map and the
 * emitted stylesheet cannot disagree.
 */
export function valuesInMode(
  tree: TokenTree,
  mode: string,
): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const leaf of leavesOf(tree)) {
    const override = leaf.modes?.[mode];
    out.set(leaf.path.join("."), override ?? leaf.value);
  }
  return out;
}
