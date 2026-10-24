/**
 * The colours page's facts: the families, the roles, and what a role is
 * worth in each mode.
 *
 * The theme module owns the roles a theme owes and the floors they must
 * clear, so this module asks it rather than keeping a second list: the
 * contract's declaration is the one authority on what a role is for, and a
 * role added to the contract lands on the page without the page learning
 * its name. What this module adds is the READING: which family a role
 * belongs to, whether its value is set or computed, and the hex the value
 * is worth.
 *
 * The hex is worth a word. A theme may write `oklch(…)`, and a value an
 * author cannot paste into a stylesheet is a value they convert by hand
 * every time. So every resolved colour is given as hex as well: the theme
 * module knows the colour spaces, and the page asks it rather than
 * guessing at a conversion of its own.
 */

import {
  aliasTarget,
  BASE_ROLES,
  indexTree,
  toHex,
  valuesInMode,
} from "@spinjs/theme";
import type { TokenLeaf, TokenTree } from "@spinjs/theme";
import { tokenValue } from "./overview.ts";

/** The three families a theme's colours fall into. */
export type Family = "brand" | "neutral" | "status";

/** The families, in the order the page shows them. */
export const FAMILIES: readonly Family[] = ["brand", "neutral", "status"];

/** What each family is for, in one line. */
export const FAMILY_NOTES: Readonly<Record<Family, string>> = {
  brand:
    "The colours the product wears: the action, the second action, the emphasis, the link.",
  neutral: "The surfaces and the inks everything else is drawn on.",
  status: "What the interface says about the state of the world.",
};

/** What each family is called on the page. */
export const FAMILY_TITLES: Readonly<Record<Family, string>> = {
  brand: "Brand",
  neutral: "Neutral",
  status: "Status",
};

/** The contract's own words for a role, keyed by the path it declares. */
const DOCS = new Map(BASE_ROLES.map((role) => [role.path, role.doc]));

/**
 * The colours a theme PICKS.
 *
 * A theme chooses its brand colours the way it chooses a hue — they are
 * fills, not jobs — so they are named here, and the inks that sit on them
 * travel with them.
 */
const PICKS = new Set(["primary", "secondary", "accent", "link"]);

/** The inks that sit on a brand fill, and so belong to the brand. */
const BRAND_INKS = new Set(["on-primary", "on-secondary", "on-accent"]);

/** The order each family reads in: what a palette is read by. */
const ORDER: Readonly<Record<Family, readonly string[]>> = {
  brand: [
    "primary",
    "secondary",
    "accent",
    "link",
    "on-primary",
    "on-secondary",
    "on-accent",
  ],
  neutral: [
    "surface",
    "surface-raised",
    "surface-sunken",
    "field",
    "border",
    "border-strong",
    "text",
    "text-muted",
    "focus-ring",
    "disabled",
    "on-disabled",
  ],
  status: [
    "semantic.success",
    "semantic.warning",
    "semantic.error",
    "semantic.info",
    "on-semantic-success",
    "on-semantic-warning",
    "on-semantic-error",
    "on-semantic-info",
  ],
};

/** One slot's value for one role. */
export interface RoleValue {
  /** The value as the document holds it: a literal, or a reference. */
  readonly raw: string;
  /** Whether the value points at another token. */
  readonly computed: boolean;
  /** The token it points at, when it points at one. */
  readonly reference: string | null;
  /** The colour it resolves to. */
  readonly value: string | null;
  /** The colour as hex — the spelling an author copies. */
  readonly hex: string | null;
}

/** One role: a job the interface has, and what it is worth. */
export interface Role {
  /** The dotted path the theme declares it by. */
  readonly path: string;
  /** The name of the role, as the path spells it below `color`. */
  readonly name: string;
  /** What the role is for. */
  readonly doc: string;
  /** The family the role belongs to. */
  readonly family: Family;
  /** The base value: the token's own `$value`. */
  readonly base: RoleValue;
  /** The dark restatement, when the theme serves a dark mode. */
  readonly dark: RoleValue | null;
  /** Whether the theme restates this role for its dark mode. */
  readonly restated: boolean;
}

/**
 * Every role the theme declares, in the order the page shows them.
 *
 * The ramp is not a role: a numbered step of the grey scale is a step, and
 * the page shows the ramp as a ramp — under a disclosure — rather than as
 * twenty rows of "50" and "100" that a reader cannot act on.
 */
export function colorRoles(
  tree: TokenTree | undefined,
  servesDark: boolean,
): Role[] {
  if (tree === undefined) return [];
  const roles: Role[] = [];
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    if (leaf.path[0] !== "color") continue;
    if (isRampStep(leaf.path)) continue;
    const path = leaf.path.join(".");
    roles.push({
      path,
      name: leaf.path.slice(1).join("."),
      doc: DOCS.get(path) ?? leaf.description ?? "",
      family: familyOf(leaf.path),
      base: slotValue(tree, leaf, "base"),
      dark: servesDark ? slotValue(tree, leaf, "dark") : null,
      restated: leaf.modes?.["dark"] !== undefined,
    });
  }
  return roles.sort(byFamily);
}

