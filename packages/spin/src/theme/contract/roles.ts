/**
 * What a theme must declare, declared once.
 *
 * Each entry below carries everything a role is: the path that names it, the
 * type it must have, the value a scaffold writes for it, the documentation an
 * editor shows, and the contrast floors it owes — one, or more where a role is
 * read against more than one surface. Everything else derives:
 * `requiredPaths()` for validation, `themeSchema()` for the JSON Schema, and
 * `scaffoldTheme()` for a minimal document.
 */

import { TOKEN_TYPES } from "../pipeline/types.ts";
import type { TokenType } from "../pipeline/types.ts";
import { parseTokens } from "../pipeline/parse.ts";
import { ELEMENT_ROLES } from "./elements.ts";
import { ELEMENT_TYPE_ROLES } from "./typography.ts";
import type { ElementTypeDeclaration } from "./typography.ts";
import baseline from "../themes/silk.json" with { type: "json" };

/** A contrast requirement between two roles, in WCAG terms. */
export interface LegibilityFloor {
  readonly fg: string;
  readonly bg: string;
  /** Minimum contrast ratio. 4.5 for body text, 3 for non-text. */
  readonly min: number;
}

/** One thing a theme must declare, and everything needed to derive it. */
export interface RoleDeclaration {
  /** Dotted path, e.g. `color.semantic.error`. */
  readonly path: string;
  readonly type: TokenType;
  /** What a scaffold writes. Valid, legible, and obviously unfinished. */
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

/** Body ink on the page. */
const TEXT_ON_SURFACE: LegibilityFloor = {
  fg: "color.text",
  bg: "color.surface",
  min: 4.5,
};
/**
 * Body ink on the raised sheet above the page.
 *
 * The same promise asked again: a card is a surface the reader reads on, and
 * a theme whose ink holds on the page but not on the card has a card nobody
 * can read.
 */
const TEXT_ON_RAISED: LegibilityFloor = {
  fg: "color.text",
  bg: "color.surface-raised",
  min: 4.5,
};
/** The second voice on the page. */
const MUTED_ON_SURFACE: LegibilityFloor = {
  fg: "color.text-muted",
  bg: "color.surface",
  min: 3,
};
/** The second voice on the raised sheet above the page. */
const MUTED_ON_RAISED: LegibilityFloor = {
  fg: "color.text-muted",
  bg: "color.surface-raised",
  min: 3,
};

/**
 * A status colour on the page.
 *
 * The floor is the TEXT one, not the non-text one, because a status colour is
 * worn as ink as often as it is worn as a fill: an error message in the
 * prose, a warning beside a field, a success beside a number. Read as a
 * slab on the page it only has to be visible; read as a word it has to be
 * legible, so it owes four and a half to one.
 */
function statusFloor(name: string): LegibilityFloor {
  return { fg: `color.semantic.${name}`, bg: "color.surface", min: 4.5 };
}

/**
 * The ink on a fill, and the floor that holds it there.
 *
 * Both sides are dotted paths under `color`: the ink is a role of its own
 * (`on-semantic-error`) and the fill is the token it sits on
 * (`semantic.error`).
 */
function inkFloor(ink: string, fill: string): LegibilityFloor {
  return { fg: `color.${ink}`, bg: `color.${fill}`, min: 4.5 };
}

/**
 * Roles a theme must declare regardless of which components it enables: the
 * palette, the contrast floors that make a palette usable, and the focus ring
 * every interactive element shares.
 */
const DECLARED_ROLES: readonly Omit<RoleDeclaration, "floor">[] = [
  {
    path: "color.text",
    type: "color",
    value: "#111111",
    doc: "Default body text.",
    floors: [TEXT_ON_SURFACE, TEXT_ON_RAISED],
  },
  {
    path: "color.text-muted",
    type: "color",
    value: "#555555",
    doc: "Secondary text.",
    floors: [MUTED_ON_SURFACE, MUTED_ON_RAISED],
  },
  {
    path: "color.surface",
    type: "color",
    value: "#ffffff",
    doc: "Page background.",
  },
  {
    path: "color.surface-raised",
    type: "color",
    value: "#f0f0f0",
    doc: "Raised surfaces.",
  },
  {
    path: "color.border",
    type: "color",
    value: "#999999",
    doc: "Hairlines and dividers.",
  },
  {
    path: "color.primary",
    type: "color",
    value: "#333333",
    doc: "Primary actions.",
    // A filled button is the densest text-on-color pairing in the system and
    // the one most often authored wrong: a bright primary needs a dark
    // foreground, a near-black primary needs a light one.
    floors: [inkFloor("on-primary", "primary")],
  },
  {
    path: "color.secondary",
    type: "color",
    value: "#444444",
    doc: "Secondary actions.",
    // The secondary fill is a fill like any other, and the badge spends it as
    // a pill with a word on it. Without an ink of its own the label is
    // whatever the browser paints.
    floors: [inkFloor("on-secondary", "secondary")],
  },
  {
    path: "color.accent",
    type: "color",
    value: "#555555",
    doc: "Supporting emphasis.",
    // The accent fill is the badge's third tone and the one most often left
    // to chance: an accent is a bright colour by definition, and a bright
    // fill with the wrong ink is a badge nobody can read.
    floors: [inkFloor("on-accent", "accent")],
  },
  {
    path: "color.semantic.success",
    type: "color",
    value: "#1a7f37",
    doc: "Success status.",
    floors: [statusFloor("success")],
  },
  {
    path: "color.semantic.warning",
    type: "color",
    value: "#9a6700",
    doc: "Warning status.",
    floors: [statusFloor("warning")],
  },
  {
    path: "color.semantic.error",
    type: "color",
    value: "#b42318",
    doc: "Error status.",
    floors: [statusFloor("error")],
  },
  {
    path: "color.semantic.info",
    type: "color",
    value: "#175cd3",
    doc: "Info status.",
    floors: [statusFloor("info")],
  },
  {
    path: "color.on-primary",
    type: "color",
    value: "#ffffff",
    doc: "Text on a primary fill.",
  },
  {
    path: "color.on-secondary",
    type: "color",
    value: "#ffffff",
    doc: "Text on a secondary fill.",
  },
  {
    path: "color.on-accent",
    type: "color",
    value: "#ffffff",
    doc: "Text on an accent fill.",
  },
  {
    path: "color.selected",
    type: "color",
    value: "#111111",
    doc: "Selected state fill.",
    floors: [inkFloor("on-selected", "selected")],
  },
  {
    path: "color.on-selected",
    type: "color",
    value: "#ffffff",
    doc: "Text on a selected fill.",
  },
  {
    // One ink, one name: the semantic fills pair with `on-semantic-*`, and a
    // second `on-danger` for the same red made two answers to one question
    // while the starters disagreed on which was right. The danger button and
    // the danger badge spend THIS role, so the ink a scaffold writes is the
    // ink the surfaces wear. `color.on-danger` is a legacy alias a theme may
    // keep declaring; nothing reads it.
    path: "color.on-semantic-error",
    type: "color",
    value: "#ffffff",
    doc: "Text on an error fill.",
    floors: [inkFloor("on-semantic-error", "semantic.error")],
  },
  {
    // The ink on the success fill, and the floor that holds it there.
    //
    // The badge spends this pairing: a success badge is a filled pill with a
    // word on it, and the word is unreadable if the ink is not chosen for the
    // fill. A theme that pairs the ink loosely ships a badge nobody can read,
    // and the floor is what says so before the badge is drawn.
    path: "color.on-semantic-success",
    type: "color",
    value: "#ffffff",
    doc: "Text on a success fill.",
    floors: [inkFloor("on-semantic-success", "semantic.success")],
  },
  {
    // The ink on the warning fill. A warning is the one badge whose fill is
    // usually the palest in the palette, so it is the one whose ink is
    // usually chosen wrong: white on a pale amber measures under 2:1.
    path: "color.on-semantic-warning",
    type: "color",
    value: "#ffffff",
    doc: "Text on a warning fill.",
    floors: [inkFloor("on-semantic-warning", "semantic.warning")],
  },
  {
    // The ink on the info fill.
    path: "color.on-semantic-info",
    type: "color",
    value: "#ffffff",
    doc: "Text on an info fill.",
    floors: [inkFloor("on-semantic-info", "semantic.info")],
  },
  {
    // The fill a dead control wears, and the ink that reads on it. A
    // disabled control is not a dimmer control: dimming spends opacity on
    // the WHOLE element, so the ink dims with the fill and a white label on
    // a blue button lands at 1.56:1 — a button nobody can read. The pair
    // keeps a dead control legible, which is the whole point of pairing
    // every fill with an ink.
    path: "color.disabled",
    type: "color",
    value: "#e0e0e0",
    doc: "The fill a dead control wears.",
    floors: [inkFloor("on-disabled", "disabled")],
  },
  {
    path: "color.on-disabled",
    type: "color",
    value: "#3a3a3a",
    doc: "The ink on a dead control's fill.",
  },
  {
    // Non-text indicator, so it needs the 3:1 floor rather than the text floor
    // even though it is a color.
    path: "color.focus-ring",
    type: "color",
    value: "#333333",
    doc: "Focus indicator.",
    floors: [{ fg: "color.focus-ring", bg: "color.surface", min: 3 }],
  },
  {
    // A control's fill color is not a usable link color: a theme whose primary
    // equals its text makes every link invisible in body copy while its
    // buttons look perfect.
    path: "color.link",
    type: "color",
    value: "#175cd3",
    doc: "Prose links.",
    // The role's warning made mechanical: a link that cannot be read on the
    // page it sits on fails validation like any other text.
    floors: [{ fg: "color.link", bg: "color.surface", min: 4.5 }],
  },
  {
    path: "font.family.sans",
    type: "fontFamily",
    value: "system-ui, sans-serif",
    doc: "Body and UI text.",
  },
  // The focus ring is shared by every interactive element rather than owned by
  // the button: a link, a field, a summary and a dialog all need one.
  {
    path: "focus.width",
    type: "dimension",
    value: "2px",
    doc: "Focus ring width.",
  },
  {
    path: "focus.offset",
    type: "dimension",
    value: "2px",
    doc: "Focus ring offset.",
  },
];

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
  for (const path of baselineScalePaths()) paths.add(path);
  return [...paths];
}

