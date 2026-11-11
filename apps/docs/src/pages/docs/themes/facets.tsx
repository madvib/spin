/**
 * Facets: optional palette (*.palette.json) and spacing (*.spacing.json) overlays
 * that compose with a brand and mode on <html> or any DOM subtree.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { mode } from "@spinjs/kit";
import {
  Code,
  PageHeader,
  PropList,
  Section,
  Specimen,
  type PropEntry,
} from "../../../ui/index.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const FACET_AXES: readonly PropEntry[] = [
  {
    name: "data-theme=\"<brand>\"",
    badge: "spin/<brand>/tokens.json",
    description:
      "The base brand theme. Sets typography, surface physics, default palette roles, spatial rhythm, radii, shadows, and motion.",
  },
  {
    name: "data-palette=\"<name>\"",
    badge: "spin/<brand>/themes/<name>.palette.json",
    description:
      "Optional palette facet. Swaps only color.*, shadow.*, and focus.* tokens (in both light and dark modes) while keeping the brand's typography, radii, and spacing untouched.",
  },
  {
    name: "data-spacing=\"<name>\"",
    badge: "spin/<brand>/themes/<name>.spacing.json",
    description:
      "Optional spacing facet. Swaps only spacing.* steps (such as compact or comfortable density) on the page root or inside a dense data-table or sidebar subtree.",
  },
  {
    name: "data-mode=\"light | dark\"",
    badge: "$modes.dark",
    description:
      "Selects the light or dark ink answer for the active brand and any active palette facet.",
  },
];

export default function ThemesFacets(): JSX.Element {
  const oppositeMode = () => (mode() === "dark" ? "light" : "dark");

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Palettes & Density"
        lede="Swap a subtree's ink or rhythm independently of the brand: seasonal palettes, compact sidebars, generous marketing pages."
      />

      <Section id="four-axes" title="Four orthogonal runtime axes">
        <p class="max-w-prose">
          Forking an entire theme just to offer a high-contrast palette or a
          compact table density duplicates your typography, radii, and element
          rules. In Spin, a brand in <code>spin/&lt;brand&gt;/</code> can ship
          optional <strong>facets</strong> under{" "}
          <code>spin/&lt;brand&gt;/themes/</code> that override a single axis at
          runtime:
        </p>
        <PropList items={FACET_AXES} />
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.composedAxes}
            lang="html"
            title="Setting all four axes on <html>"
          />
        </div>
      </Section>

      <Section id="subtrees" title="Composing facets in nested subtrees">
        <p class="max-w-prose">
          Because each facet writes only the CSS custom properties for its own
          axis, facets compose with <A href="/docs/themes/modes">Modes</A> and
          nest in subtrees. The card below keeps the page's base typography and
          corner radii, wears the <code>catppuccin</code> palette facet at the
          opposite mode, and tightens its rhythm with{" "}
          <code>data-spacing="compact"</code>:
        </p>
        <div class="my-4">
          <Specimen
            title="Catppuccin palette facet + compact spacing facet + opposite mode"
            description="data-palette and data-spacing layer over the page brand; data-mode picks the opposite ink answer"
            code={THEMES_SNIPPETS.composedSubtree}
            preview={
              <div
                data-palette="catppuccin"
                data-spacing="compact"
                data-mode={oppositeMode()}
                class="flex min-w-0 flex-col gap-4 rounded-lg border bg-surface p-4"
              >
                <span class="type-code text-muted">
                  data-palette="catppuccin" data-spacing="compact" data-mode="
                  {oppositeMode()}"
                </span>
                <strong>Release pipeline</strong>
                <p class="text-muted">
                  Ink from Catppuccin, rhythm from compact, mode scoped to this
                  card.
                </p>
                <div class="flex flex-wrap items-center gap-4">
                  <button type="button" class="primary">
                    Promote build
                  </button>
                  <button type="button">Compare diff</button>
                </div>
              </div>
            }
          />
        </div>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.nestedFacets}
            lang="html"
            title="Nesting density and palette facets inside one layout"
          />
        </div>
      </Section>

      <Section id="authoring" title="Authoring palette and spacing facets">
        <p class="max-w-prose">
          Place facet files in <code>spin/&lt;brand&gt;/themes/</code> (or at{" "}
          <code>spin/&lt;name&gt;.palette.json</code> and{" "}
          <code>spin/&lt;name&gt;.spacing.json</code>). A{" "}
          <code>*.palette.json</code> file may only declare palette-governed
          tokens (<code>color.*</code>, <code>shadow.*</code>,{" "}
          <code>focus.*</code>) and is verified against the same{" "}
          <A href="/docs/themes/palettes#contrast-floors">
            WCAG contrast floors
          </A>{" "}
          as the base brand; a <code>*.spacing.json</code> file may only declare{" "}
          <code>spacing.*</code> steps and is verified for monotonic order:
        </p>
        <div class="my-3 grid gap-3 sm:grid-cols-2">
          <Code
            code={THEMES_SNIPPETS.paletteFacet}
            lang="json"
            title="spin/acme/themes/catppuccin.palette.json"
          />
          <Code
            code={THEMES_SNIPPETS.spacingFacet}
            lang="json"
            title="spin/acme/themes/compact.spacing.json"
          />
        </div>
      </Section>
    </main>
  );
}
