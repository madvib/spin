/**
 * What a theme must declare, declared once.
 *
 * Each entry below carries everything a role is: the path that names it, the
 * type it must have, the value a scaffold writes for it, the documentation an
 * editor shows, and the contrast floor it owes. Everything else derives:
 * `requiredPaths()` for validation, `themeSchema()` for the JSON Schema, and
 * `scaffoldTheme()` for a minimal document.
 */

import { Type } from "@sinclair/typebox";
import type { TSchema } from "@sinclair/typebox";
import { TOKEN_TYPES } from "../pipeline/types.ts";
import type { TokenType } from "../pipeline/types.ts";
import { ELEMENT_ROLES } from "./elements.ts";

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
  readonly floor?: LegibilityFloor;
}

const SURFACE: LegibilityFloor = {
  fg: "color.text",
  bg: "color.surface",
  min: 4.5,
};
const MUTED: LegibilityFloor = {
  fg: "color.text-muted",
  bg: "color.surface",
  min: 3,
};
const INDICATOR: LegibilityFloor = {
  fg: "color.semantic.error",
  bg: "color.surface",
  min: 3,
};

/**
 * Roles a theme must declare regardless of which components it enables: the
 * palette, the contrast floors that make a palette usable, and the focus ring
 * every interactive element shares.
 */
export const BASE_ROLES: readonly RoleDeclaration[] = [
  {
    path: "color.text",
    type: "color",
    value: "#111111",
    doc: "Default body text.",
    floor: SURFACE,
  },
  {
    path: "color.text-muted",
    type: "color",
    value: "#555555",
    doc: "Secondary text.",
    floor: MUTED,
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
    floor: {
      fg: "color.on-primary",
      bg: "color.primary",
      min: 4.5,
    },
  },
  {
    path: "color.secondary",
    type: "color",
    value: "#444444",
    doc: "Secondary actions.",
  },
  {
    path: "color.accent",
    type: "color",
    value: "#555555",
    doc: "Supporting emphasis.",
  },
  {
    path: "color.semantic.success",
    type: "color",
    value: "#1a7f37",
    doc: "Success status.",
    floor: INDICATOR,
  },
  {
    path: "color.semantic.warning",
    type: "color",
    value: "#9a6700",
    doc: "Warning status.",
    floor: { ...INDICATOR, fg: "color.semantic.warning" },
  },
  {
    path: "color.semantic.error",
    type: "color",
    value: "#b42318",
    doc: "Error status.",
    floor: INDICATOR,
  },
  {
    path: "color.semantic.info",
    type: "color",
    value: "#175cd3",
    doc: "Info status.",
    floor: { ...INDICATOR, fg: "color.semantic.info" },
  },
  {
    path: "color.on-primary",
    type: "color",
    value: "#ffffff",
    doc: "Text on a primary fill.",
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
    floor: {
      fg: "color.on-semantic-error",
      bg: "color.semantic.error",
      min: 4.5,
    },
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
    floor: {
      fg: "color.on-disabled",
      bg: "color.disabled",
      min: 4.5,
    },
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
    floor: { fg: "color.focus-ring", bg: "color.surface", min: 3 },
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
    floor: { fg: "color.link", bg: "color.surface", min: 4.5 },
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

/** The paths every theme must declare. */
export function requiredPaths(): readonly string[] {
  return BASE_ROLES.map((role) => role.path);
}

/** The contrast floors, attached to the roles that owe them. */
export function legibilityFloors(): LegibilityFloor[] {
  return BASE_ROLES.flatMap((role) => (role.floor ? [role.floor] : []));
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

const TokenTypeSchema = Type.Union(
  TOKEN_TYPES.map((type) => Type.Literal(type)),
);

/** One declared token: a value, optionally typed at the group level. */
function leafSchema(doc: string) {
  return Type.Object(
    {
      $value: Type.Unknown(),
      $type: Type.Optional(TokenTypeSchema),
      $description: Type.Optional(Type.String()),
    },
    { additionalProperties: true, description: doc },
  );
}

/**
 * The theme document schema.
 *
 * A TypeBox type is already JSON Schema — that is the shape of the library, so
 * `deno task schema` writes `schema.json` straight from the builder with no
 * conversion step. Declared roles are non-optional and therefore land in
 * `required` automatically; everything else a theme may add is permitted by
 * `additionalProperties`.
 */
export function themeSchema(): Record<string, unknown> {
  const properties: Record<string, TSchema> = {};
  for (const [group, paths] of Object.entries(groupedPaths())) {
    properties[group] = groupSchema(paths, false);
  }
  // The per-element groups are known to the contract, so the schema says what
  // they hold — but they are OPTIONAL: a theme that declares none of them is
  // complete, and the rules fall back to the shared scales. What the schema
  // must not do is require a group nothing demands, or make a theme that
  // omits one invalid for the sake of a decision it never made.
  for (const [group, paths] of Object.entries(elementGroupPaths())) {
    properties[group] = groupSchema(paths, true);
  }
  // `modes` is document metadata, not a token: it sits at the root beside
  // the groups and no emitter reads it. `additionalProperties` would already
  // admit it, but the schema says what a document may carry so the field is
  // listed — and constrained to the two modes the pipeline understands.
  properties["modes"] = Type.Optional(
    Type.Array(Type.Union([Type.Literal("light"), Type.Literal("dark")]), {
      description:
        "The modes this theme serves. A mode the theme serves but does not override falls back to the base values.",
    }),
  );
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://spin.dev/theme.schema.json",
    title: "Spin theme",
    ...Type.Object(properties, { additionalProperties: true }),
  };
}

/** Role paths grouped by their top-level token group. */
function groupedPaths(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const role of BASE_ROLES) {
    const group = role.path.split(".")[0] as string;
    (out[group] ??= []).push(role.path);
  }
  return out;
}

/** The per-element paths, grouped by the group they live in. */
function elementGroupPaths(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const role of ELEMENT_ROLES) {
    (out[role.group] ??= []).push(role.path);
  }
  return out;
}

