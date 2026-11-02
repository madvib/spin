/**
 * The themes section's reading of the theme documents.
 *
 * Every list these pages show is derived: the catalogue from the documents in
 * `@spinjs/spin/theme/themes`, the schema page from the contract in `@spinjs/spin/theme` and
 * the JSON Schema it writes. A page that spelled them out by hand would be a
 * second source of truth, and the first theme to gain a token would leave the
 * site describing a system that no longer exists.
 *
 * The values read here are the documents' own. Where a token names another
 * token, the alias is followed to the value it stands for, because a palette
 * that shows `{color.neutral.50}` where it means `#fbfaf8` is showing the
 * mechanism instead of the color.
 */
import {
  aliasTarget,
  BASE_ROLES,
  indexTree,
  legibilityFloors,
  parseTokens,
  resolveAliases,
  spinThemeJsonSchema,
  starterThemes,
  themeModes,
  TOKEN_TYPES,
} from "@spinjs/spin/theme";
import type { TokenIndex, TokenTree } from "@spinjs/spin/theme";
import { primitiveContracts } from "@spinjs/spin/preset";

/** A theme's color role, read from the document. */
export interface Swatch {
  /** The DTCG path of the role, e.g. `color.semantic.success`. */
  readonly path: string;
  /** The utility that paints it, e.g. `bg-semantic-success`. */
  readonly utility: string;
  /** The value the document states, with aliases followed. */
  readonly value: string;
  /** The value the document states for the dark mode, when it states one. */
  readonly dark: string | undefined;
}

/** One decision a theme makes, and the token it is read from. */
export interface Axis {
  /** The axis the decision belongs to: type, shape, depth or motion. */
  readonly axis: string;
  /** The token the decision is read from. */
  readonly path: string;
  /** The value the document states, or "not declared". */
  readonly value: string;
}

/** Everything the catalogue shows about one starter. */
export interface ThemeSummary {
  readonly name: string;
  /** The document's own one-line statement, when it carries one. */
  readonly thesis: string | undefined;
  /** The modes the document declares at its root. */
  readonly modes: readonly string[];
  /** Whether the document states a second rendering of any token. */
  readonly carriesDark: boolean;
  /** The color roles, in document order. */
  readonly palette: readonly Swatch[];
  /** The type, shape, depth and motion decisions. */
  readonly signature: readonly Axis[];
}

/** A token read out of a document, with its path. */
export interface Step {
  readonly path: string;
  readonly value: string;
}

/** The axes the catalogue reads, and the token each axis is read from. */
const SIGNATURE: readonly { readonly axis: string; readonly path: string }[] = [
  { axis: "type", path: "font.family.sans" },
  { axis: "type", path: "font.family.heading" },
  { axis: "shape", path: "radius.md" },
  { axis: "shape", path: "border.width" },
  { axis: "depth", path: "checkbox.depth" },
  { axis: "depth", path: "shadow.md" },
  { axis: "motion", path: "motion.duration.base" },
  { axis: "motion", path: "motion.easing.standard" },
];

/** The value a leaf holds, as text. */
function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : JSON.stringify(value);
}

/**
 * A value in one mode, with an alias followed in that same mode.
 *
 * An alias in a mode override names a token, and what it means in that mode
 * is the TARGET's value in that mode. Resolving it against the base instead
 * would report the light value for a dark one, which is the one thing a
 * palette must never do.
 */
function valueInMode(
  index: TokenIndex,
  value: unknown,
  mode: string,
  depth = 0,
): string {
  const target = aliasTarget(value);
  if (target === null || depth > 8) return text(value);
  const source = index.leaves[target];
  if (source === undefined) return text(value);
  const override = source.modes?.[mode];
  if (override === undefined) return text(source.value);
  return valueInMode(index, override, mode, depth + 1);
}

/**
 * The value a document states for the dark mode, with an alias followed.
 *
 * The alias is resolved against the same index as the base value, so a dark
 * step that names a ramp step shows the color that step is in the dark.
 */
function darkText(
  index: TokenIndex,
  value: unknown,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return valueInMode(index, value, "dark");
}

/** The parsed, alias-resolved index of a document. */
function indexOf(doc: Record<string, unknown>): TokenIndex {
  const parsed = parseTokens(doc);
  const tree: TokenTree = parsed.ok ? parsed.tree : [];
  return indexTree(resolveAliases(tree).tree);
}

/** The leaves under a group, in document order. */
function leavesUnder(index: TokenIndex, group: string): TokenIndex["leaves"] {
  const out: TokenIndex["leaves"] = {};
  for (const [path, leaf] of Object.entries(index.leaves)) {
    if (path === group || path.startsWith(`${group}.`)) out[path] = leaf;
  }
  return out;
}

/** One starter, read. */
function summarize(name: string, doc: Record<string, unknown>): ThemeSummary {
  const index = indexOf(doc);
  const palette: Swatch[] = [];
  for (const [path, leaf] of Object.entries(leavesUnder(index, "color"))) {
    palette.push({
      path,
      utility: `bg-${path.split(".").slice(1).join("-")}`,
      value: text(leaf.value),
      dark: darkText(index, leaf.modes?.["dark"]),
    });
  }
  const signature: Axis[] = SIGNATURE.map((entry) => ({
    axis: entry.axis,
    path: entry.path,
    value: index.leaves[entry.path] === undefined
      ? "not declared"
      : text(index.leaves[entry.path]?.value),
  }));
  const description = doc["$description"];
  return {
    name,
    thesis: typeof description === "string" ? description : undefined,
    modes: themeModes(doc),
    carriesDark: Object.values(index.leaves).some((leaf) =>
      leaf.modes?.["dark"] !== undefined
    ),
    palette,
    signature,
  };
}

