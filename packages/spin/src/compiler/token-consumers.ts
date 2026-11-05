/**
 * The inverse index: which components read a token.
 *
 * The manifest says what each component spends; this says, for one token,
 * who spends it — so a lint remedy and Studio answer "changing this moves N
 * components" from the probe data the manifest already carries, never from
 * a second list that could drift from it.
 */

import { primitiveContracts } from "./rules/primitives/manifest.ts";

/**
 * A token read the way the manifest spells it: the CSS variable name the
 * stylesheet spends, `--font-size-sm`. The leading dashes are optional, so a
 * caller holding a token path or a bare name asks with what it has.
 */
export function tokenConsumers(token: string): string[] {
  const bare = token.startsWith("--") ? token.slice(2) : token;
  const wanted = new Set([`--${bare}`, bare]);
  const out: string[] = [];
  for (const [name, contract] of Object.entries(primitiveContracts)) {
    if (contract.reads.some((read) => wanted.has(read))) out.push(name);
  }
  return out.sort();
}
