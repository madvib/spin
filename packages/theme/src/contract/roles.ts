/**
 * What a theme must declare, declared once.
 *
  * Each entry below carries everything a role is: the path that names it, the
  * type it must have, the value a language writes for it, the documentation an
 * editor shows, and the contrast floors it owes — one, or more where a role is
 * read against more than one surface. Everything else derives:
 * `requiredPaths()` for validation and `themeSchema()` for the JSON Schema.
 *
 * The declarations live in `../base/roles.json`, not in this file: DTCG JSON
 * is the single source of truth, and this module walks it. A role added to
 * the JSON is required by the schema and validated by the contract in the
 * same change, with no TypeScript table to remember beside it.
 */

import { TOKEN_TYPES } from "../pipeline/types.ts";
import type { TokenType } from "../pipeline/types.ts";
import { parseTokens } from "../pipeline/parse.ts";
import { asRecord } from "../json.ts";
import { ELEMENT_ROLES } from "./elements.ts";
import { ownedStyleFields, ownedStyleNames } from "./typography.ts";
import { minimalLanguage } from "../languages/index.ts";
import rolesDoc from "../base/roles.json" with { type: "json" };

/** A contrast requirement between two roles, in WCAG terms. */
export interface LegibilityFloor {
  readonly fg: string;
  readonly bg: string;
  /** Minimum contrast ratio. 4.5 for body text, 3 for non-text. */
  readonly min: number;
}

/** A contrast requirement for one interactive state of one primitive. */
export interface StateLegibilityFloor {
  readonly primitive: string;
  readonly variant: string;
  readonly state: "hover" | "focus-visible" | "active" | "disabled" | "checked";
  readonly fg: string;
  readonly bg: string;
  readonly min: number;
}

/**
 * The contrast floors for interactive states, beside `legibilityFloors`.
 *
 * Hand-declared token paths are correct here: this is the contract stating
 * what it owes, not a guess about what a generator produces. The battery
 * folds these into the legibility gate, so no new `GATES` member is needed.
 */
export function stateLegibilityFloors(): StateLegibilityFloor[] {
  return [
    // Hover/active repaint shadow + transform only, so the pair equals rest.
    { primitive: "button", variant: "primary", state: "hover", fg: "color.on-primary", bg: "color.primary", min: 4.5 },
    { primitive: "button", variant: "primary", state: "active", fg: "color.on-primary", bg: "color.primary", min: 4.5 },
    { primitive: "button", variant: "primary", state: "focus-visible", fg: "color.on-primary", bg: "color.primary", min: 4.5 },
    { primitive: "button", variant: "secondary", state: "hover", fg: "color.on-secondary", bg: "color.secondary", min: 4.5 },
    { primitive: "button", variant: "secondary", state: "active", fg: "color.on-secondary", bg: "color.secondary", min: 4.5 },
    { primitive: "button", variant: "outline", state: "hover", fg: "color.on-accent", bg: "color.accent", min: 4.5 },
    // Contrast hover repaints shadow only: this one entry pins the rest pair too.
    { primitive: "button", variant: "contrast", state: "hover", fg: "color.surface", bg: "color.text", min: 4.5 },
    // Danger rest fill never changes across states: one entry pins it.
    { primitive: "button", variant: "danger", state: "hover", fg: "color.on-semantic-error", bg: "color.semantic.error", min: 4.5 },
    // Ghost hover paints no fill, so there is nothing to measure.
    // Disabled posture is variant-independent: one entry covers every variant.
    { primitive: "button", variant: "*", state: "disabled", fg: "color.on-disabled", bg: "color.disabled", min: 4.5 },
    // Page bg is contextual, so the surface is the floor for both link inks.
    // A theme without link-hover keeps the rest ink on hover (see linkRule),
    // so the first entry covers those themes; the second is conditional.
    // Focus is an outline + border recolor, not a fill/ink change: one
    // non-text indicator floor covers every control.
    { primitive: "input", variant: "*", state: "focus-visible", fg: "color.focus-ring", bg: "color.surface", min: 3 },
    // The field rule is shared, so one entry covers input/select/textarea.
    { primitive: "input", variant: "*", state: "disabled", fg: "color.on-disabled", bg: "color.disabled", min: 4.5 },
    { primitive: "checkbox", variant: "*", state: "checked", fg: "color.on-primary", bg: "color.primary", min: 4.5 },
    { primitive: "checkbox", variant: "*", state: "disabled", fg: "color.on-disabled", bg: "color.disabled", min: 4.5 },
    { primitive: "switch", variant: "*", state: "checked", fg: "color.on-primary", bg: "color.primary", min: 4.5 },
    { primitive: "switch", variant: "*", state: "disabled", fg: "color.on-disabled", bg: "color.disabled", min: 4.5 },
    // Radio checked is a border-only change and the dot is currentColor.
  ];
}

