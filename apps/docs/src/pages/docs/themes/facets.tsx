/**
 * Alternate Palettes guide: offering multiple brand colorways or re-theming subtrees.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { mode } from "@spinjs/kit";
import { Code, PageHeader, Section, Specimen } from "../../../ui/index.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const PALETTE_SUBTREE_MARKUP = `<card data-palette="terracotta">
  <card-header>
    <card-title>Featured callout</card-title>
    <card-description>
      Applies the terracotta palette while keeping the page's fonts, spacing, and corner radii.
    </card-description>
  </card-header>
  <card-footer>
    <button type="button" class="primary">Explore collection</button>
  </card-footer>
</card>`;

export default function ThemesFacets(): JSX.Element {
  const oppositeMode = () => (mode() === "dark" ? "light" : "dark");

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Alternate Palettes"
        lede="Offer multiple colorways for your brand or re-theme individual sections without duplicating typography or spacing."
      />

      <Section id="overview" title="Multiple colorways, one design system">
        <p class="max-w-prose">
          When your product offers user-selectable accent themes, workspace
          branding, or high-contrast sections, duplicating your entire theme
          means maintaining multiple copies of your fonts, spacing scale, and
          component shapes. An alternate palette overrides only colors (in both
          light and dark modes) while inheriting everything else from your brand.
        </p>
        <p class="max-w-prose">
          Apply <code>data-palette="&lt;name&gt;"</code> on{" "}
          <code>&lt;html&gt;</code> to switch the whole app, or place it on any
          container to re-color a single card, callout, or sidebar:
        </p>
        <div class="my-4">
          <Specimen
            title="Scoped palette + inverted mode on a single card"
            code={PALETTE_SUBTREE_MARKUP}
            preview={
              <div
                data-palette="terracotta"
                data-mode={oppositeMode()}
                class="flex min-w-0 flex-col gap-3 rounded-lg border bg-surface p-5"
              >
                <div class="type-heading">Featured callout</div>
                <p class="text-muted">
                  Applies the Terracotta palette in {oppositeMode()} mode while
                  keeping the active design language's typography and geometry.
                </p>
                <div class="flex flex-wrap items-center gap-2">
                  <button type="button" class="primary">
                    Explore collection
                  </button>
                  <button type="button" class="secondary">
                    Learn more
                  </button>
                </div>
              </div>
            }
          />
        </div>
      </Section>

      <Section id="authoring" title="Creating a palette file">
        <p class="max-w-prose">
          Add a <code>&lt;name&gt;.palette.json</code> file inside{" "}
          <code>spin/&lt;brand&gt;/themes/</code>. Spin checks every foreground
          and background pair in both light and dark modes automatically — just
          like your base brand. Looking to adjust layout tightness instead? See{" "}
          <A href="/docs/themes/density">Density</A>.
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.paletteFacet}
            lang="json"
            title="spin/acme/themes/terracotta.palette.json"
          />
        </div>
      </Section>
    </main>
  );
}
