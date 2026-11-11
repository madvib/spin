/**
 * Density guide: compact and spacious spacing scales scoped to the page or a subtree.
 */
import type { JSX } from "solid-js";
import { Code, PageHeader, Section, Specimen } from "../../../ui/index.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const DENSITY_MARKUP = `<div class="grid gap-4 sm:grid-cols-2">
  <card>
    <card-header>
      <card-title>Default density</card-title>
      <card-description>Uses your brand's standard spacing scale.</card-description>
    </card-header>
    <card-footer>
      <button type="button" class="primary">Save changes</button>
    </card-footer>
  </card>

  <card data-spacing="compact">
    <card-header>
      <card-title>Compact density</card-title>
      <card-description>Tighter padding and gaps for dense toolbars and tables.</card-description>
    </card-header>
    <card-footer>
      <button type="button" class="primary">Save changes</button>
    </card-footer>
  </card>
</div>`;

export default function ThemesDensity(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Density"
        lede="Adjust padding and layout spacing across your whole app or inside dense sidebars, toolbars, and tables."
      />

      <Section id="scoping" title="Page-wide or scoped to a section">
        <p class="max-w-prose">
          Data-heavy dashboards, inspector rails, and admin tables often need
          tighter spacing than marketing pages or forms — without changing your
          colors, fonts, or corner radii. Add <code>data-spacing="compact"</code>{" "}
          or <code>data-spacing="spacious"</code> on <code>&lt;html&gt;</code>{" "}
          for a user preference, or place it on a single container:
        </p>
        <div class="my-4">
          <Specimen
            title="Default vs. compact density"
            code={DENSITY_MARKUP}
            preview={
              <div class="grid min-w-0 gap-4 sm:grid-cols-2">
                <card>
                  <card-header>
                    <card-title>Default density</card-title>
                    <card-description>
                      Uses your brand's standard spacing scale.
                    </card-description>
                  </card-header>
                  <card-footer>
                    <button type="button" class="primary">
                      Save changes
                    </button>
                  </card-footer>
                </card>

                <card data-spacing="compact">
                  <card-header>
                    <card-title>Compact density</card-title>
                    <card-description>
                      Tighter padding and gaps for dense toolbars and tables.
                    </card-description>
                  </card-header>
                  <card-footer>
                    <button type="button" class="primary">
                      Save changes
                    </button>
                  </card-footer>
                </card>
              </div>
            }
          />
        </div>
      </Section>

      <Section id="custom" title="Defining a custom density scale">
        <p class="max-w-prose">
          Create a <code>*.spacing.json</code> file inside{" "}
          <code>spin/&lt;brand&gt;/themes/</code> whenever your product needs its
          own compact or comfortable scale. Every <code>p-*</code>,{" "}
          <code>gap-*</code>, and component padding token automatically follows
          the overridden steps:
        </p>
        <div class="my-3">
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
