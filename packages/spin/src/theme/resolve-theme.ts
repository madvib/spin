/**
 * A theme, resolved: token paths to the values a mode paints.
 *
 * The CSS pipeline ends at custom properties. Code that configures itself in
 * JavaScript with literals — a Mantine theme, a Clerk appearance, chart or
 * map options — cannot read a custom property at configuration time, so it
 * keeps a hand-maintained mirror until the pipeline also answers in values.
 * This is that answer: aliases followed, mode overrides applied, one flat map.
 */
import { treeInMode } from "./modes.ts";
import { parseTokens } from "./pipeline/parse.ts";
import { resolveAliases } from "./pipeline/resolve.ts";
import type { ThemeDocument, TokenNode } from "./pipeline/types.ts";

export { expandExtends, mergeThemeDocuments } from "./extends.ts";

export interface ResolvedTheme {
  /** The mode the values describe. */
  readonly mode: string;
  /** Token path (`color.primary`, `font.family.heading`) to its value. */
  readonly values: Readonly<Record<string, unknown>>;
  /** Aliases that pointed at nothing; empty when the document is whole. */
  readonly unresolved: readonly string[];
}

/**
 * Resolve a theme document for one mode.
 *
 * Throws on a malformed document, because a caller asking for values cannot
 * be handed a partial map silently. An unresolved alias is reported rather
 * than thrown: the rest of the document is still usable, and the caller can
 * decide whether the gap matters.
 */
export function resolveTheme(
  document: ThemeDocument | string,
  mode = "light",
): ResolvedTheme {
  const parsed = parseTokens(document);
  if (!parsed.ok) throw new Error(`spin: ${parsed.error}`);
  const resolved = resolveAliases(treeInMode(parsed.tree, mode));
  const values: Record<string, unknown> = {};
  const visit = (nodes: readonly TokenNode[]): void => {
    for (const node of nodes) {
      if (node.kind === "token") {
        values[node.path.join(".")] = node.value;
      } else {
        visit(node.children);
      }
    }
  };
  visit(resolved.tree);
  return { mode, values, unresolved: resolved.unresolved };
}
