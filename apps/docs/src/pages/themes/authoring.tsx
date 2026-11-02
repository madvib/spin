/**
 * Authoring a theme: the brief, the fast path, what the machine can check,
 * and one theme put together in public.
 *
 * The worked example reads the spin theme's own document for its values, so
 * the walkthrough describes the theme that is actually installed rather than
 * a version of it that drifted.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Chip, Code, Section } from "../../bits.tsx";
import { SNIPPETS } from "../../snippets.ts";
import {
  FLOORS,
  groupSteps,
  starterDocument,
  statedMode,
  statedValue,
  thesisOf,
} from "../../theme-docs.ts";
import {
  SKILL_DIR,
  SKILL_PATH,
  skillChecklist,
  skillSections,
  styleReferences,
} from "../../style-docs.ts";

const BRIEF: readonly (readonly [string, string])[] = [
  [
    "The thesis",
    "One sentence: what this product is, and what it feels like to use. Write it before a color, because a color chosen without a thesis is a color chosen for no reason. The document's own `$description` is where it goes, and nothing in the build reads it. It is there for the person who opens the file.",
  ],
  [
    "The color structure",
    "How many inks, how many surfaces, where the accent is allowed to go, and what each status color means. The required roles are the floor. Everything above them is the decision: a theme with one accent and a theme with a spectrum are two different products.",
  ],
  [
    "Typography",
    "The working voice, the display voice, and the scale between them. A theme that spends two families has to say why, and a theme that spends a third has to say why twice.",
  ],
  [
    "Spacing and density",
    "The scale, and the spacing the product wants. A dense tool and a reading surface want different scales, and the difference shows in the components before it shows in the page.",
  ],
  [
    "Shape",
    "How round the corners are, and how heavy the edges are. Both are read on every control, so they are among the first things anyone sees and among the last things anyone can explain.",
  ],
  [
    "Depth",
    "Whether things are drawn or lit. A hairline, a flat card with air around it, and a shadow are three answers, and a theme that uses all three at once has not chosen.",
  ],
  [
    "Motion",
    "How long, and with what curve. Motion points; it does not perform. A theme that overshoots reads as a toy, and one that loops reads as a fault.",
  ],
  [
    "The per-element tokens",
    "The decisions that belong to one element rather than to the system: the button's case and weight, whether a badge is a pill, how physical a checkbox is. These are not optional in effect. A theme that leaves them out gets whatever the rule falls back to, or the platform's default, and neither is the theme's.",
  ],
  [
    "The modes",
    "Which modes the document serves, and what the second one is for. A mode that is a filter is a mode that is wrong.",
  ],
];

const FAST_PATH: readonly (readonly [string, string])[] = [
  ["the thesis", "five minutes"],
  ["the axes", "five minutes: type, shape, depth, motion"],
  ["the document", "twenty minutes: the ramp, the scale, the roles"],
  ["the checks", "ten minutes: the validator and the floors"],
  ["the looking", "the rest: a rendered surface and a person"],
];

const BATTERY_GATES: readonly {
  readonly gate: string;
  readonly checks: string;
  readonly remedy: string;
}[] = [
  {
    gate: "completeness",
    checks:
      "Parses the document via parseDocument and verifies every required path (options.required ?? requiredPaths()), token $type, and served mode.",
    remedy:
      "Fix malformed JSON or unknown $type values, add missing required roles or baseline scale steps, or add any unserved $modes key to root modes.",
  },
  {
    gate: "legibility",
    checks:
      "Measures every contrast floor in legibilityFloors() on the base document and in each served mode that varies tokens.",
    remedy:
      "Adjust the failing foreground or background in that mode until text/status/link pairs reach 4.5:1 and text-muted / focus-ring reach 3:1.",
  },
  {
    gate: "scales",
    checks:
      "Checks on the base document that numeric spacing.* steps and radius.{none,sm,md,lg,full} never descend, and that shadow.{sm,md,lg} weights neither descend nor tie unless both are \"none\".",
    remedy:
      "Order spacing and radius steps monotonically and give non-\"none\" shadow steps distinct, ascending pixel weights.",
  },
  {
    gate: "motion",
    checks:
      "Checks on the base document that motion.duration.loop (or motion.duration.slow when loop is omitted) meets the 250ms strobe floor (STROBE_FLOOR_MS).",
    remedy:
      "Set motion.duration.loop to at least 250ms (for example \"900ms\").",
  },
  {
    gate: "modes",
    checks:
      "Verifies that every mode in root modes either restates at least one token under $modes.<mode> or already reads as that mode in the base luminance (color.surface vs color.text).",
    remedy:
      "Add $modes.<mode> overrides for the palette, or remove the unserved mode from root modes.",
  },
  {
    gate: "invariance",
    checks:
      "Verifies that $modes.<mode> overrides only change ink (color and shadow values) or focus (focus.width, focus.offset); no-op restatements equal to the base value are ignored.",
    remedy:
      "Remove $modes overrides from spacing, font, radius, motion, border, opacity, breakpoint, or z-index tokens.",
  },
];

/**
 * The origin the site is served from.
 *
 * The install command carries it, so the command a reader copies is the one
 * that works on the site they are reading it on.
 */