/** The roles of one family, in the order the family reads. */
export function rolesOf(
  roles: readonly Role[],
  family: Family,
): readonly Role[] {
  return roles.filter((role) => role.family === family);
}

/** A token a role can point at. */
export interface Target {
  /** The dotted path the theme declares it by. */
  readonly path: string;
  /** The name of the token, as the path spells it below `color`. */
  readonly name: string;
  /** The colour it is worth in the mode being looked at. */
  readonly hex: string | null;
  /** Whether it is a step of the neutral ramp. */
  readonly ramp: boolean;
}

/**
 * Every colour the theme declares: what a role can point at.
 *
 * A reference is a decision about the palette, so the choices are the
 * palette's own tokens — the roles, and the ramp's steps, because pointing
 * a surface at a step of the ramp is how a theme keeps its greys in step.
 */
export function colorTargets(
  tree: TokenTree | undefined,
  mode: string,
): Target[] {
  if (tree === undefined) return [];
  const out: Target[] = [];
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    if (leaf.path[0] !== "color") continue;
    const path = leaf.path.join(".");
    out.push({
      path,
      name: leaf.path.slice(1).join("."),
      hex: toHex(tokenValue(tree, mode, path)) ?? null,
      ramp: isRampStep(leaf.path),
    });
  }
  return out;
}

/** One step of the neutral ramp. */
export interface RampStep {
  /** The dotted path the theme declares it by. */
  readonly path: string;
  /** The step's own name: the number the ramp is written in. */
  readonly step: string;
  /** The colour it is worth in the light mode. */
  readonly light: string | null;
  /** The colour it is worth in the dark mode, when the theme restates it. */
  readonly dark: string | null;
}

/** The neutral ramp, in the order the ramp reads. */
export function neutralRamp(
  tree: TokenTree | undefined,
): RampStep[] {
  if (tree === undefined) return [];
  const steps: RampStep[] = [];
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    if (!isRampStep(leaf.path)) continue;
    const path = leaf.path.join(".");
    steps.push({
      path,
      step: leaf.path[2] as string,
      light: toHex(tokenValue(tree, "light", path)) ?? null,
      dark: leaf.modes?.["dark"] === undefined
        ? null
        : toHex(tokenValue(tree, "dark", path)) ?? null,
    });
  }
  return steps;
}

/** True for a step of the neutral ramp: a number under `color.neutral`. */
function isRampStep(path: readonly string[]): boolean {
  return path.length === 3 && path[1] === "neutral" &&
    /^\d+$/.test(path[2] ?? "");
}

/** The family a role belongs to, by the shape of its name. */
function familyOf(path: readonly string[]): Family {
  const leaf = path[path.length - 1] ?? "";
  if (path[1] === "semantic" || leaf.startsWith("on-semantic-")) {
    return "status";
  }
  if (PICKS.has(leaf) || BRAND_INKS.has(leaf)) return "brand";
  return "neutral";
}

/** The order the families read in, and the order each family reads in. */
function byFamily(a: Role, b: Role): number {
  const family = FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family);
  if (family !== 0) return family;
  const order = ORDER[a.family];
  const mine = order.indexOf(a.name);
  const theirs = order.indexOf(b.name);
  // A role the page has no place for keeps the theme's own order, after the
  // ones it does.
  if (mine === -1 && theirs === -1) return 0;
  if (mine === -1) return 1;
  if (theirs === -1) return -1;
  return mine - theirs;
}

/**
 * What one slot holds for a role, references followed.
 *
 * The base slot resolves against the base values and the dark slot against
 * the dark ones, so a dark reference points at the dark value of the token
 * it names — which is what a theme means when it restates a surface as
 * `{color.neutral.200}`.
 */
function slotValue(
  tree: TokenTree,
  leaf: TokenLeaf,
  slot: "base" | "dark",
): RoleValue {
  const path = leaf.path.join(".");
  const raw = slot === "base" ? leaf.value : leaf.modes?.[slot] ?? leaf.value;
  const text = typeof raw === "string" || typeof raw === "number"
    ? String(raw)
    : "";
  const reference = aliasTarget(text);
  const resolved = resolve(slotValues(tree, slot), path);
  return {
    raw: text,
    computed: reference !== null,
    reference,
    value: resolved,
    hex: toHex(resolved) ?? null,
  };
}

/** The values a document holds in one slot, keyed by path. */
function slotValues(
  tree: TokenTree,
  slot: "base" | "dark",
): Map<string, unknown> {
  if (slot === "dark") return valuesInMode(tree, "dark");
  const out = new Map<string, unknown>();
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    out.set(leaf.path.join("."), leaf.value);
  }
  return out;
}

/** What a slot is worth at a path, references followed. */
function resolve(
  values: Map<string, unknown>,
  path: string,
): string | null {
  const seen = new Set<string>();
  let cursor = path;
  for (;;) {
    if (seen.has(cursor)) return null;
    seen.add(cursor);
    const raw = values.get(cursor);
    if (raw === undefined) return null;
    const text = typeof raw === "string" || typeof raw === "number"
      ? String(raw)
      : null;
    if (text === null) return null;
    const target = aliasTarget(text);
    if (target === null) return text;
    cursor = target;
  }
}
