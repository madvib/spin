import {
  BASE_ROLES,
  requiredPaths,
  scaffoldTheme,
  treeToJson,
} from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import { primitiveContracts } from "@spin/primitives";
import type { CharacterToken } from "@spin/primitives";

/**
 * The roles a theme must declare for the named components: the base roles
 * first, then each component's character tokens in the order the components
 * are named, deduplicated. Unknown component names contribute nothing.
 *
 * Both halves are declarations rather than string lists — the base roles from
 * `@spin/theme`, the character tokens from each primitive's manifest — so a
 * token added to either is required by the same change that added it.
 */
export function requiredRolesFor(components: readonly string[]): string[] {
  const roles = [...requiredPaths()];
  const seen = new Set(roles);
  for (const name of components) {
    for (const token of characterTokensFor(name)) {
      if (seen.has(token.path)) continue;
      seen.add(token.path);
      roles.push(token.path);
    }
  }
  return roles;
}

/** Every role in the full surface, for a theme that enables every primitive. */
export function allRequiredRoles(): string[] {
  return requiredRolesFor(Object.keys(primitiveContracts));
}

/** The character tokens one component declares. Unknown names yield none. */
function characterTokensFor(name: string): readonly CharacterToken[] {
  return primitiveContracts[name]?.character ?? [];
}

/**
 * The minimal valid theme for the named components: every required role, no
 * scales. Omitted components means all of them — the full surface a consumer
 * gets by default.
 */
export function scaffold(components?: readonly string[]): TokenTree {
  const names = components ?? Object.keys(primitiveContracts);
  const external = names.flatMap(characterTokensFor);
  return scaffoldTheme(requiredRolesFor(names), external);
}

/**
 * The same scaffold as a document, which is what `spinPreset` takes. A theme
 * carries more than tokens — `$extensions.spin.fonts` declares what to load —
 * so the document is the unit the preset consumes and the tree is the derived
 * view of it.
 */
export function scaffoldDocument(
  components?: readonly string[],
): Record<string, unknown> {
  return JSON.parse(treeToJson(scaffold(components))) as Record<
    string,
    unknown
  >;
}

/** The base role declarations, re-exported so callers need one import. */
export { BASE_ROLES };