/** Every starter, read. The order is the package's. */
export function themeSummaries(): readonly ThemeSummary[] {
  return Object.entries(starterThemes).map(([name, doc]) =>
    summarize(name, doc as Record<string, unknown>)
  );
}

/** One starter's document, as the package holds it. */
export function starterDocument(
  name: string,
): Record<string, unknown> | undefined {
  return starterThemes[name];
}

/** The value a document states at a path, with aliases followed. */
export function statedValue(
  doc: Record<string, unknown>,
  path: string,
): string | undefined {
  const leaf = indexOf(doc).leaves[path];
  return leaf === undefined ? undefined : text(leaf.value);
}

/** The value a document states for one mode, with aliases followed. */
export function statedMode(
  doc: Record<string, unknown>,
  path: string,
  mode: string,
): string | undefined {
  const index = indexOf(doc);
  const leaf = index.leaves[path];
  const raw = leaf?.modes?.[mode];
  if (raw === undefined) return undefined;
  return valueInMode(index, raw, mode);
}

/** The steps a group declares, in document order. */
export function groupSteps(
  doc: Record<string, unknown>,
  group: string,
): readonly Step[] {
  const index = indexOf(doc);
  return Object.entries(leavesUnder(index, group)).map(([path, leaf]) => ({
    path,
    value: text(leaf.value),
  }));
}

/** The document's own one-line statement, when it carries one. */
export function thesisOf(doc: Record<string, unknown>): string | undefined {
  const description = doc["$description"];
  return typeof description === "string" ? description : undefined;
}

/**
 * The types a group's tokens use, read from the documents.
 */
export function groupTypes(group: string): readonly string[] {
  const types = new Set<string>();
  for (const doc of Object.values(starterThemes)) {
    const index = indexOf(doc as Record<string, unknown>);
    for (const [path, leaf] of Object.entries(leavesUnder(index, group))) {
      if (path === group) continue;
      types.add(leaf.type);
    }
  }
  return [...types].sort();
}

/** The per-element groups, read from the preset's manifest. */
export function elementGroups(): readonly string[] {
  return [
    ...new Set(
      Object.values(primitiveContracts).flatMap((contract) =>
        contract.component.map((token) => token.path.split(".")[0] as string)
      ),
    ),
  ].sort();
}

/** The component tokens one element group owns, with their types. */
export function elementTokens(
  group: string,
): readonly { path: string; type: string }[] {
  const out: { path: string; type: string }[] = [];
  for (const contract of Object.values(primitiveContracts)) {
    for (const token of contract.component) {
      if (token.path.split(".")[0] !== group) continue;
      if (out.some((entry) => entry.path === token.path)) continue;
      out.push({ path: token.path, type: token.type });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** What the JSON Schema says about the document. */
export interface SchemaFacts {
  /** The groups the schema names. */
  readonly groups: readonly string[];
  /** The groups the schema marks required. */
  readonly requiredGroups: readonly string[];
  /** The role paths the schema requires, by the group that holds them. */
  readonly requiredRoles: ReadonlyMap<string, readonly string[]>;
}

/** True when a schema node holds children rather than token fields. */
function isGroup(node: unknown): boolean {
  const properties = (node as Record<string, unknown> | undefined)?.[
    "properties"
  ] as Record<string, unknown> | undefined;
  return properties !== undefined &&
    Object.keys(properties).some((key) => !key.startsWith("$"));
}

/** Every role a schema node requires, with the path it is required at. */
function collectRequired(
  node: Record<string, unknown>,
  prefix: string,
  out: string[],
): void {
  const properties = (node["properties"] ?? {}) as Record<string, unknown>;
  const required = (node["required"] ?? []) as string[];
  for (const key of required) {
    if (key.startsWith("$")) continue;
    const child = properties[key];
    if (child === undefined) continue;
    const path = `${prefix}.${key}`;
    if (isGroup(child)) {
      collectRequired(child as Record<string, unknown>, path, out);
    } else {
      out.push(path);
    }
  }
}

/** The schema, read. */
export function schemaFacts(): SchemaFacts {
  const schema = spinThemeJsonSchema() as Record<string, unknown>;
  const properties = (schema["properties"] ?? {}) as Record<string, unknown>;
  const required = (schema["required"] ?? []) as string[];
  const requiredRoles = new Map<string, string[]>();
  for (const group of required) {
    const node = properties[group];
    if (node === undefined) continue;
    const paths: string[] = [];
    collectRequired(node as Record<string, unknown>, group, paths);
    requiredRoles.set(group, paths);
  }
  return {
    groups: Object.keys(properties).filter((key) => key !== "modes"),
    requiredGroups: required,
    requiredRoles,
  };
}

/** The roles a theme must declare, with everything a role is. */
export const ROLES = BASE_ROLES;

/** The contrast floors, attached to the roles that owe them. */
export const FLOORS = legibilityFloors();

/** The closed type vocabulary. */
export const TYPES = TOKEN_TYPES;
