import type { TokenRow } from "./tokens.ts";

/**
 * How an element overrides its type: the override group's leaves. Those are
 * the only fields the table writes, so anything else the element carries
 * (line height, tracking) lives in the token but never touches the form.
 */
export interface ElementOverride {
  face?: string;
  size?: string;
  weight?: string;
}

const FIELDS: readonly { key: keyof ElementOverride; type: string }[] = [
  { key: "face", type: "string" },
  { key: "size", type: "string" },
  { key: "weight", type: "string" },
];

/**
 * The override an element carries, read from its `font.element.<tag>` leaves.
 *
 * `faceFor` and `elementTypeFor` used to read a single `font.element.<tag>`
 * JSON blob — the shape the page once wrote, and the shape the contract does
 * not have: `font.element.h1` is a GROUP whose leaves are the properties.
 * Reading now means walking the leaves, and a theme that never carried an
 * override (most of them) reads as "no override" rather than as a parse
 * error.
 */
export function elementOverrides(
  rows: readonly TokenRow[],
  tag: string,
): ElementOverride {
  const result: ElementOverride = {};
  for (const field of FIELDS) {
    const path = `font.element.${tag}.${field.key}`;
    const row = rows.find((candidate) => candidate.path === path);
    if (row !== undefined) {
      (result as Record<string, unknown>)[field.key] = row.value;
    }
  }
  return result;
}

/**
 * The writes a change needs, against the leaves that already exist.
 *
 * A field the element already owns lands as an edit; one it has never
 * specified would need the leaf minted first, and the `exists` flag says so.
 * A field left unset contributes nothing: the group keeps what it had.
 */
export function overrideWrites(
  rows: readonly TokenRow[],
  tag: string,
  change: Partial<ElementOverride>,
): { path: readonly string[]; type: string; value: string; exists: boolean }[] {
  const out: {
    path: readonly string[];
    type: string;
    value: string;
    exists: boolean;
  }[] = [];
  for (const field of FIELDS) {
    const key = field.key;
    const value = change[key];
    if (value === undefined) continue;
    const path = ["font", "element", tag, key];
    const exists = rows.some(
      (row) => row.path === path.join("."),
    );
    out.push({
      path,
      type: field.type,
      value: String(value),
      exists,
    });
  }
  return out;
}