/** One thing a theme must declare, and everything needed to derive it. */
export interface RoleDeclaration {
  /** Dotted path, e.g. `color.semantic.error`. */
  readonly path: string;
  readonly type: TokenType;
  /** What a language writes. Valid, legible, and a finished look. */
  readonly value: string;
  readonly doc: string;
  /**
   * Every contrast floor this role owes.
   *
   * More than one, because a role is read against more than one surface: body
   * ink is read on the page AND on the raised sheet above it, and the floor
   * that holds it there is the same promise asked twice. A role with no floors
   * owes none.
   */
  readonly floors?: readonly LegibilityFloor[];
  /**
   * The role's headline floor: the first of the floors it owes.
   *
   * Derived from `floors`, so the two cannot disagree, and kept because it is
   * the one a reader asks for — "what does this role owe?".
   */
  readonly floor?: LegibilityFloor;
}
/**
 * The top-level groups a mode may restate: ink, elevation, transparency,
 * and the shared focus ring. Everything else — spacing, type, radius,
 * motion, breakpoints — is the theme's one decision, and a mode that
 * restates it is a second layout nobody measured.
 */
export const PALETTE_ROOTS: Record<string, true> = {
  color: true,
  shadow: true,
  opacity: true,
  focus: true,
};

/**
 * The per-element tokens a mode may restate: the inks and elevations an
 * element wears, each with a global fallback. A geometry sibling (`radius`,
 * `padding`, `depth`, `pill`) is the theme's one decision. Derived from the
 * element roles a mode may restate — every `color` or `shadow` element token
 * — so the list and the elements cannot disagree.
 */
export const PALETTE_ELEMENT_PATHS: Record<string, true> = Object.fromEntries(
  ELEMENT_ROLES.filter((role) => role.type === "color" || role.type === "shadow").map(
    (role) => [role.path, true],
  ),
);

/**
 * Whether a mode may restate the token at a dotted path.
 *
 * A palette token is an ink or an elevation: every path under a palette
 * root, or one of the named per-element ink/elevation paths. The question
 * belongs here rather than in each consumer, so the schema, the facet
 * validators and the invariance gate cannot disagree about what a mode
 * owns.
 */
export function isPaletteTokenPath(path: string): boolean {
  const root = path.split(".")[0] as string;
  return Object.hasOwn(PALETTE_ROOTS, root) ||
    Object.hasOwn(PALETTE_ELEMENT_PATHS, path);
}

/** A raw roles.json node, as authored. */
interface RolesNode {
  readonly $type?: unknown;
  readonly $value?: unknown;
  readonly $description?: unknown;
  readonly $extensions?: unknown;
  readonly [key: string]: unknown;
}

/** The legibility floors a node declares under `$extensions.spin.floors`. */
function floorsOf(node: RolesNode): readonly LegibilityFloor[] | undefined {
  const extensions = asRecord(node.$extensions);
  if (extensions === undefined) return undefined;
  const spin = asRecord(extensions["spin"]);
  if (spin === undefined) return undefined;
  const floors = spin["floors"];
  if (!Array.isArray(floors)) return undefined;
  const out: LegibilityFloor[] = [];
  for (const floor of floors) {
    const entry = asRecord(floor);
    if (entry === undefined) continue;
    if (
      typeof entry["fg"] !== "string" || typeof entry["bg"] !== "string" ||
      typeof entry["min"] !== "number"
    ) continue;
    out.push({ fg: entry["fg"] as string, bg: entry["bg"] as string, min: entry["min"] as number });
  }
  return out.length > 0 ? out : undefined;
}

