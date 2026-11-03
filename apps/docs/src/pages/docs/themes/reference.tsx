/**
 * Token Reference: DTCG grammar, 12 core token groups, grouped required roles, and per-element tokens.
 */
import { createMemo, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import {
  Chip,
  PageHeader,
  PropList,
  Section,
  starterDoc,
  type PropEntry,
} from "../../../ui/index.ts";
import {
  elementGroups,
  elementTokens,
  FLOORS,
  groupTypes,
  ROLES,
  schemaFacts,
  statedValue,
  TYPES,
} from "../../../theme-docs.ts";

const RESERVED_KEYS: readonly PropEntry[] = [
  {
    name: "$value",
    badge: "Required on leaves",
    description:
      "The token's base value (string, number, boolean, string[] for font stacks, or {group.token} alias).",
  },
  {
    name: "$type",
    badge: "Inherited or leaf",
    description:
      "One of the 15 closed DTCG token types. Declared on a parent group or on individual leaves.",
  },
  {
    name: "$modes",
    badge: "{ light?, dark? }",
    description:
      "Optional per-mode override map on color, shadow, and focus tokens.",
  },
  {
    name: "$description",
    badge: "Optional",
    description:
      "Human-readable note on the document root, a group, or a token leaf.",
  },
  {
    name: "$extensions",
    badge: "spin.fonts",
    description:
      "Tooling metadata; $extensions.spin.fonts declares Fontsource web font families and weights.",
  },
  {
    name: "$deprecated",
    badge: "boolean | string",
    description:
      "Marks a token as deprecated while keeping its CSS variable emitted.",
  },
];

const GROUP_DESCRIPTIONS: Readonly<Record<string, string>> = {
  color:
    "Surfaces, inks, primary/secondary/accent actions, semantic status pairs, borders, and raw palette ramps.",
  font:
    "Font family stacks (sans, heading, mono), monotonic size scale (2xs–display), weights, line heights, and tracking.",
  spacing:
    "Monotonic spatial scale (0, 1..64) consumed by padding, margin, and gap utilities.",
  radius:
    "Corner radius steps (none, sm, md, lg, full) consumed by rounded-* utilities and element rules.",
  shadow:
    "Elevation shadow tokens (sm, md, lg) consumed by shadow-* utilities and floating surfaces.",
  motion:
    "Transition durations (fast, base, slow, loop) and easing curves (standard, decelerate, accelerate, linear).",
  icon: "Icon sizing scale (xs, sm, md, lg, xl) consumed by icon-* utilities.",
  breakpoint:
    "Responsive viewport widths (sm, md, lg, xl, 2xl) for responsive variant prefixes.",
  opacity:
    "Named opacity steps (disabled, muted, backdrop) for disabled controls and overlays.",
  border:
    "Stroke widths (width, width-2, width-4, width-8) and composite border tokens.",
  focus:
    "Keyboard focus ring width (focus.width) and offset (focus.offset).",
  "z-index":
    "Stacking layers (base, raised, dropdown, sticky, overlay, modal, popover, toast, tooltip).",
};

const TYPE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  color: "Hex (#rrggbb), rgb()/hsl()/oklch(), or CSS named color.",
  dimension: "Length with px or rem unit (0 may be unitless).",
  fontFamily: "Font family name or ordered fallback array of family names.",
  fontWeight: "Numeric weight (100–900) or weight keyword.",
  duration: "Time duration with ms or s unit (e.g. 150ms).",
  cubicBezier: "Four-number [x1, y1, x2, y2] array or CSS easing string.",
  number: "Unitless number (line-height ratios, opacity, z-index).",
  boolean: "Boolean flag projected to CSS as 1 (true) or 0 (false).",
  string: "Keyword value for element tokens (e.g. uppercase, 1px solid).",
  shadow: "CSS box-shadow value or structured DTCG shadow object.",
  border: "CSS border shorthand or structured DTCG border object.",
  transition: "Structured DTCG transition object.",
  strokeStyle: "CSS border-style keyword (solid, dashed, dotted).",
  gradient: "CSS linear-gradient() or radial-gradient() value.",
  typography: "Composite typography object.",
};

interface RoleFamily {
  readonly id: string;
  readonly title: string;
  readonly match: (path: string) => boolean;
}

const ROLE_FAMILIES: readonly RoleFamily[] = [
  {
    id: "roles-surfaces-inks",
    title: "Surfaces & Inks",
    match: (p) =>
      p.startsWith("color.surface") ||
      p === "color.field" ||
      p === "color.scrim" ||
      p.startsWith("color.text") ||
      p.startsWith("color.link"),
  },
  {
    id: "roles-actions",
    title: "Primary, Secondary & Accent",
    match: (p) =>
      p.startsWith("color.primary") ||
      p.startsWith("color.on-primary") ||
      p.startsWith("color.secondary") ||
      p.startsWith("color.on-secondary") ||
      p.startsWith("color.accent") ||
      p.startsWith("color.on-accent"),
  },
  {
    id: "roles-semantic",
    title: "Semantic Status",
    match: (p) => p.startsWith("color.semantic."),
  },
  {
    id: "roles-states-borders",
    title: "Interactive States & Borders",
    match: (p) =>
      p.startsWith("color.selected") ||
      p.startsWith("color.disabled") ||
      p.startsWith("color.border") ||
      p === "color.focus-ring",
  },
  {
    id: "roles-typography-focus",
    title: "Typography & Focus Geometry",
    match: (p) => !p.startsWith("color."),
  },
];

