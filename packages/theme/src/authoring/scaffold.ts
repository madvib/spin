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

import { BASE_ROLES } from "../contract/roles.ts";
import type { TokenLeaf, TokenTree } from "../pipeline/types.ts";

/** A role the theme layer does not own: a component's character tokens. */
export interface ExternalRole {
  readonly path: string;
  readonly type: TokenLeaf["type"];
  readonly value: string;
}

/**
 * A token tree with every role in `roles` and nothing else: no scales, no
 * ramps, no dark axis. Enough to validate and render; everything an author
 * adds from here is a decision, not backfill.
 *
 * Base roles carry their own type and placeholder, declared once in
 * `@spin/theme`. Roles the theme layer does not own — a primitive's character
 * tokens — arrive through `external`, and a role in neither list is an error:
 * a scaffold cannot invent a role it does not know.
 */
export function scaffoldTheme(
  roles?: readonly string[],
  external: readonly ExternalRole[] = [],
): TokenTree {
  const wanted = roles ?? BASE_ROLES.map((role) => role.path);
  const byPath = new Map<string, ExternalRole>(
    external.map((role) => [role.path, role]),
  );
  for (const role of BASE_ROLES) {
    if (!byPath.has(role.path)) {
      byPath.set(role.path, {
        path: role.path,
        type: role.type,
        value: role.value,
      });
    }
  }

  const byRoot = new Map<string, TokenLeaf[]>();
  for (const path of wanted) {
    const role = byPath.get(path);
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
