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
  contrastRatio,
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
  /** The light value, when the theme serves a light mode. */
  readonly light: RoleValue | null;
  /** The dark value, when the theme serves a dark mode. */
  readonly dark: RoleValue | null;
  /** Which mode the token's own `$value` is written in. A dark-base theme
   * (synthwave) writes dark in `$value` and restates light under `$modes`. */
  readonly baseSlot: "light" | "dark";
  /** Whether the theme restates this role for a mode other than the base. */
  readonly restated: boolean;
  /** The base value: the slot the token's `$value` is written in. Kept so
   * callers that read `role.base` keep reading the authored slot. */
  readonly base: RoleValue;
}

/**
 * Every role the theme declares, in the order the page shows them.
 *
 * The ramp is not a role: a numbered step of the grey scale is a step, and
 * the page shows the ramp as a ramp — under a disclosure — rather than as
 * twenty rows of "50" and "100" that a reader cannot act on.
 *
 * Slots follow the modes the theme declares, never the assumption that
 * `$value` is light: a dark-base theme writes dark in `$value`, and a
 * single-mode dark theme has no light slot at all.
 */
export function colorRoles(
  tree: TokenTree,
  modes: readonly ("light" | "dark")[],
): Role[] {
  const roles: Role[] = [];
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    if (leaf.path[0] !== "color") continue;
    if (isRampStep(leaf.path)) continue;
    const path = leaf.path.join(".");
    const baseSlot: "light" | "dark" = baseSlotOf(leaf, modes);
    const light = modes.includes("light") ? slotValue(tree, leaf, "light") : null;
    const dark = modes.includes("dark") ? slotValue(tree, leaf, "dark") : null;
    roles.push({
      path,
      name: leaf.path.slice(1).join("."),
      doc: DOCS.get(path) ?? leaf.description ?? "",
      family: familyOf(leaf.path),
      light,
      dark,
      baseSlot,
      base: baseSlot === "light" ? light ?? dark! : dark ?? light!,
      restated: modes.some(
        (mode) => mode !== baseSlot && leaf.modes?.[mode] !== undefined,
      ),
    });
  }
  return roles.sort(byFamily);
}

/**
 * The mode a leaf's own `$value` is written in.
 *
 * A light restatement on a dark deck (`synthwave`'s `$modes.light`) means the
 * base is dark; a theme that serves dark alone (`console`) is dark-based by
 * declaration. Otherwise the base is light — the system's own default.
 */
