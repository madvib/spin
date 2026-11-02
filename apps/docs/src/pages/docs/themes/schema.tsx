/**
 * Token Schema: groups, element groups, token types, required roles, modes,
 * and $extensions.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { starterGroups } from "@spinjs/spin/theme/themes";
import { Chip, Code, Section } from "../../../bits.tsx";
import { PageHeader, PropList, type PropEntry } from "../../../ui/index.ts";
import {
  elementGroups,
  elementTokens,
  groupTypes,
  ROLES,
  schemaFacts,
  TYPES,
} from "../../../theme-docs.ts";

const DOCUMENT = `{
  "$extensions": {
    "spin": {
      "fonts": [
        {
          "family": "Inter",
          "src": "url(https://example.com/inter.woff2) format(\\"woff2\\")",
          "weight": "100 900",
          "style": "normal",
          "display": "swap"
        }
      ]
    }
  },
  "$description": "One line about what this theme is.",
  "color": {
    "$type": "color",
    "primary": {
      "$value": "#c8102e",
      "$description": "The brand's red.",
      "$modes": { "dark": "#ff5a63" }
    },
    "surface": { "$value": "{color.neutral.50}" }
  },
  "spacing": {
    "$type": "dimension",
    "4": { "$value": "1rem" }
  },
  "modes": ["light", "dark"]
}`;

const GROUP_ABOUT: Record<string, string> = {
  color:
    "Palette roles: surfaces (surface, surface-raised, surface-sunken, field, scrim), inks (text, text-muted, link), acting fills (primary, secondary, accent) with paired on-* foregrounds, semantic.{success,warning,error,info} with on-semantic-*, selected/disabled pairs, border/border-strong, focus-ring, and neutral.50–900.",
  font:
    "Typography: family.{sans,heading,body,serif,mono,brand}, the nine-step size ladder (2xs through display), weight.{regular,medium,semibold,bold}, and letter-spacing.{tighter,tight,normal,wide,wider,widest}.",
  spacing:
    "Monotonic length scale (0 through 64) spent by every margin, padding, gap, and inset utility.",
  radius:
    "Corner-rounding ladder (none, sm, md, lg, full) shared across controls, cards, and overlays.",
  shadow:
    "Elevation ladder (sm, md, lg); may carry $modes overrides because shadow color is an ink over the surface.",
  motion:
    "Timing scale: duration.{fast,base,slow,loop} (where loop holds the 250ms strobe floor for endless animations) and easing.{linear,standard,decelerate,accelerate}.",
  icon: "Root-relative glyph dimensions (sm, md, lg).",
  breakpoint:
    "Viewport width thresholds (sm, md, lg, xl) where responsive layout steps change.",
  opacity:
    "Fractional transparency steps (0 through 100, values 0 to 1); optional because utilities carry the fraction as fallback.",
  border:
    "Stroke width ladder (width, width-2, width-4, width-8) that controls and dividers draw with.",
  focus:
    "Shared focus ring geometry (width and offset) paired with color.focus-ring.",
  "z-index":
    "Named stacking layers (base, dropdown, modal, toast) for overlays.",
  avatar: "Per-element square size ladder (sm, md, lg) for avatars.",
  badge: "Per-element badge tokens: edge stroke width and pill boolean.",
  button:
    "Per-element button tokens: weight, case, tracking, edge, shadow, and shadow-hover.",
  checkbox: "Per-element checkbox inset depth scalar.",
  switch: "Per-element switch inset depth scalar.",
  card: "Per-element card corner radius, padding, border color, and elevation.",
  alert:
    "Per-element alert corner radius, block/inline padding, and edge color.",
  field: "Per-element field corner radius and border color.",
  stat: "Per-element stat figure size, weight, and font family.",
  table:
    "Per-element table header weight, row rule color, and zebra stripe fill.",
  link: "Per-element prose link underline thickness.",
  gradient: "Optional named CSS gradients declared by a theme.",
};

const TYPE_ABOUT: Record<string, readonly [string, string]> = {
  boolean: [
    "Boolean switch (true or false).",
    "Read by element rules such as badge.pill.",
  ],
  color: [
    "CSS color value.",
    "Hex, oklch/rgb/hsl function, or {path} alias.",
  ],
  cubicBezier: [
    "Timing curve.",
    "CSS easing keyword or cubic-bezier(x1, y1, x2, y2).",
  ],
  dimension: [
    "Spatial length.",
    "Number with a CSS unit (rem, px, em, %) or bare 0.",
  ],
  duration: [
    "Time interval.",
    "Number with ms or s unit.",
  ],
  fontFamily: [
    "Font family stack.",
    "Comma-separated family names.",
  ],
  fontWeight: [
    "Font weight.",
    "Numeric weight (100–900) or CSS weight keyword.",
  ],
  gradient: [
    "CSS gradient value.",
    "linear-gradient, radial-gradient, or conic-gradient.",
  ],
  number: ["Unitless scalar.", "Finite number."],
  shadow: ["Box shadow value.", "One or more CSS box-shadow layers or none."],
  strokeStyle: [
    "Border line style.",
    "solid, dashed, dotted, or none.",
  ],
  textTransform: [
    "Letter case transform.",
    "none, capitalize, uppercase, lowercase, or full-width.",
  ],
  transition: ["CSS transition shorthand.", "Any non-empty value."],
  typography: ["Typography composite shorthand.", "Any non-empty value."],
  border: ["Border composite shorthand.", "Any non-empty value."],
};

export default function Schema(): JSX.Element {
  const facts = schemaFacts();
  const groups = starterGroups();
  const elements = elementGroups();

  const groupItems = (): readonly PropEntry[] =>
    groups.map((group) => {
      const req = facts.requiredRoles.get(group) ?? [];
      return {
        name: group,
        badge: groupTypes(group).join(", "),
        required: facts.requiredGroups.includes(group),
        description:
          GROUP_ABOUT[group] ?? "A group declared by the starter themes.",
        detail:
          req.length > 0 ? `Required paths: ${req.join(", ")}` : "Optional group",
      };
    });

  const typeItems = (): readonly PropEntry[] =>
    TYPES.map((type) => ({
      name: type,
      badge: TYPE_ABOUT[type]?.[0] ?? "Token type",
      description: TYPE_ABOUT[type]?.[1] ?? "Any non-empty value.",
    }));

  const roleItems = (): readonly PropEntry[] =>
    ROLES.map((role) => ({
      name: role.path,
      badge: role.type,
      defaultValue:
        role.floor === undefined
          ? undefined
          : `≥ ${role.floor.min}:1 (${role.floor.fg} / ${role.floor.bg})`,
      description: role.doc,
    }));

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Token Schema"
        lede={
          <>
            Every token group, <code>$type</code>, and required role in Spin's
            DTCG schema, read directly from the validator contract. Read{" "}
            <A href="/docs/themes/overview">Themes &amp; Modes</A> first for an
            overview of how documents and modes work.
          </>
        }
      />

      <Section id="document" title="The document">
        <p class="max-w-prose">
          The root of a document holds groups, and a group holds tokens and
          further groups. A token is an object with a <code>$value</code>, and
          it may carry <code>$type</code>, <code>$description</code>,{" "}
          <code>$extensions</code>, <code>$deprecated</code>, and{" "}
          <code>$modes</code>. Those six keys are the DTCG reserved set (
          <code>RESERVED</code>); every other key at a level is a child token
          or group.
        </p>
        <div class="my-3">
          <Code code={DOCUMENT} lang="json" title="spin/theme.json" />
        </div>
        <p class="max-w-prose">
          A group may declare a <code>$type</code> of its own as the default
          for everything under it (DTCG 2025.10 §6.7). A node that carries both{" "}
          <code>$value</code> and children, or a group with no token leaves, is
          a parse error.
        </p>
        <p class="max-w-prose">
          An alias is written as the dotted path of another token in braces:{" "}
          <code>{"{color.neutral.50}"}</code>. <code>resolveAliases</code>{" "}
          follows the chain across <code>indexTree(tree)</code>, detects
          cycles, and records any missing targets in <code>unresolved</code>.
        </p>
      </Section>

      <Section id="groups" title="The groups">
        <p class="max-w-prose">
          The twelve core system groups are <code>color</code>,{" "}
          <code>font</code>, <code>spacing</code>, <code>radius</code>,{" "}
          <code>shadow</code>, <code>motion</code>, <code>icon</code>,{" "}
          <code>breakpoint</code>, <code>opacity</code>, <code>border</code>,{" "}
          <code>focus</code>, and <code>z-index</code>. Every group that holds
          a base role or baseline scale step is required by{" "}
          <code>spinThemeJsonSchema()</code> and <code>requiredPaths()</code>;{" "}
          <code>opacity</code> and the per-element groups are optional.
        </p>
        <div class="my-3 flex flex-wrap gap-2">
          <For each={facts.requiredGroups}>
            {(group) => <Chip>required: {group}</Chip>}
          </For>
        </div>
        <div class="mt-4">
          <PropList items={groupItems()} />
        </div>
      </Section>

      <Section id="elements" title="The per-element groups">
        <p class="max-w-prose">
          Per-element groups let a theme restyle a specific element (such as{" "}
          <code>button</code> or <code>card</code>) without altering system
          scales. They are optional in <code>requiredPaths()</code> and{" "}
          <code>spinThemeJsonSchema()</code>, and included by{" "}
          <code>scaffoldTheme()</code> for convenience.
        </p>
        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <For each={elements}>
            {(group) => (
              <div class="rounded-md border border-border bg-surface-raised p-4">
                <p class="font-mono text-sm font-semibold text-text">{group}</p>
                <ul class="grid gap-1 list-none">
                  <For each={elementTokens(group)}>
                    {(token) => (
                      <li class="flex items-baseline justify-between gap-3 text-sm">
                        <span class="font-mono text-xs text-primary">
                          {token.path}
                        </span>
                        <span class="font-mono text-xs text-text-muted">
                          {token.type}
                        </span>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="types" title="The types">
        <p class="max-w-prose">
          Every token resolves to a <code>$type</code> from this closed list. An
          unknown type or untyped leaf is a parse error.
        </p>
        <div class="mt-4">
          <PropList items={typeItems()} />
        </div>
      </Section>

      <Section id="roles" title="The required roles">
        <p class="max-w-prose">
          Every theme must declare these base roles and satisfy their contrast
          floors in every served mode:
        </p>
        <div class="mt-4">
          <PropList items={roleItems()} />
        </div>
      </Section>

      <Section id="modes" title="Modes">
        <p class="max-w-prose">
          Root <code>modes</code> (<code>["light"]</code>,{" "}
          <code>["dark"]</code>, or <code>["light", "dark"]</code>) declares
          which modes the document serves, and <code>$modes</code> on a token
          leaf declares how that token varies by mode:
        </p>
        <div class="my-3">
          <Code
            lang="json"
            title="Mode override"
            code={`"primary": {
  "$value": "#c8102e",
  "$modes": { "dark": "#ff5a63" }
}`}
          />
        </div>
        <p class="max-w-prose">
          In any mode, a token without a <code>$modes.&lt;mode&gt;</code> entry
          falls back to its base <code>$value</code> (
          <code>leaf.modes?.[mode] ?? leaf.value</code>). Modes may only change
          ink (<code>color</code> and <code>shadow</code>) and{" "}
          <code>focus</code> (<code>focus.width</code>,{" "}
          <code>focus.offset</code>).
        </p>
      </Section>

      <Section id="extensions" title="What lives under $extensions">
        <p class="max-w-prose">
          <code>$extensions</code> holds document metadata outside the token
          tree. <code>parseDocument(input)</code> returns{" "}
          <code>extensions</code> alongside <code>tree</code> and{" "}
          <code>modes</code>, whereas <code>parseTokens(input)</code> returns
          only the token tree. Under <code>$extensions.spin.fonts</code>, a
          theme may declare external typeface sources:
        </p>
        <div class="my-3">
          <Code
            lang="json"
            title="$extensions.spin.fonts"
            code={`"$extensions": {
  "spin": {
    "fonts": [
      {
        "family": "Inter",
        "src": "url(https://example.com/inter.woff2) format(\\"woff2\\")",
        "weight": "100 900",
        "style": "normal",
        "display": "swap"
      }
    ]
  }
}`}
          />
        </div>
      </Section>
    </main>
  );
}
