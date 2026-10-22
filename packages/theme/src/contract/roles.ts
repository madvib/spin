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

import { Type } from "@sinclair/typebox";
import type { TSchema } from "@sinclair/typebox";
import { TOKEN_TYPES } from "../pipeline/types.ts";
import type { TokenType } from "../pipeline/types.ts";
import { ELEMENT_ROLES } from "./elements.ts";
import { ELEMENT_TYPE_ROLES } from "./typography.ts";
import type { ElementTypeDeclaration } from "./typography.ts";

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
  return BASE_ROLES.map((role) => role.path);
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
    properties[group] = groupSchema(entry.paths, entry.required);
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

/**
 * A group before conversion: either a nested group or a finished leaf.
 *
 * Building the nested shape first and converting once at the end keeps every
 * step typed — an accumulator of `TSchema` means the leaves are known to be
 * schemas and the compiler checks the assembly.
 */
type GroupShape = { [segment: string]: TSchema | GroupShape };

/** The nested schema for one token group, built from its role paths. */
function groupSchema(
  paths: string[],
  required: ReadonlySet<string>,
): TSchema {
  const byRole = new Map(BASE_ROLES.map((role) => [role.path, role]));
  const byElement = new Map(ELEMENT_ROLES.map((role) => [role.path, role]));
  const byType = new Map<string, ElementTypeDeclaration>(
    ELEMENT_TYPE_ROLES.map((role) => [role.path, role]),
  );
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
    const type = byType.get(path);
    const doc = role?.doc ?? element?.doc ?? type?.doc;
    if (doc === undefined) continue;
    const leaf = leafSchema(doc);
    level[segments[segments.length - 1] as string] = required.has(path)
      ? leaf
      : Type.Optional(leaf);
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
