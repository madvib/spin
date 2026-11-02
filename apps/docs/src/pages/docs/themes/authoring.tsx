/**
 * Authoring & Gates: the brief, fast path, house skill, six-gate validation
 * battery, contrast floors, and worked spin theme example.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Chip, Code, Section } from "../../../bits.tsx";
import { PageHeader, PropList, type PropEntry } from "../../../ui/index.ts";
import {
  FLOORS,
  groupSteps,
  starterDocument,
  statedMode,
  statedValue,
  thesisOf,
} from "../../../theme-docs.ts";
import {
  SKILL_DIR,
  SKILL_PATH,
  skillChecklist,
  skillSections,
  styleReferences,
} from "../../../style-docs.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const BRIEF: readonly (readonly [string, string])[] = [
  [
    "The thesis",
    "One sentence: what this product is, and what it feels like to use. Write it before a color, because a color chosen without a thesis is a color chosen for no reason. The document's own `$description` is where it goes, and nothing in the build reads it.",
  ],
  [
    "The color structure",
    "How many inks, how many surfaces, where the accent is allowed to go, and what each status color means. The required roles are the floor. Everything above them is the decision.",
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
    "How round the corners are, and how heavy the edges are. Both are read on every control.",
  ],
  [
    "Depth",
    "Whether things are drawn or lit. A hairline, a flat card with air around it, and a shadow are three answers.",
  ],
  [
    "Motion",
    "How long, and with what curve. Motion points; it does not perform.",
  ],
  [
    "The per-element tokens",
    "The decisions that belong to one element rather than to the system: the button's case and weight, whether a badge is a pill, how physical a checkbox is.",
  ],
  [
    "The modes",
    "Which modes the document serves, and what the second one is for.",
  ],
];

const FAST_PATH: readonly PropEntry[] = [
  { name: "1. The thesis", badge: "5 min", description: "Write one sentence in $description stating the product and its visual character." },
  { name: "2. The axes", badge: "5 min", description: "Choose type families, corner shape, elevation strategy, and motion timing." },
  { name: "3. The document", badge: "20 min", description: "Populate the neutral ramp, spatial scale, and semantic roles from scaffoldTheme()." },
  { name: "4. The checks", badge: "10 min", description: "Run themeGates() across all served modes and resolve any contrast or scale findings." },
  { name: "5. The looking", badge: "review", description: "Inspect the rendered application across routes and interactive states." },
];

const BATTERY_GATES: readonly PropEntry[] = [
  {
    name: "completeness",
    badge: "gate 1",
    description:
      "Parses the document via parseDocument and verifies every required path (options.required ?? requiredPaths()), token $type, and served mode.",
    detail:
      "Remedy: Fix malformed JSON or unknown $type values, add missing required roles or baseline scale steps, or add any unserved $modes key to root modes.",
  },
  {
    name: "legibility",
    badge: "gate 2",
    description:
      "Measures every contrast floor in legibilityFloors() on the base document and in each served mode that varies tokens.",
    detail:
      "Remedy: Adjust the failing foreground or background in that mode until text/status/link pairs reach 4.5:1 and text-muted / focus-ring reach 3:1.",
  },
  {
    name: "scales",
    badge: "gate 3",
    description:
      "Checks on the base document that numeric spacing.* steps and radius.{none,sm,md,lg,full} never descend, and that shadow.{sm,md,lg} weights neither descend nor tie unless both are \"none\".",
    detail:
      "Remedy: Order spacing and radius steps monotonically and give non-\"none\" shadow steps distinct, ascending pixel weights.",
  },
  {
    name: "motion",
    badge: "gate 4",
    description:
      "Checks on the base document that motion.duration.loop (or motion.duration.slow when loop is omitted) meets the 250ms strobe floor (STROBE_FLOOR_MS).",
    detail:
      "Remedy: Set motion.duration.loop to at least 250ms (for example \"900ms\").",
  },
  {
    name: "modes",
    badge: "gate 5",
    description:
      "Verifies that every mode in root modes either restates at least one token under $modes.<mode> or already reads as that mode in the base luminance (color.surface vs color.text).",
    detail:
      "Remedy: Add $modes.<mode> overrides for the palette, or remove the unserved mode from root modes.",
  },
  {
    name: "invariance",
    badge: "gate 6",
    description:
      "Verifies that $modes.<mode> overrides only change ink (color and shadow values) or focus (focus.width, focus.offset); no-op restatements equal to the base value are ignored.",
    detail:
      "Remedy: Remove $modes overrides from spacing, font, radius, motion, border, opacity, breakpoint, or z-index tokens.",
  },
];

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
    <main class="flex flex-col">
      <PageHeader
        title="Authoring & Gates"
        lede={
          <>
            A theme is written, not generated. This page covers the authoring
            brief, the house skill for agents, the six build-time contract
            gates, and a worked walkthrough of the <code>spin</code> starter.
            See <A href="/docs/themes/overview">Themes &amp; Modes</A> for the
            document contract and <A href="/studio">Studio</A> for the live
            editor.
          </>
        }
      />

      <Section id="brief" title="The shape of the brief">
        <p class="max-w-prose">
          {BRIEF.length} decisions, in this order. Each decision constrains the
          next: the thesis decides the color structure, the color structure
          decides the type, and the type decides how much air the spacing
          carries.
        </p>
        <ol class="grid gap-3 md:grid-cols-2">
          <For each={BRIEF}>
            {([name, what]) => (
              <li class="rounded-md border border-border bg-surface-raised p-4">
                <p class="font-semibold text-text">{name}</p>
                <p class="text-sm">{what}</p>
              </li>
            )}
          </For>
        </ol>
      </Section>

      <Section id="fast" title="The fast path">
        <p class="max-w-prose">
          Half an hour gets you a theme that is coherent, complete, and valid.
        </p>
        <div class="my-4">
          <PropList items={FAST_PATH} />
        </div>
        <p class="max-w-prose">
          The document can be written in an editor or in the Studio — both edit{" "}
          <code>spin/&lt;name&gt;.json</code>.
        </p>
        <div class="my-3">
          <Code
            lang="ts"
            title="vite.config.ts"
            code={`import { spin } from "@spinjs/spin/vite";

export default {
  plugins: [spin.vite()],
};`}
          />
        </div>
      </Section>

      <Section id="skill" title="The house skill">
        <p class="max-w-prose">
          The same authoring method ships as an installable agent skill (
          <code>SKILL.md</code>) generated directly from the theme module's
          contract:
        </p>
        <div class="my-3 grid gap-3">
          <Code code={install} lang="bash" title="Install house skill" />
          <Code
            code={installStyles}
            lang="bash"
            title="Install style references"
          />
        </div>
        <p class="max-w-prose">
          Sections inside <code>SKILL.md</code>:
        </p>
        <div class="my-3 flex flex-wrap gap-2">
          <For each={sections}>
            {(section) => <Chip>{section.title}</Chip>}
          </For>
        </div>
        <p class="max-w-prose">
          Token group checklist walked by the skill:
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <For each={checklist}>
            {(group) => <Chip>{group.title}</Chip>}
          </For>
        </div>
      </Section>

      <Section id="styles" title="The style references">
        <p class="max-w-prose">
          Each style reference names a visual direction and how to spend the
          token axes without drifting back to defaults. Read the full files on{" "}
          <A href="/docs/themes/styles">Style References</A>.
        </p>
        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <For each={styles}>
            {(style) => (
              <div class="rounded-md border border-border bg-surface-raised p-4">
                <p class="font-semibold text-text">{style.name}</p>
                <p class="text-sm">{style.mood}</p>
                <p class="text-xs text-text-muted">{style.audience}</p>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="checks" title="What the machine checks">
        <p class="max-w-prose">
          <code>themeGates(text, options?)</code> in{" "}
          <code>@spinjs/spin/theme</code> runs the six-gate contract battery in
          fixed order (<code>GATES</code>) and returns a{" "}
          <code>BatteryReport</code> (<code>{"{ gates, issues, valid }"}</code>
          ). For a single check,{" "}
          <code>themeGate(gate, text, options?)</code> returns that gate's{" "}
          <code>GateResult</code> (<code>{"{ gate, issues }"}</code>).{" "}
          <code>BatteryOptions</code> accepts <code>required</code>,{" "}
          <code>modes</code>, and <code>mode</code>.
        </p>
        <div class="my-4">
          <PropList items={BATTERY_GATES} />
        </div>
        <div class="my-4">
          <Code
            lang="ts"
            title="check-theme.ts"
            code={THEMES_SNIPPETS.themeGates}
          />
        </div>
        <p class="max-w-prose">
          The <code>legibility</code> gate measures every contrast floor
          declared by the contract across the base palette and every served
          mode:
        </p>
        <div class="my-3 grid gap-2 sm:grid-cols-2">
          <For each={FLOORS}>
            {(floor) => (
              <div class="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 font-mono text-xs">
                <span class="truncate text-text">
                  {floor.fg} <span class="text-text-muted">on</span> {floor.bg}
                </span>
                <span class="shrink-0 font-semibold text-primary">
                  ≥ {floor.min}:1
                </span>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="project" title="Project config">
        <p class="max-w-prose">
          Themes live in <code>spin/*.json</code>; project seating lives beside
          them in <code>spin/config.json</code> with two optional keys:{" "}
          <code>activeTheme</code> and <code>themeOrder</code>.
        </p>
        <div class="my-3">
          <Code
            lang="json"
            title="spin/config.json"
            code={`{
  "activeTheme": "acme",
  "themeOrder": ["acme", "silk", "console"]
}`}
          />
        </div>
        <p class="max-w-prose">
          On first load, the Studio seats <code>activeTheme</code> when it
          names a served theme (<code>served.has(configured)</code>), else the
          remembered seat when served, else <code>listed[0].name</code>.
        </p>
      </Section>

      <Section id="example" title="Worked example: the spin theme">
        <p class="max-w-prose">
          Every value below is read live from the shipped <code>spin</code>{" "}
          starter document:
        </p>
        <div class="mt-4 flex flex-col gap-4">
          <div class="rounded-md border border-border bg-surface-raised p-4">
            <p class="font-semibold text-text">Thesis</p>
            <p class="text-sm">
              {thesisOf(spin) ?? "The document states no description."}
            </p>
          </div>
          <div class="rounded-md border border-border bg-surface-raised p-4">
            <p class="font-semibold text-text">Color structure &amp; modes</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <Chip>color.primary {value("color.primary")}</Chip>
              <Chip>color.accent {value("color.accent")}</Chip>
              <Chip>color.semantic.error {value("color.semantic.error")}</Chip>
              <Chip>color.link {value("color.link")}</Chip>
              <Chip>dark primary {mode("color.primary")}</Chip>
              <Chip>dark surface {mode("color.surface")}</Chip>
              <Chip>dark text {mode("color.text")}</Chip>
            </div>
          </div>
          <div class="rounded-md border border-border bg-surface-raised p-4">
            <p class="font-semibold text-text">Typography, Shape &amp; Motion</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <Chip>sans {value("font.family.sans")}</Chip>
              <Chip>heading {value("font.family.heading")}</Chip>
              <Chip>mono {value("font.family.mono")}</Chip>
              <Chip>radius.md {value("radius.md")}</Chip>
              <Chip>border.width {value("border.width")}</Chip>
              <Chip>fast {value("motion.duration.fast")}</Chip>
              <Chip>loop {value("motion.duration.loop")}</Chip>
            </div>
          </div>
          <div class="rounded-md border border-border bg-surface-raised p-4">
            <p class="font-semibold text-text">Spacing ladder</p>
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
        </div>
      </Section>
    </main>
  );
}
