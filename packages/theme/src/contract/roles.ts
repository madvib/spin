/**
 * What a theme must declare, declared once.
 *
 * Previously this contract was written four times — a flat list of role paths,
 * a hand-built JSON Schema with its own `required` arrays, a parallel table of
 * contrast pairs, and a scaffold placeholder table. Nothing connected them, so
 * renaming a role in one silently desynchronised the others.
 *
 * Each entry below carries everything the other three expressed: the path that
 * names it, the type it must have, the value a scaffold writes for it, the
 * documentation an editor shows, and the contrast floor it owes. Everything
 * else derives: `requiredPaths()` for validation, `themeSchema()` for the JSON
 * Schema, and `scaffoldTheme()` for a minimal document.
 */

import { Type } from "@sinclair/typebox";
import type { TSchema } from "@sinclair/typebox";
import { TOKEN_TYPES } from "../pipeline/types.ts";
import type { TokenType } from "../pipeline/types.ts";

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
    path: "color.on-danger",
    type: "color",
    value: "#ffffff",
    doc: "Text on a danger fill.",
    floor: { fg: "color.on-danger", bg: "color.semantic.error", min: 4.5 },
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

const TokenTypeSchema = Type.Union(
  TOKEN_TYPES.map((type) => Type.Literal(type)),
);

/** One declared token: a value, optionally typed at the group level. */
function leafSchema(role: RoleDeclaration) {
  return Type.Object(
    {
      $value: Type.Unknown(),
      $type: Type.Optional(TokenTypeSchema),
      $description: Type.Optional(Type.String()),
    },
    { additionalProperties: true, description: role.doc },
  );
}

/**
 * The theme document schema.
 *
 * A TypeBox type is already JSON Schema — that is the shape of the library, so
 * there is no conversion step and no generator script. Declared roles are
 * non-optional and therefore land in `required` automatically; everything else
 * a theme may add is permitted by `additionalProperties`.
 */
export function themeSchema(): Record<string, unknown> {
  const properties: Record<string, TSchema> = {};
  for (const [group, paths] of Object.entries(groupedPaths())) {
    properties[group] = groupSchema(paths);
  }
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

/**
 * A group before conversion: either a nested group or a finished leaf.
 *
 * Building the nested shape first and converting once at the end keeps every
 * step typed — an accumulator of `TSchema` means the leaves are known to be
 * schemas and the compiler checks the assembly.
 */
type GroupShape = { [segment: string]: TSchema | GroupShape };

/** The nested schema for one token group, built from its role paths. */
function groupSchema(paths: string[]): TSchema {
  const byRole = new Map(BASE_ROLES.map((role) => [role.path, role]));
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
    if (role) {
      level[segments[segments.length - 1] as string] = leafSchema(role);
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
