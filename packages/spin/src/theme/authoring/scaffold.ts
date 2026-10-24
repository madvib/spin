/**
 * The smallest theme that satisfies the contract.
 *
 * One consumer, three call sites: the preset falls back to it when given no
 * input, the studio seeds it for "new theme", and tests build fixtures from
 * it. A single function rather than three copies, so they cannot disagree
 * about what "minimal but valid" means.
 *
 * Every value is a neutral placeholder an author must replace — the scaffold
 * validates, but it is deliberately ugly. A theme that looks finished was not
 * scaffolded; it was authored.
 */

import { ELEMENT_ROLES } from "../contract/elements.ts";
import { BASE_ROLES } from "../contract/roles.ts";
import type { TokenLeaf, TokenTree, TokenType } from "../pipeline/types.ts";

/** A declaration a scaffold can write: the path, the type, the value. */
interface Scaffoldable {
  readonly path: string;
  readonly type: TokenType;
  readonly value: string | number | boolean;
}

/** Every declaration a scaffold knows, base roles first. */
function declarations(): readonly Scaffoldable[] {
  return [...BASE_ROLES, ...ELEMENT_ROLES];
}

/**
 * A token tree with every role in `roles` and nothing else: no scales, no
 * ramps, no dark axis. Enough to validate and render; everything an author
 * adds from here is a decision, not backfill.
 *
 * With no `roles`, the scaffold carries the whole surface the contract
 * knows: the base roles a theme must declare, and the per-element tokens the
 * elements spend. A theme that omits a per-element token is still valid —
 * the rules fall back to the shared scales — but a scaffold is the document
 * an author edits, and an author should meet the decisions rather than the
 * gaps. The studio writes this document when a theme is created, so the
 * per-element groups arrive with it.
 *
 * Base and per-element roles carry their own type and placeholder, declared
 * once in `@spinjs/theme`. A path that is neither is an error: a scaffold
 * cannot invent a role it does not know.
 */
export function scaffoldTheme(roles?: readonly string[]): TokenTree {
  const known = declarations();
  const wanted = roles ?? known.map((role) => role.path);
  const byRoot = new Map<string, TokenLeaf[]>();
  for (const path of wanted) {
    const role = known.find((candidate) => candidate.path === path);
    if (role === undefined) {
      throw new Error(
        `scaffoldTheme: no declaration for required role ${path}`,
      );
    }
    const segments = path.split(".");
    const leaf: TokenLeaf = {
      kind: "token",
      name: segments[segments.length - 1] as string,
      path: segments,
      type: role.type,
      value: role.value,
    };
    const root = segments[0] as string;
    byRoot.set(root, [...(byRoot.get(root) ?? []), leaf]);
  }
  return [...byRoot.entries()].map(([root, leaves]) => ({
    kind: "group" as const,
    name: root,
    path: [root],
    children: leaves,
  }));
}
