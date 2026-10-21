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
import { Chip, Code, Section } from "../../bits.tsx";
import {
  declaredGroups,
  elementGroups,
  elementTokens,
  groupTypes,
  ROLES,
  schemaFacts,
  TYPES,
} from "../../theme-docs.ts";

const DOCUMENT = `{
  "$extensions": {
    "spin": { "id": "roastery" }
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
  avatar: "The size ladder of a face.",
  badge: "Whether a badge is a pill, and how present its edge is.",
  border: "The stroke weight every control and surface draws with.",
  breakpoint: "The viewport widths where layout steps change.",
  button:
    "The button's own tokens: its weight, its case, its tracking and its elevation.",
  checkbox: "How physical a checkbox is.",
  color:
    "The palette: the surfaces, the inks, the fills and the status colors.",
  focus: "The focus ring every interactive element shares.",
  font: "The faces, the sizes, the weights and the tracking.",
  icon: "The glyph sizes.",
  motion: "The durations and the curves.",
  opacity: "How much of a thing is shown.",
  radius: "How round the corners are.",
  shadow: "How high each step lifts.",
  spacing: "The scale every gap, pad and inset is a step of.",
  switch: "How physical a switch is.",
  "z-index": "The stacking order.",
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
  const groups = declaredGroups();
  const elements = elementGroups();
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <h1 class="text-2xl tracking-tight">Theme schema</h1>
      <p class="mt-1 max-w-screen-md text-text-muted">
        A theme is a JSON object of groups. The groups the starters declare are
        the groups a theme owns; the roles the schema requires are the floor
        under them; and the types are the closed vocabulary a token may declare.
        The package writes the schema to{" "}
        <code class="font-mono">schema.json</code>{" "}
        and derives it from the same declaration the validator uses, so the
        three cannot drift.
      </p>

      <Section id="document" title="The document">
        <p>
          The root of a document holds groups, and a group holds tokens and
          further groups. A token is an object with a{" "}
          <code class="font-mono">$value</code>, and it may carry a{" "}
          <code class="font-mono">$type</code>, a{" "}
          <code class="font-mono">$description</code> and a{" "}
          <code class="font-mono">$modes</code>. The keys DTCG reserves are
          these five, plus{" "}
          <code class="font-mono">$deprecated</code>; every other key at a level
          is a child.
        </p>
        <Code code={DOCUMENT} />
        <p class="mt-3">
          A group may declare a <code class="font-mono">$type</code>{" "}
          of its own, and that type is the default for everything under it. A
          token that declares no type takes the one from the closest parent
          group that declares one. A token that carries a value may not also
          carry children, and a group with no children is an error rather than
          an empty branch.
        </p>
        <p class="mt-3">
          An alias is a value written as the path of another token in braces:
          {" "}
          <code class="font-mono">{"{color.neutral.50}"}</code>. It is resolved
          before the stylesheet is written and emitted as a{" "}
          <code class="font-mono">var()</code>{" "}
          reference, so the reference stays live and the palette can change
          under it.
        </p>
      </Section>

      <Section id="groups" title="The groups">
        <p>
          These are the groups the shipped themes declare, with the types their
          tokens use and the roles the schema requires inside them. The schema
          names three groups and requires them; the rest are admitted by the
          schema's own{" "}
          <code class="font-mono">additionalProperties</code>, because they are
          the theme's to declare and nobody else's to require.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <For each={facts.requiredGroups}>
            {(group) => <Chip>required: {group}</Chip>}
          </For>
        </div>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4 font-semibold text-text">group</th>
                <th class="py-2 pr-4 font-semibold text-text">types</th>
                <th class="py-2 pr-4 font-semibold text-text">what it is</th>
                <th class="py-2 pr-4 font-semibold text-text">
                  required in it
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={groups}>
                {(group) => (
                  <tr class="border-b border-border">
                    <td class="py-2 pr-4 font-mono text-xs text-text">
                      {group}
                    </td>
                    <td class="py-2 pr-4 font-mono text-xs">
                      {groupTypes(group).join(", ")}
                    </td>
                    <td class="py-2 pr-4 text-text-muted">
                      {GROUP_ABOUT[group] ??
                        "A group the starters declare. Nothing in the contract speaks about it."}
                    </td>
                    <td class="py-2 pr-4 font-mono text-xs">
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
                <p class="m-0 font-mono text-sm text-text">{group}</p>
                <ul class="m-0 mt-2 grid gap-1">
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
        <p class="mt-3 text-sm">
          A theme that leaves one of these out does not get the default: the
          rule omits the declaration, and the element falls back to whatever the
          platform does. The scaffold does not write them, because they are an
          opt-in: a theme that declares no <code class="font-mono">button</code>
          {" "}
          group is complete and valid, and a theme that wants to restyle a
          button's own tokens says so in its own document. The manifest carries
          a placeholder beside every one of them, and that is the value the
          studio writes when it creates one.
        </p>
        <p class="mt-3 text-sm">
          Each of them is also spendable as a utility:{" "}
          <code class="font-mono">button.weight</code> is spent as{" "}
          <code class="font-mono">button-weight</code>, reading the same
          property the preflight emitted.
        </p>
      </Section>

      <Section id="types" title="The types">
        <p>
          A token may declare a{" "}
          <code class="font-mono">$type</code>, and the vocabulary is closed. An
          unknown type is a parse error, so a typo can never reach the
          stylesheet, and the list below is every type there is.
        </p>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4 font-semibold text-text">type</th>
                <th class="py-2 pr-4 font-semibold text-text">what it is</th>
                <th class="py-2 pr-4 font-semibold text-text">
                  what it accepts
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={TYPES}>
                {(type) => (
                  <tr class="border-b border-border">
                    <td class="py-2 pr-4 font-mono text-xs text-text">
                      {type}
                    </td>
                    <td class="py-2 pr-4 text-text-muted">
                      {TYPE_ABOUT[type]?.[0] ?? "A type in the vocabulary."}
                    </td>
                    <td class="py-2 pr-4 text-text-muted">
                      {TYPE_ABOUT[type]?.[1] ??
                        "Any non-empty value."}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-sm">
          A group that declares no <code class="font-mono">$type</code>{" "}
          and a token that declares none of its own is a parse error: a value
          with no type is a value nobody can check. The types the validator
          cannot judge are checked where the CSS consumes them instead, which is
          why their values are not constrained here.
        </p>
      </Section>

      <Section id="roles" title="The required roles">
        <p>
          These are the roles every theme must declare, whatever components it
          enables. The schema's <code class="font-mono">required</code>{" "}
          list is derived from this declaration, and the validator holds a
          document to it.
        </p>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4 font-semibold text-text">role</th>
                <th class="py-2 pr-4 font-semibold text-text">type</th>
                <th class="py-2 pr-4 font-semibold text-text">what it is</th>
                <th class="py-2 pr-4 font-semibold text-text">the floor</th>
              </tr>
            </thead>
            <tbody>
              <For each={ROLES}>
                {(role) => (
                  <tr class="border-b border-border">
                    <td class="py-2 pr-4 font-mono text-xs text-text">
                      {role.path}
                    </td>
                    <td class="py-2 pr-4 font-mono text-xs">{role.type}</td>
                    <td class="py-2 pr-4 text-text-muted">{role.doc}</td>
                    <td class="py-2 pr-4 font-mono text-xs">
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
        <p class="mt-3 text-sm">
          The scaffold writes every one of them, with a neutral placeholder that
          is valid and legible and obviously unfinished. A theme that looks
          finished was not scaffolded.
        </p>
      </Section>

      <Section id="modes" title="Modes">
        <p>
          A mode is a variant of a token, not a second theme. Two spellings say
          the same thing. The first is the root{" "}
          <code class="font-mono">modes</code>{" "}
          field, which says which modes the document serves, and it is metadata:
          no emitter reads it. The second is{" "}
          <code class="font-mono">$modes</code>{" "}
          on a token, which says how that one token varies.
        </p>
        <Code
          class="mt-2"
          code={`"primary": {
  "$value": "#c8102e",
  "$modes": { "dark": "#ff5a63" }
}`}
        />
        <p class="mt-3">
          A document may also spell the dark side as a top-level{" "}
          <code class="font-mono">dark</code> group, where{" "}
          <code class="font-mono">dark.color.primary</code> overrides{" "}
          <code class="font-mono">--color-primary</code>{" "}
          rather than defining a second, dead variable. Both spellings emit
          identical CSS.
        </p>
        <p class="mt-3">
          Only color and focus vary by mode, and that is a design fact rather
          than a convention: dark mode changes ink and surface, not space or
          type. A document's root <code>modes</code>{" "}
          names the modes it serves; a mode it serves but does not override
          falls back to the base values, and a value written for a mode it does
          not serve is reported, because it would never be seen.
        </p>
      </Section>

      <Section id="extensions" title="What lives under $extensions">
        <p>
          <code class="font-mono">$extensions</code>{" "}
          is where everything that is neither a token nor DTCG metadata goes.
          The build reads one key of it:{" "}
          <code class="font-mono">$extensions.spin.fonts</code>, the list of
          faces the theme loads.
        </p>
        <Code
          class="mt-2"
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
        <p class="mt-3">
          A font is an extension rather than a token because a source is a URL
          and not a design value: a theme names a family with{" "}
          <code class="font-mono">font.family.sans</code>, and the source lives
          beside it so the two cannot drift. The sheet emits one{" "}
          <code class="font-mono">@font-face</code>{" "}
          per declaration and fetches nothing else.
        </p>
        <p class="mt-3">
          A theme may also carry{" "}
          <code class="font-mono">$extensions.spin.components</code>, a list of
          the elements it opts into; the studio reads it and shows it in the
          overview. A starter opts into everything, so it declares nothing — the
          extension is for a theme that wants a narrower set.
        </p>
        <p class="mt-3 text-sm">
          <A href="/themes/authoring" class="text-link hover:underline">
            Authoring a theme
          </A>{" "}
          walks through filling one of these in.
        </p>
      </Section>
    </main>
  );
}