/** Every role declaration roles.json states, in the order it states them. */
function readDeclaredRoles(): ReadonlyArray<Omit<RoleDeclaration, "floor">> {
  const out: Array<Omit<RoleDeclaration, "floor">> = [];
  const walk = (node: unknown, path: string[], inherited: TokenType | undefined): void => {
    if (typeof node !== "object" || node === null || Array.isArray(node)) return;
    const record = node as RolesNode;
    const type = typeof record.$type === "string"
      ? (record.$type as TokenType)
      : inherited;
    if (Object.hasOwn(record, "$value")) {
      if (type === undefined) {
        throw new Error(`contract: role ${path.join(".")} declares no $type`);
      }
      const value = record.$value;
      if (typeof value !== "string") {
        throw new Error(`contract: role ${path.join(".")} has no string language value`);
      }
      const doc = typeof record.$description === "string"
        ? record.$description
        : path.join(".");
      const floors = floorsOf(record);
      out.push({
        path: path.join("."),
        type,
        value,
        doc,
        ...(floors === undefined ? {} : { floors }),
      });
      return;
    }
    for (const key of Object.keys(record)) {
      if (key.startsWith("$")) continue;
      walk(record[key], [...path, key], type);
    }
  };
  const root = asRecord(rolesDoc) ?? {};
  for (const key of Object.keys(root)) {
    if (key.startsWith("$")) continue;
    walk(root[key], [key], undefined);
  }
  return out;
}

/**
 * Roles a theme must declare regardless of which components it enables: the
 * palette, the contrast floors that make a palette usable, and the focus ring
 * every interactive element shares. Derived from `../base/roles.json` — the
 * single source of truth — so no TypeScript table can drift from it.
 */
const DECLARED_ROLES: readonly Omit<RoleDeclaration, "floor">[] = readDeclaredRoles();

/**
 * The roles a theme must declare, each with its headline floor derived from
 * the floors it owes.
 *
 * The floor is derived rather than written twice, so the list and the headline
 * cannot drift apart: a role that owes two floors has a headline, and a role
 * that owes none has none.
 */
export const BASE_ROLES: readonly RoleDeclaration[] = DECLARED_ROLES.map(
  (role) => ({
    ...role,
    ...(role.floors?.[0] === undefined ? {} : { floor: role.floors[0] }),
  }),
);
/** The paths every theme must declare. */
export function requiredPaths(): readonly string[] {
  const paths = new Set(BASE_ROLES.map((role) => role.path));
  for (const scale of baselineScales()) paths.add(scale.path);
  for (const name of ownedStyleNames()) {
    for (const field of ownedStyleFields()) paths.add(`font.style.${name}.${field}`);
  }
  return [...paths];
}

/** One baseline scale step: the path, the type, and the baseline's value. */
export interface BaselineScale {
  readonly path: string;
  readonly type: TokenType;
  readonly value: unknown;
  readonly doc: string;
}

/**
  * Minimal's scale steps, with type and value: the shared ruler the languages
  * agree on. Same exclusions as the required paths — a step excluded there
 * is excluded here, so the two cannot disagree about what a theme owes.
 */
export function baselineScales(): readonly BaselineScale[] {
  const parsed = parseTokens(minimalLanguage);
  if (!parsed.ok) {
    throw new Error(
      `contract: baseline theme does not parse: ${parsed.error}`,
    );
  }
  const optionalRoots = new Set([
    "element",
    ...ELEMENT_ROLES.map((role) => role.group),
  ]);
  const out: BaselineScale[] = [];
  const walk = (nodes: readonly unknown[]): void => {
    for (const node of nodes) {
      const n = node as {
        kind: string;
        name: string;
        path: readonly string[];
        type: TokenType;
        value: unknown;
        description?: string;
        children?: readonly unknown[];
      };
      const dotted = n.path.join(".");
      if (
        n.path.length > 0 &&
        (optionalRoots.has(n.path[0] as string) ||
          dotted.startsWith("font.style.") ||
          dotted.startsWith("border.style.") ||
          n.path[0] === "opacity" ||
          dotted.startsWith("font.size.") ||
          dotted.startsWith("font.weight.") ||
          dotted.startsWith("font.tracking.") ||
          dotted.startsWith("font.leading.") ||
          dotted === "font.family.heading" ||
          dotted === "font.family.body" ||
          n.path[n.path.length - 2] === "type")
      ) continue;
      if (n.kind === "token") {
        out.push({
          path: dotted,
          type: n.type,
          value: n.value,
          doc: n.description ?? dotted,
        });
      } else if (n.children !== undefined) {
        walk(n.children);
      }
    }
  };
  walk(parsed.tree as readonly unknown[]);
  return out;
}