/**
 * Every scale step the baseline states, as dotted paths.
 *
 * The baseline is the vocabulary: a token it states is spendable by any
 * utility or primitive, so a theme that omits one breaks whatever spends
 * it — silently, in that theme only. A missing step is incomplete, not
 * minimal. Per-element groups are excluded: each carries a global fallback,
 * and the contract says a theme may declare none of them. The opacity
 * ladder is excluded: its utilities carry the conventional fraction as a
 * `var()` fallback, so a missing step degrades to the same value instead
 * of breaking. The heading and body faces are excluded: the display face
 * falls back to the heading family and the heading to the body, so a theme
 * that names neither still has a face for its headings.
 */
function baselineScalePaths(): readonly string[] {
  return baselineScales().map((entry) => entry.path);
}

/** One baseline scale step: the path, the type, and the baseline's value. */
export interface BaselineScale {
  readonly path: string;
  readonly type: TokenType;
  readonly value: unknown;
  readonly doc: string;
}

/**
 * The baseline's scale steps, with type and value.
 *
 * The scaffold writes them: the shared ruler arrives ready, and the palette
 * arrives as placeholders. Same exclusions as the required paths — a step
 * excluded there is excluded here, so the two cannot disagree about what a
 * theme owes.
 */
export function baselineScales(): readonly BaselineScale[] {
  const parsed = parseTokens(baseline);
  if (!parsed.ok) {
    throw new Error(
      `contract: baseline theme does not parse: ${parsed.error}`,
    );
  }
  const optionalRoots = new Set(ELEMENT_ROLES.map((role) => role.group));
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
          dotted.startsWith("font.element.") ||
          dotted.startsWith("font.style.") ||
          n.path[0] === "opacity" ||
          dotted === "font.family.heading" ||
          dotted === "font.family.body")
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
}