function origin(): string {
  return globalThis.location?.origin ?? "";
}

export default function Authoring(): JSX.Element {
  const spin = starterDocument("spin") ?? {};
  const value = (path: string): string =>
    statedValue(spin, path) ?? "not stated";
  const mode = (path: string): string =>
    statedMode(spin, path, "dark") ?? "not restated";
  const spacing = groupSteps(spin, "spacing");
  const sections = skillSections();
  const checklist = skillChecklist();
  const styles = styleReferences();
  const base = origin();
  const install = `mkdir -p ~/.claude/skills/spin-theme
curl -fsSL "${base}${SKILL_PATH}" \\
  -o ~/.claude/skills/spin-theme/SKILL.md`;
  const installStyles = `for style in ${
    styles.map((style) => style.slug).join(" ")
  }; do
  curl -fsSL "${base}${SKILL_DIR}/$style.md" \\
    -o ~/.claude/skills/spin-theme/$style.md
done`;
  return (
    <main class="mx-auto w-full max-w-screen-lg px-6 py-10 md:py-16">
      <h1>Authoring a theme</h1>
      <p class="max-w-prose text-text-muted">
        A theme is written, not generated. The scaffold gives you the roles and
        the studio gives you the editors, and neither of them can decide what
        the product should look like. This page is the method: the shape of the
        brief, the fast path through it, the skill that carries it, the
        directions it can be pointed in, what the checks can prove, and what
        they cannot. The contract it satisfies is on{" "}
        <A href="/themes">Theme Contract & Modes</A>; the editor beside it is on
        {" "}
        <A href="/studio">Using the Studio</A>.
      </p>
      <Section id="brief" title="The shape of the brief">
        <p>
          {BRIEF.length}{" "}
          decisions, in this order. The order matters because each one
          constrains the next: the thesis decides the color structure, the color
          structure decides the type, and the type decides how much air the
          spacing can carry.
        </p>
        <ol class="grid gap-3 md:grid-cols-2">
          <For each={BRIEF}>
            {([name, what]) => (
              <li class="border border-border bg-surface-raised rounded-md p-4">
                <p class="font-semibold text-text">{name}</p>
                <p class="text-sm">{what}</p>
              </li>
            )}
          </For>
        </ol>
      </Section>

      <Section id="fast" title="The fast path">
        <p>
          Half an hour gets you a theme that is coherent, complete and legal. It
          does not get you a theme that is good, and the last row is the one
          that decides that. The skill below is this path, written to be
          followed rather than read.
        </p>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full border-collapse wrap">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4">step</th>
                <th class="py-2 pr-4">what it takes</th>
              </tr>
            </thead>
            <tbody>
              <For each={FAST_PATH}>
                {([step, cost]) => (
                  <tr class="border-b border-border">
                    <td class="text-text">{step}</td>
                    <td class="text-text-muted">{cost}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <p>
          The document can be written in an editor or in the studio, and the two
          are the same file. The studio edits the text and shows the result on
          the page beside it; saving writes{" "}
          <code>spin/&lt;name&gt;.json</code>, which is the file the build
          reads.
        </p>
        <Code
          class="mt-3"
          lang="ts"
          code={`import { spin } from "@spinjs/spin/vite";

export default {
  // The studio mounts itself beside the app, on the app's own origin.
  plugins: [spin.vite()],
};`}
        />
        <p>
          In development the plugin mounts the studio beside the app and injects
          a launcher into every page, so the thing you are editing and the thing
          doing the editing are the same screen. The studio edits a copy in
          memory until you save it, and the unsaved badge tells you when the two
          have drifted.
        </p>
      </Section>

      <Section id="skill" title="The house skill">
        <p>
          The method on this page is written for a person. The same method,
          written for an agent to follow, ships as a skill: one file that
          carries the order of the work, the checklist of the theme's own
          groups, the gates and what each failure means, and the judgement at
          the end. The agent is handed the file, a product, and half an hour.
        </p>
        <p>
          The file belongs to the theme module, which is the language it
          describes, and the site serves it from there. Its checklist is that
          module's own group list, emitted rather than written down: a group
          added to the contract is in the file without anyone editing prose, and
          the page below reads the same bytes the file carries.
        </p>
        <p>
          It is served from this site as a file, and installing it is a copy
          into the directory your agent reads skills from. The path below is the
          one Claude Code reads; any agent that reads a <code>SKILL.md</code>
          {" "}
          takes the same file in its own directory.
        </p>
        <Code class="mt-3" code={install} lang="bash" />
        <p>
          The style references travel with it, in the skill's own directory, so
          one install brings the method and the directions together. They are
          the directions, and the skill names them, so an agent asked for a
          theme picks one and spends the axes accordingly. They are optional:
          the skill carries a line about each, which is enough to start.
        </p>
        <Code class="mt-3" code={installStyles} lang="bash" />
        <p>
          What the file carries, read from the file rather than listed here:
        </p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full border-collapse wrap">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4">section</th>
              </tr>
            </thead>
            <tbody>
              <For each={sections}>
                {(section) => (
                  <tr class="border-b border-border">
                    <td class="text-text">{section.title}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <p>
          The checklist inside it is the theme's own groups, and for each one
          the skill says what the group is for, what a good answer looks like,
          and what a lazy one looks like. The groups it walks are these, in the
          order a theme document reads them:
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <For each={checklist}>
            {(group) => <Chip>{group.title}</Chip>}
          </For>
        </div>
      </Section>

      <Section id="styles" title="The style references">
        <p>
          The house skill is the method and it does not vary. A style reference
          is the direction: a named look, what to spend the axes on, the
          decisions that make it recognisable, and what would pull it back
          towards the house style. A theme is the house, one style, and the
          decisions only the product's owner can make.
        </p>
        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <For each={styles}>
            {(style) => (
              <div class="border border-border bg-surface-raised rounded-md p-4">
                <p class="font-semibold text-text">{style.name}</p>
                <p class="text-sm">{style.mood}</p>
                <p class="text-xs text-text-muted">
                  {style.audience}
                </p>
              </div>
            )}
          </For>
        </div>
        <p>
          Each one is a file of its own, and the page that presents them renders
          those files rather than describing them:{" "}
          <A href="/themes/styles" class="text-link hover:underline">
            the style references
          </A>
          .
        </p>
      </Section>

      <Section id="checks" title="What the machine checks">
        <p>
          <code>themeGates(text, options?)</code> in{" "}
          <code>@spinjs/spin/theme</code> runs the six-gate contract battery in
          fixed order (<code>GATES</code>) and returns a{" "}
          <code>BatteryReport</code> (<code>{"{ gates, issues, valid }"}</code>
          ). For a single check,{" "}
          <code>themeGate(gate, text, options?)</code> returns that gate's{" "}
          <code>GateResult</code> (<code>{"{ gate, issues }"}</code>).{" "}
          <code>BatteryOptions</code> accepts <code>required</code> (custom
          required dotted paths), <code>modes</code> (the modes the document
          claims to serve), and <code>mode</code> (a single mode to judge in).
        </p>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full border-collapse wrap">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4">gate</th>
                <th class="py-2 pr-4">what it checks</th>
                <th class="py-2 pr-4">remedy when it fails</th>
              </tr>
            </thead>
            <tbody>
              <For each={BATTERY_GATES}>
                {(row) => (
                  <tr class="border-b border-border">
                    <td class="font-mono text-xs text-text">{row.gate}</td>
                    <td class="text-sm text-text-muted">{row.checks}</td>
                    <td class="text-sm text-text-muted">{row.remedy}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>

        <p>
          The mechanical gates are one call, and they run against any document —
          a starter, a scaffolded file from <code>scaffoldTheme()</code>, or the
          theme a project just wrote:
        </p>
        <Code
          class="mt-2"
          lang="ts"
          code={SNIPPETS.themeGates}
        />
        <p>
          Save it as <code>check-theme.ts</code> and run{" "}
          <code>bun check-theme.ts</code>.
        </p>

        <p>
          The legibility gate measures every contrast floor declared by the
          contract across the base palette and every served mode:
        </p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full border-collapse wrap">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4">the ink</th>
                <th class="py-2 pr-4">the fill</th>
                <th class="py-2 pr-4">at least</th>
              </tr>
            </thead>
            <tbody>
              <For each={FLOORS}>
                {(floor) => (
                  <tr class="border-b border-border">
                    <td class="font-mono text-xs text-text">
                      {floor.fg}
                    </td>
                    <td class="font-mono text-xs text-text">
                      {floor.bg}
                    </td>
                    <td class="font-mono text-xs">{floor.min}:1</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <p>
          Beside the static battery, the browser visual harness drives a running
          app in every theme and mode and checks rendered contrast across
          resting, hovered, focused, pressed, and disabled states (
          <code>--no-state-contrast</code> skips the state sweep for a quick
          pass):
        </p>
        <Code
          class="mt-2"
          lang="bash"
          code={`bun run serve                                  # the reference app, http://localhost:5173
bun run visual                                 # every route, against the default URL
bun run visual -- --route components/button
bun run visual -- --firefox /path/to/firefox`}
        />
      </Section>

      <Section id="project" title="Project config">
        <p>
          The themes live in <code>spin/*.json</code>; the project's word
          about them lives in <code>spin/config.json</code> beside them.
          Two keys, both optional: <code>activeTheme</code> names the
          theme the Studio seats on load, and <code>themeOrder</code>{" "}
          lists the themes in the order the picker shows them. The file
          need not exist — a project without one serves its themes in
          the order the layering hands them over.
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
          The registry arrives after first paint, and the first seat wins the
          chain: the config's <code>activeTheme</code> when it names a served
          theme (<code>served.has(configured)</code>), the remembered seat when
          it is served, else the first listed theme (
          <code>listed[0].name</code>). A configured name the layering does not
          serve is ignored rather than seated — the config may name a theme the
          current project does not serve, and seating an unserved name would
          leave the editor on empty text with an invalid-JSON banner. After the
          first seat the config never moves the author again: the author's own
          seat is theirs to keep. Unknown keys are ignored, and a file that does
          not parse counts as absent so a half-written config never costs the
          reader the themes the project has.
        </p>
        <p>
          The Studio's Overview page carries a Project section that
          edits both keys — a select for the active theme, up and down
          verbs for the order — and writes the file on save. Duplicate or
          non-string entries in <code>themeOrder</code> are skipped, unknown
          names are ignored, and unlisted served names follow alphabetically.
        </p>
      </Section>

      <Section id="taste" title="What the machine cannot check">
        <p>
          Whether a theme is good. Not whether it is legal, which it is by then,
          but whether it is handsome, whether it is appropriate to the product,
          and whether a person would want to work inside it for a whole
          afternoon. No script decides that, and any script that claimed to
          would be measuring its own author.
        </p>
        <p>
          So the last step is the one that cannot be automated: render the
          thing, put it in front of a reader, and look at it. The harness will
          tell you that the text is legible and the controls are reachable. It
          cannot tell you that the theme says what the product is.
        </p>
        <p>
          <A href="/themes" class="text-link hover:underline">
            The principles
          </A>{" "}
          are the form that judgement takes.
        </p>
      </Section>

      <Section id="example" title="A worked example: the spin theme">
        <p>
          The theme this site wears, put together in the order the brief asks
          for. Every value below is read out of its document, so the walk
          through and the theme cannot disagree.
        </p>

        <div class="mt-4">
          <p class="font-semibold text-text">The thesis</p>
          <p class="text-sm">
            {thesisOf(spin) ?? "The document states no description of its own."}
          </p>
        </div>

        <div class="mt-5">
          <p class="font-semibold text-text">The color structure</p>
          <p class="text-sm">
            A ramp of warm neutrals carries the whole page, and the brand's red
            is the only other color with any weight. The primary and the accent
            are the same red, and the destructive action wears a hotter
            vermilion beside it, so an ordinary action and a dangerous one never
            read as one intent. The link is the press blue and never the red, so
            a link and a danger are never the same word on a page.
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <Chip>color.primary {value("color.primary")}</Chip>
            <Chip>color.accent {value("color.accent")}</Chip>
            <Chip>color.semantic.error {value("color.semantic.error")}</Chip>
            <Chip>color.link {value("color.link")}</Chip>
          </div>
        </div>

        <div class="mt-5">
          <p class="font-semibold text-text">Typography</p>
          <p class="text-sm">
            One working face and one display face. The sans is everywhere a tool
            has to be read, and the didone is allowed to speak only where a
            poster is allowed to speak. Hierarchy is weight and size, so the
            scale can be a scale and not a second typeface.
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <Chip>sans {value("font.family.sans")}</Chip>
            <Chip>heading {value("font.family.heading")}</Chip>
            <Chip>mono {value("font.family.mono")}</Chip>
          </div>
        </div>

        <div class="mt-5">
          <p class="font-semibold text-text">Spacing and density</p>
          <p class="text-sm">
            The scale runs from a quarter of a rem to a very large step, and the
            roomiest step is the air between two sections of a page. That is
            where this theme puts its emphasis, instead of putting a box around
            them.
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <For each={spacing}>
              {(step) => (
                <Chip>
                  {step.path.split(".").slice(1).join(".")} {step.value}
                </Chip>
              )}
            </For>
          </div>
        </div>

        <div class="mt-5">
          <p class="font-semibold text-text">Shape</p>
          <p class="text-sm">
            Square geometry. A thread ends blunt, so the poster has no round
            corners except where a control is a pill.
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <Chip>radius.md {value("radius.md")}</Chip>
            <Chip>radius.lg {value("radius.lg")}</Chip>
            <Chip>border.width {value("border.width")}</Chip>
          </div>
        </div>

        <div class="mt-5">
          <p class="font-semibold text-text">Depth</p>
          <p class="text-sm">
            Flat, and then one hard cut. A card is paper on paper, separated by
            a hairline and by air. Only an overlay is cut out of the sheet, and
            it is cut with a hard unblurred offset. There is no blur anywhere in
            this theme.
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <Chip>shadow.md {value("shadow.md")}</Chip>
            <Chip>shadow.lg {value("shadow.lg")}</Chip>
          </div>
        </div>

        <div class="mt-5">
          <p class="font-semibold text-text">Motion</p>
          <p class="text-sm">
            Precise, and quick. A hover, a press and a focus move fast; the
            default is longer; a panel may take its time; and the endless ones —
            the skeleton's pulse, the spinner — have a step of their own, so a
            slow loop is never paid for by every transition.
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <Chip>fast {value("motion.duration.fast")}</Chip>
            <Chip>base {value("motion.duration.base")}</Chip>
            <Chip>slow {value("motion.duration.slow")}</Chip>
            <Chip>loop {value("motion.duration.loop")}</Chip>
            <Chip>standard {value("motion.easing.standard")}</Chip>
          </div>
        </div>

        <div class="mt-5">
          <p class="font-semibold text-text">The per-element tokens</p>
          <p class="text-sm">
            The button is a block of ink with a label of its own: a weight
            heavier than the prose around it, the case it is written in, no
            shadow at rest and a hard two-pixel offset when it is touched, so it
            reads as printed on the page rather than as a photograph of a block.
            Badges are square tags, and the controls are drawn rather than lit,
            which is one scalar each. A stat's number has a face of its own,
            because a figure is a figure and the face it is set in belongs to
            the number rather than to the page it sits on.
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <Chip>button.weight {value("button.weight")}</Chip>
            <Chip>button.case {value("button.case")}</Chip>
            <Chip>button.tracking {value("button.tracking")}</Chip>
            <Chip>badge.pill {value("badge.pill")}</Chip>
            <Chip>checkbox.depth {value("checkbox.depth")}</Chip>
            <Chip>switch.depth {value("switch.depth")}</Chip>
            <Chip>stat.value-family {value("stat.value-family")}</Chip>
          </div>
        </div>

        <div class="mt-5">
          <p class="font-semibold text-text">The modes</p>
          <p class="text-sm">
            Light and dark, and the dark one is not the light one inverted. The
            same steps of the ramp are restated for the night press, so a mode
            is a change of ink rather than a change of system.
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <Chip>color.primary in the dark {mode("color.primary")}</Chip>
            <Chip>color.surface in the dark {mode("color.surface")}</Chip>
            <Chip>color.text in the dark {mode("color.text")}</Chip>
          </div>
        </div>

        <p class="text-sm">
          That is the whole of the character. Everything else in the document is
          the machinery that carries those decisions: the ramp, the spacing
          steps, the type sizes, the one set of status colors.
        </p>
      </Section>
    </main>
  );
}
