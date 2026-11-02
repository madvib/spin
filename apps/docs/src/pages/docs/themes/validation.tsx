/**
 * Themes Validation: CLI analysis, the six build-time validation gates, WCAG contrast floors, and runtime JS reads.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Code, Section } from "../../../bits.tsx";
import { PageHeader, PropList, type PropEntry } from "../../../ui/index.ts";
import { FLOORS } from "../../../theme-docs.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const GATE_ITEMS: readonly PropEntry[] = [
  {
    name: "completeness",
    badge: "Schema & required roles",
    description:
      "Verifies valid DTCG structure, closed $type names, resolvable {path} aliases, and the presence of all required base color, typography, spacing, radius, shadow, and motion tokens.",
  },
  {
    name: "legibility",
    badge: "WCAG contrast floors",
    description:
      "Checks every required foreground/background pair in every declared mode against its minimum WCAG contrast ratio (4.5:1 for body text, status inks, and button labels; 3:1 for muted text and focus rings).",
  },
  {
    name: "scales",
    badge: "Monotonic ramps",
    description:
      "Ensures spacing.1 through spacing.64 and font.size.2xs through font.size.display increase strictly from step to step.",
  },
  {
    name: "motion",
    badge: "Duration & strobe safety",
    description:
      "Checks that motion.duration.fast ≤ base ≤ slow, easing curves are valid, and motion.duration.loop is at least 250ms (≤ 4 Hz) to prevent photosensitivity strobing.",
  },
  {
    name: "modes",
    badge: "Mode declarations",
    description:
      "Rejects $modes entries for modes the theme's root modes array does not list, and flags mode overrides whose value is identical to the base $value.",
  },
  {
    name: "invariance",
    badge: "Zero layout shift",
    description:
      "Ensures only color.*, shadow.*, and focus.{width,offset} vary across modes so switching between light and dark never shifts layout geometry.",
  },
];

export default function ThemesValidation(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Validation"
        lede="Spin validates every theme at build time and live inside the Studio across six mechanical gates: schema completeness, WCAG contrast floors, monotonic scales, motion safety, mode consistency, and layout invariance."
      />

      <Section id="cli" title="Inspecting themes from the CLI">
        <p class="max-w-prose">
          Run <code>npx spin theme analyze</code> in CI or locally to verify
          every theme in <code>spin/*.json</code> against all six gates. If a
          contrast pair falls below its floor or a required role is missing,
          the CLI prints the exact token path, mode, and offending values:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.cliAnalyze}
            lang="bash"
            title="CLI theme commands"
          />
        </div>
      </Section>

      <Section id="gates" title="The six validation gates">
        <p class="max-w-prose">
          Both the Studio and <code>npx spin theme analyze</code> run the same{" "}
          <code>themeGates</code> battery from <code>@spinjs/spin/theme</code>:
        </p>
        <PropList items={GATE_ITEMS} />

        <h3 id="contrast-floors">
          Enforced WCAG contrast pairs ({FLOORS.length})
        </h3>
        <p class="max-w-prose text-sm text-text-muted">
          Every pair below is checked in every mode the theme declares:
        </p>
        <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <For each={FLOORS}>
            {(floor) => (
              <div class="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 font-mono text-xs">
                <span class="truncate text-text">
                  {floor.fg}{" "}
                  <span class="text-text-muted">on</span> {floor.bg}
                </span>
                <span class="badge shrink-0">≥ {floor.min}:1</span>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="programmatic" title="Running gates in TypeScript">
        <p class="max-w-prose">
          Import <code>themeGates</code> or <code>themeGate</code> from{" "}
          <code>@spinjs/spin/theme</code> to validate user-supplied or
          agent-authored theme documents in your own tests or build scripts:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.themeGates}
            lang="ts"
            title="Programmatic validation"
          />
        </div>
      </Section>

      <Section id="runtime" title="Reading token values in JavaScript">
        <p class="max-w-prose">
          In CSS and HTML, tokens are consumed via custom properties (
          <code>var(--color-primary)</code>). When you need resolved hex or
          pixel values in JavaScript — for <code>&lt;canvas&gt;</code>, WebGL,
          charting libraries, or <code>&lt;meta name="theme-color"&gt;</code>{" "}
          — use <code>resolveTheme(doc, mode)</code> from{" "}
          <code>@spinjs/spin/theme</code>:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.resolveTheme}
            lang="ts"
            title="Reading tokens with resolveTheme and parseTokens"
          />
        </div>
      </Section>
    </main>
  );
}
