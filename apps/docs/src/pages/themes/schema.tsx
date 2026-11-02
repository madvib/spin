/**
 * The theme schema, as a reference.
 *
 * The groups, the types and the required roles are read out of the contract
 * the package ships and the JSON Schema it writes, so this page describes the
 * schema that exists rather than the one that was planned. The descriptions
 * are written here; the lists are not.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { starterGroups } from "@spinjs/spin/theme/themes";
import { Chip, Code, Section } from "../../bits.tsx";
import {
  elementGroups,
  elementTokens,
  groupTypes,
  ROLES,
  schemaFacts,
  TYPES,
} from "../../theme-docs.ts";

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
  icon:
    "Root-relative glyph dimensions (sm, md, lg).",
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
    "Per-element button tokens: weight, case, tracking, shadow, and shadow-hover.",
  checkbox: "Per-element checkbox inset depth scalar.",
  switch: "Per-element switch inset depth scalar.",
  card: "Per-element card corner radius, padding, border color, and elevation.",
  alert: "Per-element alert corner radius, block/inline padding, and edge color.",
  field: "Per-element field corner radius and border color.",
  stat: "Per-element stat figure size, weight, and font family.",
  table: "Per-element table header weight, row rule color, and zebra stripe fill.",
  link: "Per-element prose link underline thickness.",
  gradient: "Optional named CSS gradients declared by a theme.",
};

const TYPE_ABOUT: Record<string, readonly [string, string]> = {
  boolean: [
    "A switch.",
    "True or false. The rules read it as on or off, and false is a decision rather than an absence.",
  ],
  color: [
    "A color.",
    "A hex, a color function, or a reference to another token.",
  ],
  cubicBezier: [
    "A timing function: a keyword, or a cubic-bezier with four numbers.",
    "Any non-empty value.",
  ],
  dimension: [
    "A length.",
    "A number with a CSS unit, or a bare zero.",
  ],
  duration: [
    "A time: a number with a time unit.",
    "Any non-empty value.",
  ],
  fontFamily: [
    "A stack of family names.",
    "Any non-empty value.",
  ],
  fontWeight: [
    "A weight: a number, or one of the CSS weight keywords.",
    "Any non-empty value.",
  ],
  gradient: [
    "A gradient.",
    "Any non-empty value.",
  ],
  number: ["A plain number.", "A finite number."],
  shadow: [
    "One or more shadows.",
    "Any non-empty value.",
  ],
  strokeStyle: [
    "A line style: solid, dashed, dotted or none.",
    "Any non-empty value.",
  ],
  textTransform: [
    "A case.",
    "One of none, capitalize, uppercase, lowercase, full-width.",
  ],
  transition: [
    "A transition shorthand.",
    "Any non-empty value.",
  ],
  typography: [
    "A typography shorthand.",
    "Any non-empty value.",
  ],
  border: [
    "A border shorthand.",
    "Any non-empty value.",
  ],
};

export default function Schema(): JSX.Element {
  const facts = schemaFacts();
  const groups = starterGroups();
  const elements = elementGroups();
  return (
    <main class="mx-auto max-w-screen-lg px-6 py-10 md:py-16">
      <h1>Theme schema</h1>
      <p class="max-w-screen-md text-text-muted">
        A theme is a JSON object of groups. The groups the starters declare are
        the groups a theme owns; the roles the schema requires are the floor
        under them; and the types are the closed vocabulary a token may declare.
        The package writes the schema to <code>schema.json</code>{" "}
        and derives it from the same declaration the validator uses, so the
        three cannot drift. Read <A href="/themes">Theme Contract & Modes</A>
        {" "}
        first if the required roles are new to you.
      </p>
      <Section id="document" title="The document">
        <p>
          The root of a document holds groups, and a group holds tokens and
          further groups. A token is an object with a <code>$value</code>, and
          it may carry <code>$type</code>, <code>$description</code>,{" "}
          <code>$extensions</code>, <code>$deprecated</code>, and{" "}
          <code>$modes</code>. Those six keys are the DTCG reserved set (
          <code>RESERVED</code>); every other key at a level is a child token or
          group.
        </p>
        <Code code={DOCUMENT} lang="json" />
        <p>
          A group may declare a <code>$type</code>{" "}
          of its own, and that type is the default for everything under it. A
          token that declares no type takes the one from the closest ancestor
          group that declares one (DTCG 2025.10 §6.7). A node that carries both{" "}
          <code>$value</code> and children, or a group with no token leaves, is
          a parse error.
        </p>
        <p>
          An alias is a value written as the dotted path of another token in
          braces: <code>{"{color.neutral.50}"}</code>.{" "}
          <code>resolveAliases</code> follows the chain across{" "}
          <code>indexTree(tree)</code>, detects cycles, and records any missing
          targets in <code>unresolved</code>.
        </p>
      </Section>

      <Section id="groups" title="The groups">
        <p>
          These are the groups the shipped themes declare (
          <code>starterGroups()</code>), with the types their tokens use and the
          paths <code>spinThemeJsonSchema()</code> and{" "}
          <code>requiredPaths()</code> require inside them. The twelve core
          system groups are <code>color</code>, <code>font</code>,{" "}
          <code>spacing</code>, <code>radius</code>, <code>shadow</code>,{" "}
          <code>motion</code>, <code>icon</code>, <code>breakpoint</code>,{" "}
          <code>opacity</code>, <code>border</code>, <code>focus</code>, and{" "}
          <code>z-index</code>. Every group that holds a base role or baseline
          scale step is required by the schema; <code>opacity</code> and the
          per-element groups are optional.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <For each={facts.requiredGroups}>
            {(group) => <Chip>required: {group}</Chip>}
          </For>
        </div>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full border-collapse wrap">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4">group</th>
                <th class="py-2 pr-4">types</th>
                <th class="py-2 pr-4">what it is</th>
                <th class="py-2 pr-4">
                  required in it
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={groups}>
                {(group) => (
                  <tr class="border-b border-border">
                    <td class="font-mono text-xs text-text">
                      {group}
                    </td>
                    <td class="font-mono text-xs">
                      {groupTypes(group).join(", ")}
                    </td>
                    <td class="text-text-muted">
                      {GROUP_ABOUT[group] ??
                        "A group the starters declare. Nothing in the contract speaks about it."}
                    </td>
                    <td class="font-mono text-xs">
                      {(facts.requiredRoles.get(group) ?? []).join(", ") ||
                        "nothing"}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="elements" title="The per-element groups">
        <p>
          Some decisions belong to one element rather than to the system. Each
          of these groups is read by the element that owns it, so a theme can
          restyle a button without touching a badge.
        </p>
        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <For each={elements}>
            {(group) => (
              <div class="border border-border bg-surface-raised rounded-md p-4">
                <p class="font-mono text-sm text-text">{group}</p>
                <ul class="grid gap-1">
                  <For each={elementTokens(group)}>
                    {(token) => (
                      <li class="flex items-baseline justify-between gap-3 text-sm">
                        <span class="font-mono text-xs">{token.path}</span>
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
        <p class="text-sm">
          Per-element groups are optional in <code>requiredPaths()</code> and{" "}
          <code>spinThemeJsonSchema()</code>: a theme that omits{" "}
          <code>button</code> or <code>card</code> is complete and valid, and
          elements fall back to the shared system scales. When creating a new
          theme with <code>scaffoldTheme()</code>, the scaffold includes the
          per-element groups alongside the required base roles and baseline
          scales so the author can edit or remove them directly.
        </p>
      </Section>

      <Section id="types" title="The types">
        <p>
          A token may declare a{" "}
          <code>$type</code>, and the vocabulary is closed. An unknown type is a
          parse error, so a typo can never reach the stylesheet, and the list
          below is every type there is.
        </p>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full border-collapse wrap">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4">type</th>
                <th class="py-2 pr-4">what it is</th>
                <th class="py-2 pr-4">
                  what it accepts
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={TYPES}>
                {(type) => (
                  <tr class="border-b border-border">
                    <td class="font-mono text-xs text-text">
                      {type}
                    </td>
                    <td class="text-text-muted">
                      {TYPE_ABOUT[type]?.[0] ?? "A type in the vocabulary."}
                    </td>
                    <td class="text-text-muted">
                      {TYPE_ABOUT[type]?.[1] ??
                        "Any non-empty value."}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <p class="text-sm">
          A group that declares no <code>$type</code>{" "}
          and a token that declares none of its own is a parse error: a value
          with no type is a value nobody can check. The types the validator
          cannot judge are checked where the CSS consumes them instead, which is
          why their values are not constrained here.
        </p>
      </Section>

      <Section id="roles" title="The required roles">
        <p>
          These are the roles every theme must declare, whatever components it
          enables. The schema's <code>required</code>{" "}
          list is derived from this declaration, and the validator holds a
          document to it.
        </p>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full border-collapse wrap">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4">role</th>
                <th class="py-2 pr-4">type</th>
                <th class="py-2 pr-4">what it is</th>
                <th class="py-2 pr-4">the floor</th>
              </tr>
            </thead>
            <tbody>
              <For each={ROLES}>
                {(role) => (
                  <tr class="border-b border-border">
                    <td class="font-mono text-xs text-text">
                      {role.path}
                    </td>
                    <td class="font-mono text-xs">{role.type}</td>
                    <td class="text-text-muted">{role.doc}</td>
                    <td class="font-mono text-xs">
                      {role.floor === undefined
                        ? "none"
                        : `${role.floor.fg} on ${role.floor.bg}, ${role.floor.min}:1`}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <p class="text-sm">
          The scaffold writes every one of them, with a neutral placeholder that
          is valid and legible and obviously unfinished. A theme that looks
          finished was not scaffolded.
        </p>
      </Section>

      <Section id="modes" title="Modes">
        <p>
          A mode is a variant of a token, not a second theme. Two fields work
          together: the root <code>modes</code> array (<code>["light"]</code>,{" "}
          <code>["dark"]</code>, or <code>["light", "dark"]</code>) declares
          which modes the document serves, and <code>$modes</code> on a token
          leaf declares how that token varies by mode:
        </p>
        <Code
          class="mt-2"
          lang="json"
          code={`"primary": {
  "$value": "#c8102e",
  "$modes": { "dark": "#ff5a63" }
}`}
        />
        <p>
          In any mode, a token without a <code>$modes.&lt;mode&gt;</code> entry
          falls back to its base <code>$value</code> (
          <code>leaf.modes?.[mode] ?? leaf.value</code>). A mode is only allowed
          to change ink (<code>color</code> and <code>shadow</code> values) and
          the <code>focus</code> ring (<code>focus.width</code>,{" "}
          <code>focus.offset</code>). Restating spacing, font, radius, or motion
          in <code>$modes</code> fails the <code>invariance</code> gate;
          writing a <code>$modes</code> key for a mode not listed in root{" "}
          <code>modes</code> fails the <code>completeness</code> gate; and
          listing a mode in root <code>modes</code> without restating any token
          (unless the base luminance already reads as that mode) fails the{" "}
          <code>modes</code> gate.
        </p>
      </Section>

      <Section id="extensions" title="What lives under $extensions">
        <p>
          <code>$extensions</code> holds document metadata outside the token
          tree. <code>parseDocument(input)</code> returns{" "}
          <code>extensions</code> alongside <code>tree</code> and{" "}
          <code>modes</code> in a single parse, whereas{" "}
          <code>parseTokens(input)</code> returns only the token tree. Under{" "}
          <code>$extensions.spin</code>, a theme may declare{" "}
          <code>$extensions.spin.fonts</code>: the list of typeface sources the
          theme uses.
        </p>
        <Code
          class="mt-2"
          lang="json"
          code={`"$extensions": {
  "spin": {
    "fonts": [
      {
        "family": "Inter",
        "src": "url(https://example.com/inter.woff2) format(\\\"woff2\\\")",
        "weight": "100 900",
        "style": "normal",
        "display": "swap"
      }
    ]
  }
}`}
        />
        <p>
          A font source is an extension rather than a token because a URL is not
          a design token value: the theme names the family in{" "}
          <code>font.family.sans</code> (or <code>heading</code>,{" "}
          <code>mono</code>) and keeps the <code>fonts</code> array beside it in
          the same JSON document.
        </p>
        <p class="text-sm">
          <A href="/themes/authoring">Authoring a theme</A> walks through
          assembling and validating a complete theme document.
        </p>
      </Section>
    </main>
  );
}