/**
 * The contrast floors, attached to the roles that owe them.
 *
 * A role owes every floor it declares: the ink on a fill, the body ink on
 * the page AND on the raised sheet above it. The list is flat because the
 * gate asks one question of one pair at a time — "does this foreground hold
 * on this background?" — and a role that owes two answers is two answers.
 */
export function legibilityFloors(): LegibilityFloor[] {
  return BASE_ROLES.flatMap((role) => [...(role.floors ?? [])]);
}

/**
 * The foregrounds a theme declares, keyed by the word that names them.
 *
 * The theme already says which ink goes on which fill — a `floor` names both
 * sides — so this reads the answer out rather than restating it. A consumer
 * asking "what do I write on top of `bg-semantic-error`?" asks the theme, and
 * gets `on-semantic-error` for every theme that has one rather than a
 * convention the consumer invented.
 *
 * Only `on-*` steps count: a floor's `fg` is any role that must stay legible
 * against a surface, and `color.text` on `color.surface` is not a fill a
 * consumer paints behind something. The prefix is the domain's own spelling
 * for "this is the ink for that fill".
 */
export function inkTokens(): readonly string[] {
  const steps = legibilityFloors()
    .map((floor) => foregroundStep(floor.fg))
    .filter((step) => step !== undefined && step.startsWith("on-"));
  return [...new Set(steps)] as string[];
}

/** The last segment of a token path. */
function foregroundStep(path: string): string {
  const segments = path.split(".");
  return segments[segments.length - 1] as string;
}

/** A JSON Schema node emitted by the contract builder. */
interface JsonSchema {
  readonly type?: string;
  readonly description?: string;
  readonly additionalProperties?: boolean;
  readonly required?: readonly string[];
  readonly properties?: Record<string, JsonSchema>;
  readonly items?: JsonSchema;
  readonly enum?: readonly string[];
  readonly anyOf?: readonly JsonSchema[];
}

const TokenTypeSchema: JsonSchema = {
  type: "string",
  enum: [...TOKEN_TYPES],
};

/** One declared token: a value, optionally typed at the group level. */
function leafSchema(doc: string, allowModes: boolean): JsonSchema {
  return {
    type: "object",
    description: doc,
    additionalProperties: false,
    required: ["$value"],
    properties: {
      $value: {},
      $type: TokenTypeSchema,
      $description: { type: "string" },
      ...(allowModes
        ? {
          $modes: {
            type: "object",
            properties: { light: {}, dark: {} },
            additionalProperties: false,
          },
        }
        : {}),
    },
  };
}

/**
 * The theme document schema.
 *
 * Built directly as JSON Schema 2020-12 from the role declarations, so
 * `bun run schema` writes `schema.json` straight from the builder with no
 * external schema library. Declared roles land in `required` automatically;
 * everything else a theme may add is permitted by `additionalProperties`.
 */
