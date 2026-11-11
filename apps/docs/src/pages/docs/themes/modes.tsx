/**
 * Themes Modes: light and dark mode resolution, subtree scoping, mode invariance, and mode pickers.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { mode, theme } from "@spinjs/kit";
import {
  Code,
  PageHeader,
  PropList,
  Section,
  SplitExample,
  type PropEntry,
} from "../../../ui/index.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const MODE_RULES: readonly PropEntry[] = [
  {
    name: "modes: [\"light\", \"dark\"]",
    badge: "Root declaration",
    description:
      "Declares which modes the theme supports. Omit modes and Spin defaults to [\"light\", \"dark\"] when any token has $modes.dark, or [\"light\"] otherwise. A dark-first terminal theme can declare [\"dark\"].",
  },
  {
    name: "$modes.dark / $modes.light",
    badge: "Token override",
    description:
      "Overrides a token's $value in that mode. Tokens that do not need to change in dark mode omit $modes and inherit their base $value.",
  },
  {
    name: "{path} alias resolution",
    badge: "Per-mode",
    description:
      "Aliases resolve within the active mode. If color.surface points to {color.neutral.50} and color.neutral.50 defines $modes.dark, color.surface automatically picks up the dark neutral.",
  },
  {
    name: "--spin-modes",
    badge: "CSS metadata",
    description:
      "Emitted on each [data-theme] block so a mode picker knows whether a theme supports both light and dark or is single-mode.",
  },
];

export default function ThemesModes(): JSX.Element {
  const oppositeMode = () => (mode() === "dark" ? "light" : "dark");
  const demoTheme = () => theme();
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Dark Mode"
        lede="Support light and dark appearances across the whole page or scoped to a single section without dark: utility clutter."
      />

      <Section id="modes" title="How modes work">
        <p class="max-w-prose">
          In Spin, you write your markup once using semantic roles (
          <code>bg-surface</code>, <code>text-muted</code>,{" "}
          <code>border</code>). You never write{" "}
          <code>dark:bg-slate-900 dark:text-slate-100</code> in templates.
          When <code>data-mode="dark"</code> is set on{" "}
          <code>&lt;html&gt;</code> — or on a specific container — the CSS
          custom properties update in place and every element inside that
          subtree repaints automatically.
        </p>

        <div class="my-4">
          <SplitExample
            title={`Live subtree scoping — page is ${mode()}, inner card is ${oppositeMode()}`}
            code={THEMES_SNIPPETS.subtreeMode}
            lang="html"
            playgroundExample="themes-dual-mode"
          >
            <div class="grid w-full gap-3 sm:grid-cols-2">
              <div
                data-theme={demoTheme()}
                data-mode={mode()}
                class="flex flex-col gap-2 rounded-md border bg-surface-raised p-4"
              >
                <span class="type-code text-muted">
                  data-mode="{mode()}" (page)
                </span>
                <p class="text-muted">
                  Inherits the page's current mode.
                </p>
                <div class="flex items-center gap-2 pt-1">
                  <button type="button" class="primary">Primary</button>
                  <span class="badge">Badge</span>
                </div>
              </div>
              <div
                data-theme={demoTheme()}
                data-mode={oppositeMode()}
                class="flex flex-col gap-2 rounded-md border bg-surface-raised p-4"
              >
                <span class="type-code text-muted">
                  data-mode="{oppositeMode()}" (subtree)
                </span>
                <p class="text-muted">
                  Scoped to the opposite mode on this container.
                </p>
                <div class="flex items-center gap-2 pt-1">
                  <button type="button" class="primary">Primary</button>
                  <span class="badge">Badge</span>
                </div>
              </div>
            </div>
          </SplitExample>
        </div>
      </Section>

      <Section id="overrides" title="Studio vs. theme JSON ($modes)">
        <p class="max-w-prose">
          You rarely hand-write <code>$modes</code>. In the Studio's{" "}
          <strong>Color</strong> view, light and dark render side by side:
          editing a role while the dark preview is active writes the{" "}
          <code>$modes.dark</code> override into{" "}
          <code>spin/&lt;brand&gt;/tokens.json</code> for you. The JSON below is what
          the Studio saves — the same document you can edit by hand when you
          prefer an editor:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.modeToken}
            lang="json"
            title="spin/acme/tokens.json"
          />
        </div>
        <PropList items={MODE_RULES} />
      </Section>

      <Section id="facets" title="Composing with palette and density facets">
        <p class="max-w-prose">
          Need to swap the entire color palette (<code>data-palette</code>) or
          tighten spatial density (<code>data-spacing</code>) alongside{" "}
          <code>data-mode</code>? See{" "}
          <A href="/docs/themes/facets">Palettes &amp; Density</A> for
          how palette and spacing overlays layer
          over your brand on the page or inside nested sections.
        </p>
      </Section>

      <Section id="invariance" title="Mode invariance">
        <p class="max-w-prose">
          A mode switch must never cause layout shift or text reflow.
          Reskinning a mode only swaps ink and elevation:{" "}
          <code>color.*</code> roles repaint surfaces and text,{" "}
          <code>shadow.*</code> re-grades elevation for the darker backdrop,
          and <code>focus.*</code> may adjust ring geometry for contrast.
          Everything structural — typography and spatial scales — stays
          constant, so paragraphs never re-wrap when the user flips modes:
        </p>
        <ul class="max-w-prose">
          <li>
            <strong>Allowed to vary by mode:</strong> <code>color.*</code>,{" "}
            <code>shadow.*</code>, per-element color or shadow tokens (such as{" "}
            <code>button.edge</code> or <code>card.elevation</code>), and focus
            ring geometry (<code>focus.width</code>, <code>focus.offset</code>
            ).
          </li>
          <li>
            <strong>Mode-invariant (must stay constant):</strong>{" "}
            <code>spacing.*</code>, <code>font.*</code>, <code>radius.*</code>,{" "}
            <code>border.*</code>, <code>motion.*</code>,{" "}
            <code>breakpoint.*</code>, <code>icon.*</code>, and{" "}
            <code>z-index.*</code>. Placing <code>$modes</code> on a spacing
            or typography token is rejected by the{" "}
            <A href="/docs/themes/validation#checks">invariance check</A>.
          </li>
        </ul>
      </Section>

      <Section id="switching" title="Switching modes in your UI">
        <p class="max-w-prose">
          Copy a ready-made control from{" "}
          <code>@spinjs/components/mode-picker</code> into your app with{" "}
          <code>npx spin component copy mode-picker basic</code> — it reads{" "}
          <code>--spin-themes</code> and <code>--spin-modes</code> directly
          from the generated stylesheet. Or drive the mode yourself: Spin
          reads <code>data-mode</code> on <code>&lt;html&gt;</code>, so one
          dataset assignment flips the whole page:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.pickers}
            lang="ts"
            title="Switching modes"
          />
        </div>
      </Section>
    </main>
  );
}
