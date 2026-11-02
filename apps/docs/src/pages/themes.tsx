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
import { Chip, Code, Probe, Section } from "../bits.tsx";
import { SNIPPETS } from "../snippets.ts";
import { TYPES } from "../theme-docs.ts";

const PIPELINE: readonly (readonly [string, string])[] = [
  ["parse", "parseTokens / parseDocument turns JSON into a typed TokenTree without throwing"],
  ["resolve", "treeInMode selects the mode's values and resolveAliases follows {path} references"],
  ["validate", "themeGates runs the six-gate contract battery across every served mode"],
  ["read", "resolveTheme or indexTree exposes flat dotted paths and token leaves"],
];

const SEAT_CHAIN: readonly (readonly [string, string])[] = [
  [
    "1. Configured activeTheme",
    "spin/config.json's activeTheme wins first when it names a theme the project currently serves. A configured name the project does not serve is ignored.",
  ],
  [
    "2. Remembered seat",
    "If activeTheme is absent or unserved, the Studio keeps the previously seated theme when that name is in the served set.",
  ],
  [
    "3. First listed theme",
    "Otherwise the first theme in the ordered list (listed[0].name) is seated. After the first seat, config changes never move the author's seat again.",
  ],
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
    <main class="mx-auto max-w-screen-lg px-6 py-10 md:py-16">
      <h1>Themes</h1>
      <p class="max-w-prose text-text-muted">
        A theme is one DTCG JSON document. It declares a product's palette,
        typography, spatial scales, elevation, motion, and mode variants in a
        single tree of groups and tokens. See{" "}
        <A href="/themes/schema">Theme schema</A> for every group and required
        role, <A href="/themes/starters">Starter themes</A> for the five shipped
        palettes, and <A href="/themes/authoring">Authoring a theme</A> for the
        six-gate validation battery.
      </p>

      <Section id="document" title="The theme document">
        <p>
          A theme document is a plain JSON object whose keys are token groups
          (such as <code>color</code>, <code>font</code>, and{" "}
          <code>spacing</code>) plus optional root metadata (
          <code>$description</code>, <code>$extensions</code>, and{" "}
          <code>modes</code>). Inside a group, every object with a{" "}
          <code>$value</code> is a token leaf, and every other object is a
          nested group. A node cannot carry both <code>$value</code> and child
          tokens, and an empty group is a parse error.
        </p>
        <p>
          DTCG reserves six keys at any level: <code>$value</code>,{" "}
          <code>$type</code>, <code>$description</code>,{" "}
          <code>$extensions</code>, <code>$deprecated</code>, and{" "}
          <code>$modes</code>. Every other key names a child token or subgroup.
        </p>
        <Code class="mt-2" code={SNIPPETS.minimalTheme} lang="json" />
        <p>
          A shape illustration, not a valid theme: it omits most of the contract's
          required roles, so <code>themeGates</code> reports it. Start from{" "}
          <code>scaffoldTheme()</code> below when a document must validate.
        </p>
        <p>
          Every token has a resolved <code>$type</code> from a closed
          vocabulary. Declare <code>$type</code> on a group once (for example{" "}
          <code>"$type": "color"</code> on <code>color</code>) and every token
          in its subtree inherits that type unless a child group or leaf
          declares its own. An unknown <code>$type</code> or a leaf with no
          resolved type fails parsing immediately:
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <For each={TYPES}>
            {(type) => <Chip>{type}</Chip>}
          </For>
        </div>
        <p>
          An alias references another token by its dotted path in curly braces:{" "}
          <code>{"\"{color.neutral.50}\""}</code>. Aliases may chain across
          tokens; the resolver follows the chain to its terminal value, flags
          cycles, and reports any target path that does not exist. What each
          top-level token group controls is catalogued in{" "}
          <A href="/themes/schema#groups">Theme schema — The groups</A>, and
          every required role and contrast floor is listed in{" "}
          <A href="/themes/schema#roles">The required roles</A>.
        </p>
        <p>
          The theme pipeline processes a document in {PIPELINE.length} stages,
          each callable on its own from <code>@spinjs/spin/theme</code>:
        </p>
        <ol class="list-decimal">
          <For each={PIPELINE}>
            {([stage, what]) => (
              <li>
                <code>{stage}</code>
                {": "}
                {what}
              </li>
            )}
          </For>
        </ol>
      </Section>

      <Section id="modes" title="How modes work">
        <p>
          A mode is a variant of a token, not a second theme. A document
          declares which modes it serves in a root <code>modes</code> array —{" "}
          <code>["light", "dark"]</code>, <code>["light"]</code>, or{" "}
          <code>["dark"]</code> — and a token that changes between modes carries
          a <code>$modes</code> map beside its base <code>$value</code>:
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
          Mode resolution uses a single-mode fallback rule: in a given mode, a
          token's value is <code>leaf.modes?.[mode] ?? leaf.value</code>. Any
          token that omits <code>$modes.&lt;mode&gt;</code> keeps its base{" "}
          <code>$value</code> in every mode. When an alias is resolved in a
          mode, it follows the target token's value in that same mode — restating{" "}
          <code>color.neutral.50</code> for <code>dark</code> automatically
          updates every role aliased to <code>{"\"{color.neutral.50}\""}</code>.
        </p>
        <p>
          Root <code>modes</code> is never inferred from token overrides. A
          single-mode dark palette such as <code>console</code> declares{" "}
          <code>"modes": ["dark"]</code> and restates nothing under{" "}
          <code>$modes</code>, because its base values are already dark. By
          contrast, declaring <code>"dark"</code> on a light base without any{" "}
          <code>$modes.dark</code> overrides, or writing a{" "}
          <code>$modes.dark</code> value when <code>"dark"</code> is not in root{" "}
          <code>modes</code>, fails validation.
        </p>
        <p>
          Modes only change ink (<code>color</code> and <code>shadow</code>{" "}
          tokens) and the <code>focus</code> ring (<code>focus.width</code>,{" "}
          <code>focus.offset</code>). Spacing, typography, radius, and motion
          stay mode-invariant across the document. The probe below renders the
          active theme in the opposite mode side by side:
        </p>
        <Probe>
          <p class="font-semibold text-text">Opposite mode preview</p>
          <p class="text-sm text-text-muted">
            Same tokens and markup, resolved with the other mode's ink and
            surface values.
          </p>
        </Probe>
      </Section>

      <Section id="project" title="Where themes live and which one is active">
        <p>
          Project themes live on disk as <code>spin/&lt;name&gt;.json</code>,
          where the file stem is the theme's name (for example{" "}
          <code>spin/acme.json</code>). Project-level theme configuration lives
          beside them in <code>spin/config.json</code>.
        </p>
        <Code
          class="mt-2"
          lang="json"
          code={`{
  "activeTheme": "acme",
  "themeOrder": ["acme", "silk", "console"]
}`}
        />
        <p>
          <code>spin/config.json</code> accepts two optional keys:{" "}
          <code>activeTheme</code> (the theme the Studio seats on first load
          when it names a served theme) and <code>themeOrder</code> (the display
          order for the theme list; unknown or duplicate names are ignored, and
          served themes not listed in <code>themeOrder</code> follow
          alphabetically). Unknown keys are ignored, and a missing or unparsable{" "}
          <code>spin/config.json</code> is treated as empty so a half-written
          config never hides the project's themes.
        </p>
        <p>
          When the Studio loads, the active theme is chosen once by a three-step
          seating chain:
        </p>
        <div class="mt-4 grid gap-3 md:grid-cols-3">
          <For each={SEAT_CHAIN}>
            {([step, detail]) => (
              <div class="border border-border bg-surface-raised rounded-md p-4">
                <p class="font-semibold text-text">{step}</p>
                <p class="text-sm">{detail}</p>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="starters" title="Starters and forking">
        <p>
          Five starter themes ship in <code>@spinjs/spin/theme/themes</code>:{" "}
          <code>silk</code>, <code>neobrut</code>, <code>console</code>,{" "}
          <code>synthwave</code>, and <code>spin</code>. Starters are
          creation-only templates — they are not auto-served into a project's{" "}
          <code>spin/</code> directory unless you pass them in your bundler
          config or fork one into the project.
        </p>
        <Code class="mt-2" lang="ts" code={SNIPPETS.viteThemes} />
        <p>
          An unforked theme served from the package or a <code>themes</code>{" "}
          map has a project path of <code>null</code>. Writing or saving{" "}
          <code>spin/&lt;name&gt;.json</code> (for example{" "}
          <code>spin/silk.json</code>) forks that theme into the project: the
          project's file replaces the shipped starter of the same name for that
          project alone. Browse all five palettes on{" "}
          <A href="/themes/starters">Starter themes</A>.
        </p>
      </Section>

      <Section id="scaffold" title="Writing one from the scaffold">
        <p>
          <code>scaffoldTheme()</code> in <code>@spinjs/spin/theme</code>{" "}
          builds the smallest valid starting document: the required base roles (
          <code>color.*</code>, <code>font.family.sans</code>,{" "}
          <code>focus.width</code>, <code>focus.offset</code>) with neutral
          placeholder colors that pass every contrast floor, the baseline scale
          steps (<code>spacing</code>, <code>radius</code>, <code>shadow</code>,{" "}
          <code>font</code> scales, <code>motion</code>, <code>border</code>,{" "}
          <code>breakpoint</code>, <code>z-index</code>, <code>icon</code>), and
          the optional per-element token groups, with no dark mode overrides.
        </p>
        <p>
          Start from the scaffold when the product's visual direction is being
          designed from scratch; start from a fork of one of the{" "}
          <A href="/themes/starters">starter themes</A> when a shipped palette is
          already close.{" "}
          <A href="/themes/authoring">Authoring a theme</A> walks the full
          process and the <code>themeGates</code> contract battery.
        </p>
      </Section>

      <Section id="runtime" title="Reading theme values at runtime">
        <p>
          Import <code>resolveTheme</code> from <code>@spinjs/spin/theme</code>{" "}
          to read a theme's resolved token values at runtime for a single mode:
        </p>
        <Code class="mt-2" lang="ts" code={SNIPPETS.resolveTheme} />
        <p>
          <code>resolveTheme(document, mode = "light")</code> accepts a{" "}
          <code>ThemeDocument</code> object or raw JSON string and returns a{" "}
          <code>ResolvedTheme</code> with three fields: <code>mode</code> (the
          mode name), <code>values</code> (a flat{" "}
          <code>Readonly&lt;Record&lt;string, unknown&gt;&gt;</code> keyed by
          dotted path such as <code>"color.primary"</code>), and{" "}
          <code>unresolved</code> (any alias paths whose target did not exist).
          It throws an <code>Error</code> if the document is malformed so a
          caller is never handed a silent partial map, while broken aliases are
          reported in <code>unresolved</code> rather than thrown.
        </p>
        <p>
          When you need a non-throwing parse or full token metadata (
          <code>type</code>, <code>description</code>, raw <code>modes</code>{" "}
          map, or <code>$extensions</code>), call{" "}
          <code>parseTokens(input)</code> or <code>parseDocument(input)</code>{" "}
          and pass the resulting <code>TokenTree</code> through{" "}
          <code>treeInMode</code>, <code>resolveAliases</code>, and{" "}
          <code>indexTree</code> to inspect <code>index.leaves[path]</code>.
        </p>
      </Section>

      <Section id="taste" title="What good means">
        <p>
          The machine checks completeness, contrast floors, scale order, loop
          duration, mode coverage, and mode invariance. The rest is design
          judgement:
        </p>
        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <For each={TASTE}>
            {([name, why]) => (
              <div class="border border-border bg-surface-raised rounded-md p-4">
                <p class="font-semibold text-text">{name}</p>
                <p class="text-sm">{why}</p>
              </div>
            )}
          </For>
        </div>
      </Section>
    </main>
  );
}