export default function ThemesReference(): JSX.Element {
  const schema = schemaFacts();
  const elements = elementGroups();
  const doc = createMemo(() => starterDoc() as Record<string, unknown>);

  const floorByFg = new Map<string, (typeof FLOORS)[number]>();
  for (const floor of FLOORS) {
    if (!floorByFg.has(floor.fg)) floorByFg.set(floor.fg, floor);
  }

  const groupEntries: readonly PropEntry[] = schema.groups.map((group) => {
    const required = schema.requiredGroups.includes(group);
    const types = groupTypes(group);
    const reqRoles = schema.requiredRoles.get(group) ?? [];
    return {
      name: group,
      type: types.join(" | "),
      badge: required ? "required" : "optional",
      description: (
        <div class="flex flex-col gap-2">
          <span>{GROUP_DESCRIPTIONS[group] ?? `${group} token group.`}</span>
          <Show when={reqRoles.length > 0}>
            <div class="flex flex-wrap gap-1">
              <For each={reqRoles}>{(role) => <Chip>{role}</Chip>}</For>
            </div>
          </Show>
        </div>
      ),
    };
  });

  const typeEntries: readonly PropEntry[] = TYPES.map((t) => ({
    name: t,
    badge: "$type",
    description: TYPE_DESCRIPTIONS[t] ?? `DTCG ${t} token value.`,
  }));

  const entriesForFamily = (family: RoleFamily): readonly PropEntry[] =>
    ROLES.filter((r) => family.match(r.path)).map((role) => {
      const floor = floorByFg.get(role.path);
      const currentVal = statedValue(doc(), role.path);
      return {
        name: role.path,
        type: role.type,
        defaultValue: currentVal,
        badge:
          floor !== undefined ? `≥ ${floor.min}:1 on ${floor.bg}` : undefined,
        description: role.doc,
      };
    });

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Token Reference"
        lede="Complete reference of DTCG document keys, the 12 core token groups, required base roles grouped by family, and optional per-element token overrides."
      />

      <Section id="grammar" title="Document keys and token types">
        <p class="max-w-prose">
          A Spin theme is a W3C DTCG JSON document. Any object with a{" "}
          <code>$value</code> property is a token leaf; any other object is a
          group whose path segments join with <code>-</code> to form the CSS
          custom property name (<code>color.surface-raised</code> →{" "}
          <code>--color-surface-raised</code>).
        </p>
        <PropList items={RESERVED_KEYS} />

        <h3 id="token-types">Supported $type values ({TYPES.length})</h3>
        <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <For each={typeEntries}>
            {(entry) => (
              <div class="flex flex-col gap-1 rounded-md border border-border bg-surface-raised p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="font-mono text-sm font-semibold text-text">
                    {entry.name}
                  </span>
                  <Show when={entry.badge}>
                    <span class="badge shrink-0">{entry.badge}</span>
                  </Show>
                </div>
                <span class="text-sm text-text-muted">{entry.description}</span>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="groups" title="Core token groups">
        <p class="max-w-prose">
          The theme schema defines {schema.groups.length} top-level token
          groups ({schema.requiredGroups.length} required and{" "}
          {schema.groups.length - schema.requiredGroups.length} optional with
          built-in fallbacks):
        </p>
        <PropList items={groupEntries} />
      </Section>

      <Section id="roles" title="Required roles by family">
        <p class="max-w-prose">
          Every theme must declare {ROLES.length} required roles. Default
          values shown below are read live from the active starter theme.
        </p>
        <For each={ROLE_FAMILIES}>
          {(family) => (
            <div class="mt-6 flex flex-col gap-2">
              <h3 id={family.id}>{family.title}</h3>
              <PropList items={entriesForFamily(family)} />
            </div>
          )}
        </For>
      </Section>

      <Section id="element-tokens" title="Per-element token reference">
        <p class="max-w-prose">
          All {elements.length} per-element groups are optional. When omitted,
          each element falls back to the system scales above.
        </p>
        <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <For each={elements}>
            {(group) => (
              <div class="flex flex-col gap-2 rounded-md border border-border bg-surface-raised p-4">
                <div class="flex items-baseline justify-between gap-2">
                  <span class="font-mono text-sm font-semibold text-text">
                    {group}
                  </span>
                  <span class="font-mono text-xs text-text-muted">
                    {elementTokens(group).length} tokens
                  </span>
                </div>
                <div class="flex flex-wrap gap-1">
                  <For each={elementTokens(group)}>
                    {(token) => (
                      <Chip>
                        {token.path}: {token.type}
                      </Chip>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </Section>
    </main>
  );
}