export function themeSchema(): Record<string, unknown> {
  const properties: Record<string, JsonSchema> = {};
  const requiredGroups: string[] = [];
  // The groups, each carrying the paths it holds and which of them a theme
  // must declare. The three lists are gathered together because a group can
  // hold more than one kind of token: `font` carries the base face AND the
  // per-element typography, and a group written twice would leave the second
  // writing over the first.
  const groups = new Map<string, { paths: string[]; required: Set<string> }>();
  const gather = (group: string, path: string, required: boolean): void => {
    const entry = groups.get(group) ??
      { paths: [], required: new Set<string>() };
    entry.paths.push(path);
    if (required) entry.required.add(path);
    groups.set(group, entry);
  };
  for (const role of BASE_ROLES) {
    gather(role.path.split(".")[0] as string, role.path, true);
  }
  // Minimal's scales are required for the same reason the roles are: a step
  // minimal states is spendable by any utility, so a theme that omits one
  // breaks whatever spends it. Same exclusions as the required paths — the
  // builder reads them, so the two cannot disagree.
  for (const scale of baselineScales()) {
    gather(scale.path.split(".")[0] as string, scale.path, true);
  }
  // The per-element groups are known to the contract, so the schema says what
  // they hold — but they are OPTIONAL: a theme that declares none of them is
  // complete, and the rules fall back to the shared scales. What the schema
  // must not do is require a group nothing demands, or make a theme that
  // omits one invalid for the sake of a decision it never made.
  for (const role of ELEMENT_ROLES) gather(role.group, role.path, false);
  // The owned set is required: every owned name's tuple is something a
  // theme owes, so the schema requires it the way the required paths do.
  for (const name of ownedStyleNames()) {
    for (const field of ownedStyleFields()) {
      gather("font", `font.style.${name}.${field}`, true);
    }
  }
  for (const [group, entry] of groups) {
    const schema = groupSchema(entry.paths, entry.required);
    // A group a theme does not have to declare is OPTIONAL in the schema:
    // the per-element groups are decisions a theme MAY make, and a document
    // that omits them is complete.
    const must = entry.paths.some((path) => entry.required.has(path));
    if (must) requiredGroups.push(group);
    properties[group] = schema;
  }
  // `modes` is document metadata, not a token: it sits at the root beside
  // the groups and no emitter reads it. `additionalProperties` would already
  // admit it, but the schema says what a document may carry so the field is
  // listed — and constrained to the two modes the pipeline understands.
  properties["modes"] = {
    type: "array",
    description:
      "The modes this theme serves. A mode the theme serves but does not override falls back to the base values.",
    items: {
      type: "string",
      enum: ["light", "dark"],
    },
  };
  // `$extends` is document metadata like `modes`: the document this sparse
  // document layers over — a language, or the `base` foundation the languages
  // themselves layer over. Listed and constrained to the shipped names so
  // an unknown name fails the schema, not the build.
  properties["$extends"] = {
    type: "string",
    description:
      "The document this document layers over. Tokens the document states replace the base's; tokens it omits are inherited.",
    enum: ["minimal", "editorial", "material", "neobrutalist", "neumorphic", "glassmorphic", "base"],
  };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://spin.dev/theme.schema.json",
    title: "Spin theme",
    type: "object",
    additionalProperties: true,
    required: requiredGroups,
    properties,
  };
}

interface ShapeLeaf {
  readonly kind: "leaf";
  readonly required: boolean;
  readonly schema: JsonSchema;
}

/**
 * A group before conversion: either a nested group or a finished leaf.
 *
 * A nested group carries whether a theme MUST declare it: a group that holds
 * a required role is required, and a group that holds only optional ones is
 * not. The same rule decides the leaves, so the two cannot disagree.
 */
interface ShapeGroup {
  readonly kind: "group";
  /** Whether the group must be declared. */
  readonly required: boolean;
  readonly children: GroupShape;
}

type GroupShape = { [segment: string]: ShapeLeaf | ShapeGroup };