const TokenTypeSchema: JsonSchema = {
  type: "string",
  enum: [...TOKEN_TYPES],
};

/** One declared token: a value, optionally typed at the group level. */
function leafSchema(doc: string): JsonSchema {
  return {
    type: "object",
    description: doc,
    additionalProperties: true,
    required: ["$value"],
    properties: {
      $value: {},
      $type: TokenTypeSchema,
      $description: { type: "string" },
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
  // The baseline's scales are required for the same reason the roles are:
  // a step the baseline states is spendable by any utility, so a theme
  // that omits one breaks whatever spends it. Same exclusions as the
  // required paths — the builder reads them, so the two cannot disagree.
  for (const scale of baselineScales()) {
    gather(scale.path.split(".")[0] as string, scale.path, true);
  }
  // The per-element groups are known to the contract, so the schema says what
  // they hold — but they are OPTIONAL: a theme that declares none of them is
  // complete, and the rules fall back to the shared scales. What the schema
  // must not do is require a group nothing demands, or make a theme that
  // omits one invalid for the sake of a decision it never made.
  for (const role of ELEMENT_ROLES) gather(role.group, role.path, false);
  // The per-element typography is optional for the same reason: a theme that
  // says nothing about a heading gets the system's answer.
  for (const role of ELEMENT_TYPE_ROLES) {
    gather(role.path.split(".")[0] as string, role.path, false);
  }
  for (const [group, entry] of groups) {
    const schema = groupSchema(entry.paths, entry.required);
    // A group a theme does not have to declare is OPTIONAL in the schema:
    // the per-element groups and the per-element typography are decisions a
    // theme MAY make, and a document that omits them is complete. Saying
    // otherwise would make a scaffolded theme — which carries neither — fail
    // the schema that describes it.
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
  const byType = new Map<string, ElementTypeDeclaration>(
    ELEMENT_TYPE_ROLES.map((role) => [role.path, role]),
  );
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
    const type = byType.get(path);
    const doc = role?.doc ?? element?.doc ?? type?.doc ?? byScale.get(path)?.doc;
    if (doc === undefined) continue;
    level[segments[segments.length - 1] as string] = {
      kind: "leaf",
      required: required.has(path),
      schema: leafSchema(doc),
    };
  }
  return toSchema(shape);
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