function baseSlotOf(
  leaf: TokenLeaf,
  modes: readonly ("light" | "dark")[],
): "light" | "dark" {
  if (leaf.modes?.["light"] !== undefined) return "dark";
  if (!modes.includes("light") && modes.includes("dark")) return "dark";
  return "light";
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
  tree: TokenTree,
  mode: string,
): Target[] {
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

/**
 * A path as words: `color.on-primary` is `On Primary`, `color.semantic.error`
 * is `Error`.
 *
 * Paths are for linking and copying; what a reader sees is the name. Only
 * `color.*` paths are renamed — anything else passes through untouched.
 * `semantic` is the contract's filing and nobody's vocabulary, so it reads
 * as nothing: the leaf is the word.
 */
export function humanName(path: string): string {
  if (!path.startsWith("color.")) return path;
  const words = path
    .slice("color.".length)
    .split(".")
    .filter((segment) => segment !== "semantic")
    .flatMap((segment) => segment.split("-"))
    .map((word) => word === "" ? word : word[0]!.toUpperCase() + word.slice(1));
  // The flat `on-semantic-*` leaves read `On Semantic X`: the contract's
  // filing again, in a hyphen. The leaf is still the word.
  if (words.length >= 3 && words[0] === "On" && words[1] === "Semantic") {
    words.splice(1, 1);
  }
  return words.join(" ");
}
/**
 * The ink that reads on a paint: white or near-black, whichever contrasts
 * more. No paint means no say — the caller falls back to its chrome ink.
 */
export function contrastInk(paint: string | null): string | undefined {
  if (paint === null) return undefined;
  return contrastRatio("#ffffff", paint) >= contrastRatio("#111111", paint)
    ? "#ffffff"
    : "#111111";
}

/**
 * What a role is read on: an on-role sits on its fill, and everything
 * else wears its own colour — a fill's own ground is the card's whole
 * point.
 */
export function pairGround(path: string, fill: string): string {
  const leaf = path.split(".").pop() ?? "";
  if (leaf.startsWith("on-")) return fill;
  return path;
}

/** The visual job a role plays on a card. */
export type RoleKind = "fill" | "surface" | "ink" | "stroke" | "on-ink";

const SURFACES = new Set([
  "color.surface",
  "color.surface-raised",
  "color.surface-sunken",
  "color.field",
]);

const INKS = new Set([
  "color.text",
  "color.text-muted",
  "color.link",
]);

const STROKES = new Set([
  "color.border",
  "color.border-strong",
  "color.focus-ring",
]);

export function roleKind(path: string): RoleKind {
  const leaf = path.split(".").pop() ?? "";
  if (leaf.startsWith("on-")) return "on-ink";
  if (SURFACES.has(path)) return "surface";
  if (INKS.has(path)) return "ink";
  if (STROKES.has(path)) return "stroke";
  return "fill";
}

/** The `on-*` ink token paired with a fill role, when the contract defines one. */
export function pairedInkPath(path: string): string | null {
  if (!path.startsWith("color.")) return null;
  const rest = path.slice("color.".length);
  if (rest.startsWith("semantic.")) {
    return `color.on-semantic-${rest.slice("semantic.".length)}`;
  }
  if (
    rest === "primary" ||
    rest === "secondary" ||
    rest === "accent" ||
    rest === "disabled"
  ) {
    return `color.on-${rest}`;
  }
  return null;
}

/** The fill role an `on-*` ink sits on. */
export function pairedFillPath(path: string): string | null {
  if (!path.startsWith("color.on-")) return null;
  const rest = path.slice("color.on-".length);
  if (rest.startsWith("semantic-")) {
    return `color.semantic.${rest.slice("semantic-".length)}`;
  }
  return `color.${rest}`;
}

/** A card in a family grid: a primary role and its paired `on-*` ink when present. */
export interface RoleCard {
  readonly role: Role;
  readonly ink: Role | null;
}

/**
 * The cards a family renders.
 *
 * Paired `on-*` roles fold into their fill card so the card wears the
 * actual ink on the actual fill instead of repeating the fill twice. An
 * `on-*` role whose fill is absent from the theme still renders its own
 * card so no declared token disappears.
 */
export function familyCards(
  roles: readonly Role[],
  family: Family,
): readonly RoleCard[] {
  const byPath = new Map(roles.map((role) => [role.path, role]));
  const inFamily = rolesOf(roles, family);
  const out: RoleCard[] = [];
  for (const role of inFamily) {
    const fillPath = pairedFillPath(role.path);
    if (fillPath !== null && byPath.has(fillPath)) continue;
    const inkPath = pairedInkPath(role.path);
    const ink = inkPath !== null ? (byPath.get(inkPath) ?? null) : null;
    out.push({ role, ink });
  }
  return out;
}

/**
 * Who each ramp step's value reaches: the roles resolving to it in the mode.
 *
 * A role pointing at a step by reference and a role holding the step's
 * value literally are the same fact — the step's colour is on the screen
 * because of them — so both count. A step nobody's value equals reads as
 * the empty array: an orphan, not an absence.
 */
export function stepConsumers(
  tree: TokenTree,
  mode: string,
): ReadonlyMap<string, readonly string[]> {
  const values = valuesInMode(tree, mode);
  const steps = new Map<string, string | null>();
  const roles: { path: string; value: string | null }[] = [];
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    if (leaf.path[0] !== "color") continue;
    const path = leaf.path.join(".");
    const value = resolve(values, path);
    if (isRampStep(leaf.path)) steps.set(path, value);
    else roles.push({ path, value });
  }
  const out = new Map<string, readonly string[]>();
  for (const [step, value] of steps) {
    if (value === null) {
      out.set(step, []);
      continue;
    }
    out.set(
      step,
      roles
        .filter((role) => role.value === value)
        .map((role) => humanName(role.path))
        .sort(),
    );
  }
  return out;
}

/**
 * One step of the neutral ramp.
 */
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
  tree: TokenTree,
): RampStep[] {
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
 * Each slot resolves against that mode's values (`valuesInMode`), so a dark
 * reference points at the dark value of the token it names — which is what
 * a theme means when it restates a surface as `{color.neutral.200}`.
 */
function slotValue(
  tree: TokenTree,
  leaf: TokenLeaf,
  slot: "light" | "dark",
): RoleValue {
  const path = leaf.path.join(".");
  const raw = leaf.modes?.[slot] ?? leaf.value;
  const text = typeof raw === "string" || typeof raw === "number"
    ? String(raw)
    : "";
  const reference = aliasTarget(text);
  const resolved = resolve(valuesInMode(tree, slot), path);
  return {
    raw: text,
    computed: reference !== null,
    reference,
    value: resolved,
    hex: toHex(resolved) ?? null,
  };
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
