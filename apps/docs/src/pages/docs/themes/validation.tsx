/**
 * Themes Validation: spin lint integration, CLI analysis, the six validation checks, and runtime JS reads.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Code, PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";
import { FLOORS } from "../../../markdown/theme-docs.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const CHECK_ITEMS: readonly PropEntry[] = [
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
        lede="Spin validates every theme automatically — in spin lint alongside your source files, live inside the Studio, and from the CLI — across six checks: schema completeness, WCAG contrast floors, monotonic scales, motion safety, mode consistency, and layout invariance."
      />

      <Section id="cli" title="Lint and CLI analysis">
        <p class="max-w-prose">
          Run <code>npx spin lint .</code> in CI or locally to validate{" "}
          <code>spin/&lt;brand&gt;/</code> themes together with your source files: a
          contrast pair below its floor or a missing required role surfaces as
          a lint diagnostic with the exact token path. To inspect themes on
          their own, <code>npx spin theme list</code> prints every resolved
          theme and <code>npx spin theme analyze</code> reports every issue:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.cliAnalyze}
            lang="bash"
            title="Lint and theme commands"
          />
        </div>
      </Section>

      <Section id="checks" title="The six validation checks">
        <p class="max-w-prose">
          The Studio, <code>npx spin lint</code>, and{" "}
          <code>npx spin theme analyze</code> all run the same{" "}
          <code>validateTheme</code> pipeline from{" "}
          <code>@spinjs/spin/theme</code>:
        </p>
        <PropList items={CHECK_ITEMS} />

        <h3 id="contrast-floors">
          Enforced WCAG contrast pairs ({FLOORS.length})
        </h3>
        <p class="max-w-prose text-muted">
          Every pair below is checked in every mode the theme declares:
        </p>
        <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <For each={FLOORS}>
            {(floor) => (
              <div class="flex items-center justify-between gap-2 rounded-md border bg-surface-raised px-3 py-2 type-code">
                <span class="truncate">
                  {floor.fg}{" "}
                  <span class="text-muted">on</span> {floor.bg}
                </span>
                <span class="badge shrink-0">≥ {floor.min}:1</span>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="programmatic" title="Validating in TypeScript">
        <p class="max-w-prose">
          Import <code>validateTheme</code> from{" "}
          <code>@spinjs/spin/theme</code> to validate user-supplied or
          agent-authored theme documents in your own tests or build scripts:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.validateTheme}
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
          — use <code>resolveTheme(spinTheme, "dark")</code> from{" "}
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