/** The nested schema for one token group, built from its role paths. */
function groupSchema(
  paths: string[],
  required: ReadonlySet<string>,
): JsonSchema {
  const byRole = new Map(BASE_ROLES.map((role) => [role.path, role]));
  const byElement = new Map(ELEMENT_ROLES.map((role) => [role.path, role]));
  const byScale = new Map(baselineScales().map((scale) => [scale.path, scale]));
  // Which groups hold a required role: a group a theme must declare is the
  // one with something required under it.
  const holds = new Map<string, boolean>();
  for (const path of paths) {
    const segments = path.split(".");
    for (let depth = 1; depth < segments.length; depth++) {
      const prefix = segments.slice(0, depth).join(".");
      holds.set(
        prefix,
        (holds.get(prefix) ?? false) || required.has(path),
      );
    }
  }
  const shape: GroupShape = {};
  for (const path of paths) {
    const segments = path.split(".");
    let level = shape;
    for (let depth = 1; depth < segments.length - 1; depth++) {
      const segment = segments[depth] as string;
      const prefix = segments.slice(0, depth + 1).join(".");
      const child = level[segment];
      level = child !== undefined && child.kind === "group"
        ? child.children
        : (level[segment] = {
          kind: "group",
          required: holds.get(prefix) ?? false,
          children: {},
        }).children;
    }
    const role = byRole.get(path);
    const element = byElement.get(path);
    const owned = ownedDoc(path);
    const doc = role?.doc ?? element?.doc ?? owned ?? byScale.get(path)?.doc;
    if (doc === undefined) continue;
    level[segments[segments.length - 1] as string] = {
      kind: "leaf",
      required: required.has(path),
      schema: leafSchema(doc, isPaletteTokenPath(path)),
    };
  }
  // A style tuple states its five fields as one composite token or as five
  // child tokens; the schema accepts either. The parser expands the composite
  // to the same five leaves, so the branch below mirrors the group rather
  // than deciding anything twice.
  acceptStyleTuples(shape);
  return toSchema(shape);
}

/**
 * Admit the composite form beside the five-child group for every owned style
 * under `font.style.<name>`. The `shape` here is one top-level group's
 * children, so `style.<name>` holds the five field leaves the gather loop
 * just placed. Each is re-hung as a leaf whose schema is either the group
 * the loop built or the composite tuple — one required style, two spellings.
 */
function acceptStyleTuples(shape: GroupShape): void {
  const style = shape["style"];
  if (style === undefined || style.kind !== "group") return;
  for (const name of ownedStyleNames()) {
    const tuple = style.children[name];
    if (tuple === undefined || tuple.kind !== "group") continue;
    const groupForm: JsonSchema = toSchema(tuple.children);
    const compositeForm = styleTupleSchema(name);
    style.children[name] = {
      kind: "leaf",
      required: tuple.required,
      schema: {
        description: groupForm.description ?? compositeForm.description,
        anyOf: [compositeForm, groupForm],
      },
    };
  }
}

/**
 * The documentation for an owned style leaf, from the owned set itself.
 *
 * The owned set names the styles a theme owes; the schema says what each leaf
 * holds, so the two read from the same list rather than a second roster.
 */
function ownedDoc(path: string): string | undefined {
  const segments = path.split(".");
  if (segments.length !== 4 || segments[0] !== "font" || segments[1] !== "style") {
    return undefined;
  }
  const name = segments[2] as string;
  if (!ownedStyleNames().includes(name)) return undefined;
  const field = segments[3] as string;
  return `The ${field} the ${name} style reads at.`;
}

/**
 * The composite typography tuple one owned style may state instead of the
 * five-child group: one `$type: "typography"` carrying the five fields in a
 * single `$value`. The parser expands it to the same five leaves, so the
 * schema accepts both — and requires the same fields either way.
 */
function styleTupleSchema(style: string): JsonSchema {
  const fields: Record<string, JsonSchema> = {};
  for (const field of ["family", "size", "weight", "tracking", "leading"]) {
    fields[field] = {};
  }
  return {
    type: "object",
    description: `The ${style} style as one typography tuple.`,
    additionalProperties: false,
    required: ["$type", "$value"],
    properties: {
      $type: { type: "string", enum: ["typography"] },
      $value: {
        type: "object",
        additionalProperties: false,
        required: ["family", "size", "weight", "tracking", "leading"],
        properties: fields,
      },
      $description: { type: "string" },
    },
  };
}

/** Convert an assembled group into its JSON Schema object. */
function toSchema(shape: GroupShape): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(shape)) {
    if (value.required) required.push(key);
    properties[key] = value.kind === "leaf"
      ? value.schema
      : toSchema(value.children);
  }
  return {
    type: "object",
    additionalProperties: true,
    ...(required.length > 0 ? { required } : {}),
    properties,
  };
}
