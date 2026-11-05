/**
 * The groups a theme document declares.
 *
 * A theme is a document of groups, and the groups are its vocabulary: the
 * scales it spends, the machinery it states, and the per-element groups where
 * one element is styled independently of the scales it otherwise wears. Two
 * places ask for that list — the house skill's checklist and the schema page
 * — and they have to be the same list, so it is emitted here rather than
 * written down twice.
 *
 * The order is the order a document reads. The groups the documents declare
 * come first, in the order they declare them, because that is the order an
 * author fills a document in. A group the contract knows and no document
 * states is still a group a theme may declare, so it is added at the end
 * rather than dropped: the contract is the owned set, and the documents are one
 * expression of it.
 */

import { ELEMENT_ROLES } from "./elements.ts";
import { BASE_ROLES } from "./roles.ts";
import type { ThemeDocument } from "../pipeline/types.ts";

/** The document keys that are metadata rather than token groups. */
const METADATA = new Set(["modes", "$extensions", "$description", "$schema"]);

/**
 * The groups the contract declares, in the order the contract lists them.
 *
 * The base roles come first — the palette, the faces and the focus ring every
 * interactive element shares — and the per-element groups after them, in the
 * order the elements were added.
 */
export function contractGroups(): readonly string[] {
  const groups: string[] = [];
  for (const role of BASE_ROLES) {
    const group = role.path.split(".")[0] as string;
    if (!groups.includes(group)) groups.push(group);
  }
  for (const role of ELEMENT_ROLES) {
    if (!groups.includes(role.group)) groups.push(role.group);
  }
  return groups;
}

/**
 * The groups one document declares, in the order the document reads them.
 *
 * `dark` is not among them: a mode is a variant of a token, not a group
 * beside one, so a document that spells its dark side as a top-level group
 * has still declared one mode rather than one more group.
 */
export function documentGroups(
  document: ThemeDocument,
): readonly string[] {
  const groups: string[] = [];
  for (const key of Object.keys(document)) {
    if (METADATA.has(key) || key.startsWith("$")) continue;
    if (key.toLowerCase() === "dark") continue;
    groups.push(key);
  }
  return groups;
}

/**
 * The groups a theme owns: what its documents declare, and then what the
 * contract declares and no document states.
 *
 * The documents come first because their order is the order a theme document
 * reads. The contract's groups are added after them so a group the contract
 * knows is never missing from the list — the list is what the house skill's
 * checklist walks, and a group nobody walks is a group nobody fills.
 */
export function themeGroups(
  documents: readonly ThemeDocument[],
): readonly string[] {
  const groups: string[] = [];
  const seen = new Set<string>();
  for (const document of documents) {
    for (const group of documentGroups(document)) {
      if (seen.has(group)) continue;
      seen.add(group);
      groups.push(group);
    }
  }
  for (const group of contractGroups()) {
    if (seen.has(group)) continue;
    seen.add(group);
    groups.push(group);
  }
  return groups;
}
