/**
 * Themes: what a theme is in this system, the language it is written in, and
 * the bar a theme is held to.
 *
 * The lists here are read from the contract rather than written out, so the
 * page and the package cannot disagree about which roles a theme owes or
 * which types the vocabulary admits.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Chip, Code, Section } from "../bits.tsx";
import { ROLES, TYPES } from "../theme-docs.ts";

const DOCUMENT = `{
  "color": {
    "primary": { "$value": "#c8102e" }
  },
  "font": {
    "family": {
      "sans": { "$type": "fontFamily", "$value": "Inter, sans-serif" }
    }
  },
  "modes": ["light", "dark"]
}`;

const PIPELINE: readonly (readonly [string, string])[] = [
  ["parse", "the text becomes a tree of groups and tokens"],
  ["resolve", "an alias is followed to the value it stands for"],
  ["validate", "the contract, then the contrast floors"],
  ["generate", "the tree becomes CSS custom properties"],
];

const TASTE: readonly (readonly [string, string])[] = [
  [
    "Distinctness",
    "A theme has to be recognisable at a glance. If it could be any other theme with a different hex, it is not a theme, it is a default.",
  ],
  [
    "Completeness",
    "Every token decided. A token the document leaves out is a decision handed to the consumer, and the consumer will make it differently in every place they spend it.",
  ],
  [
    "Legibility in every state",
    "Rest, hover, focus, active, selected, disabled, and in every mode the document serves. A fill always has an ink, and the floors are where that is written down.",
  ],
  [
    "Restraint with effects",
    "Shadow, blur, lift, glow. Each one asks for attention. A theme that spends all of them spends none of them, and the elements stop being able to say anything.",
  ],
  [
    "Dark mode designed, not inverted",
    "A dark mode is a second palette with its own ink, not the light one with the lightness taken out. The surface goes dark first, and then every color is asked whether it still means what it meant.",
  ],
];

export default function Themes(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <h1 class="text-2xl tracking-tight">Themes</h1>
      <p class="mt-1 max-w-screen-md text-text-muted">
        A theme is one document. The build reads it and turns it into CSS custom
        properties, and every utility and every element in the library resolves
        against those properties. Replacing the document replaces the product's
        look without touching a line of markup.
      </p>

      <div class="mt-4 flex flex-wrap gap-2">
        <A href="/themes/starters" class="text-link hover:underline">
          the starters
        </A>
        <A href="/themes/authoring" class="text-link hover:underline">
          authoring a theme
        </A>
        <A href="/themes/schema" class="text-link hover:underline">
          the schema
        </A>
      </div>

      <Section id="what" title="What a theme is">
        <p>
          A theme lives on disk as a JSON document in the DTCG shape: groups of
          tokens, each token a value and, when the group does not already say
          it, a type. In a spin project it is{" "}
          <code class="font-mono">spin/&lt;name&gt;.json</code>, and the name is
          the file stem.
        </p>
        <Code code={DOCUMENT} />
        <p>
          The document goes through {PIPELINE.length}{" "}
          stages, and each of them can be entered on its own:
        </p>
        <ol class="mt-2 list-decimal pl-5">
          <For each={PIPELINE}>
            {([stage, what]) => (
              <li>
                <code class="font-mono text-text">{stage}</code>
                {": "}
                {what}
              </li>
            )}
          </For>
        </ol>
        <p class="mt-3">
          The output is a flat namespace of custom properties. A token's path
          becomes its name: <code class="font-mono">color.primary</code> is{" "}
          <code class="font-mono">--color-primary</code>,{" "}
          <code class="font-mono">font.family.sans</code> is{" "}
          <code class="font-mono">--font-family-sans</code>. A rule that paints
          a primary does not carry a color, it carries the name, so a theme swap
          is a selector swap and not a rebuild.
        </p>
      </Section>

      <Section id="language" title="The token language">
        <p>
          A token may declare a{" "}
          <code class="font-mono">$type</code>, and the vocabulary of types is
          closed. An unknown type is a parse error rather than a silent
          pass-through, so a typo in an author file can never reach the
          stylesheet. These are the types:
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <For each={TYPES}>
            {(type) => <Chip>{type}</Chip>}
          </For>
        </div>
        <p class="mt-5">
          On top of the types, a theme must declare the base roles: the palette,
          the inks that go on the palette, the focus ring every interactive
          element shares, and the two dimensions of the ring. The contract is
          one declaration, and the JSON Schema the package writes derives its
          {" "}
          <code class="font-mono">required</code>{" "}
          list from it, so a role added to the contract is required by the
          schema in the same change.
        </p>
        <div class="mt-3 overflow-x-auto">
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

        <p class="mt-5">
          A mode is a variant of a token, not a second theme.{" "}
          <code class="font-mono">modes</code>{" "}
          at the root of the document says which modes the document serves, and
          {" "}
          <code class="font-mono">$modes</code>{" "}
          on a token says how that one token varies:
        </p>
        <Code
          class="mt-2"
          code={`"primary": {
  "$value": "#c8102e",
  "$modes": { "dark": "#ff5a63" }
}`}
        />
        <p class="mt-3">
          Only color and focus vary by mode, and that is a design fact rather
          than a convention: dark mode changes ink and surface, not space or
          type. A document's root <code>modes</code>{" "}
          names the modes it serves; a mode it serves but does not override
          falls back to the base values, and a value written for a mode it does
          not serve is reported, because it would never be seen.
        </p>
        <p class="mt-3">
          Some decisions belong to one element rather than to the system. The
          button's weight, case and tracking, whether a badge is a pill, how
          physical a checkbox or a switch is, the size ladder of an avatar, the
          glyph sizes of an icon. Each of those lives in its own group, so a
          theme can restyle one element without touching the rest.{" "}
          <A href="/themes/schema" class="text-link hover:underline">
            The schema page
          </A>{" "}
          lists them.
        </p>
      </Section>

      <Section id="fork" title="Forking a starter">
        <p>
          The starters ship with the package. A project forks one by writing a
          file of the same name into its own{" "}
          <code class="font-mono">spin/</code> directory:{" "}
          <code class="font-mono">spin/silk.json</code>{" "}
          is that project's silk, and it replaces the shipped one for that
          project alone. The build reads{" "}
          <code class="font-mono">spin/*.json</code>{" "}
          every time it generates the stylesheet, so a theme edited while the
          dev server is running is live on the next change, with no restart.
        </p>
        <p class="mt-3">
          The studio does the same thing through a dialog.{" "}
          <strong>
            New theme
          </strong>{" "}
          asks where the copy starts: from one of the themes the project already
          has, or from the scaffold. Save writes the file, and the file is what
          the build reads.
        </p>
      </Section>

      <Section id="scaffold" title="Writing one from the scaffold">
        <p>
          The scaffold is the smallest document that satisfies the contract:
          every required role, and nothing else. No scales, no ramps, no dark
          axis. The values it writes are placeholders, and they are deliberately
          ugly: they validate, and they are obviously unfinished. A theme that
          looks finished was not scaffolded, it was authored.
        </p>
        <p class="mt-3">
          Starting from a scaffold is the right move when the product's
          character is not yet decided, because the required roles are the floor
          and nothing else is. Starting from a starter is the right move when
          the character is close to one of the shipped ones, because a starter
          already answers the questions a fresh document has to answer.{" "}
          <A href="/themes/authoring" class="text-link hover:underline">
            Authoring a theme
          </A>{" "}
          walks the second route.
        </p>
      </Section>

      <Section id="taste" title="What good means">
        <p>
          The machine checks some of this and none of the rest. These are the
          principles. It can check completeness and legibility; the other three
          are judgement.
        </p>
        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <For each={TASTE}>
            {([name, why]) => (
              <div class="border border-border bg-surface-raised rounded-md p-4">
                <p class="m-0 font-semibold text-text">{name}</p>
                <p class="m-0 mt-2 text-sm">{why}</p>
              </div>
            )}
          </For>
        </div>
      </Section>
    </main>
  );
}