/**
 * A group before conversion: either a nested group or a finished leaf.
 *
 * Building the nested shape first and converting once at the end keeps every
 * step typed — an accumulator of `TSchema` means the leaves are known to be
 * schemas and the compiler checks the assembly.
 */
type GroupShape = { [segment: string]: TSchema | GroupShape };

/** The nested schema for one token group, built from its role paths. */
function groupSchema(paths: string[], optional: boolean): TSchema {
  const byRole = new Map(BASE_ROLES.map((role) => [role.path, role]));
  const byElement = new Map(ELEMENT_ROLES.map((role) => [role.path, role]));
  const shape: GroupShape = {};
  for (const path of paths) {
    const segments = path.split(".");
    let level = shape;
    for (const segment of segments.slice(1, -1)) {
      const child = level[segment];
      level = typeof child === "object" && child !== null &&
          !("type" in child)
        ? child as GroupShape
        : (level[segment] = {}) as GroupShape;
    }
    const role = byRole.get(path);
    const element = byElement.get(path);
    if (role !== undefined) {
      level[segments[segments.length - 1] as string] = leafSchema(role.doc);
    } else if (element !== undefined) {
      const leaf = leafSchema(element.doc);
      level[segments[segments.length - 1] as string] = optional
        ? Type.Optional(leaf)
        : leaf;
    }
  }
  return toSchema(shape);
}

/** Convert an assembled group into the TypeBox type that is its JSON Schema. */
function toSchema(shape: GroupShape): TSchema {
  const properties: Record<string, TSchema> = {};
  for (const [key, value] of Object.entries(shape)) {
    // A leaf already carries its schema; anything without a `type` is a group
    // that still needs converting.
    properties[key] = isLeaf(value) ? value : toSchema(value as GroupShape);
  }
  return Type.Object(properties, { additionalProperties: true });
}

/** True when a value is a finished schema rather than an unconverted group. */
function isLeaf(value: TSchema | GroupShape): value is TSchema {
  return typeof value === "object" && value !== null && "type" in value;
}
