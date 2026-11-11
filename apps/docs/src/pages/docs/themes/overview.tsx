/**
  * Themes Overview: one brand theme with light and dark modes, the Studio vs. CLI
  * setup walkthrough, the language switcher, and optional multi-theme skins.
 */
import { A } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { setTheme, theme } from "@spinjs/kit";
import { Chip, Code, PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";
import { themeSummaries, type ThemeSummary } from "../../../markdown/theme-docs.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const VOCABULARY_ITEMS: readonly PropEntry[] = [
  {
    name: "Design Language",
    badge: "$extends",
    description:
      "One of the six built-in starting physics shipped in @spinjs/theme (minimal, editorial, material, neobrutalist, neumorphic, glassmorphic). A design language supplies the baseline scales and element rules that your brand extends.",
  },
  {
    name: "Brand",
    badge: "spin/<brand>/",
    description:
      "Your project's authored design system identity on disk (tokens.json plus optional reference.json, elements.json, and primitives/*.json layers). Owns both light and dark modes directly.",
  },
  {
    name: "Facet",
    badge: "*.palette.json · *.spacing.json",
    description:
      "Optional overlays in spin/<brand>/themes/ that swap only color/elevation (data-palette) or spatial density (data-spacing) without duplicating your brand's typography or radii.",
  },
  {
    name: "Resolved Theme",
    badge: "data-theme · data-palette · data-spacing · data-mode",
    description:
      "The compiled CSS custom-property sheet produced at runtime when the browser combines your Brand, any active Facets, and the active Mode (light or dark).",
  },
];

const STUDIO_STEPS: readonly PropEntry[] = [
  {
    name: "1. Open the Studio",
    badge: "/__spin/studio/",
    description:
      "With a Spin bundler plugin running (spin.vite(), spin.rspack(), spin.webpack(), spin.bun(), or any of the seven adapters), open /__spin/studio/ in your browser — or run npx spin studio standalone.",
  },
  {
    name: "2. Create your brand in 4 steps (/init)",
    badge: "Brand → Language → Color → Type",
    description:
      "Name your brand, choose one of the six starting design languages (minimal, editorial, material, neobrutalist, neumorphic, glassmorphic), seed your palette from a primary hex color, and pick a curated font pairing and icon pack.",
  },
  {
    name: "3. Tune workbenches with live WCAG & scale gates",
    badge: "Themes ▾ & Components ▾",
    description:
      "Step through Color, Type (Styles, Faces, Ramps), Spacing, Style, Motion, Icons, and per-component token tables. Every fill-and-ink pair displays its live WCAG contrast ratio with a one-click Fix button.",
  },
  {
    name: "4. Save to spin/<brand>/",
    badge: "git-diffable",
    description:
      "Edits preview live in memory first. Pressing Save writes clean DTCG JSON into spin/<brand>/ and updates spin/config.json.",
  },
];

const CLI_STEPS: readonly PropEntry[] = [
  {
    name: "1. Scaffold a project",
    badge: "npx spin init",
    description:
      "From an empty folder, npx spin init detects your bundler, writes the plugin wiring, and creates spin/default/tokens.json — a single brand theme serving light and dark modes.",
  },
  {
    name: "2. Edit the JSON directly",
    badge: "spin/default/tokens.json",
    description:
      "Prefer an editor to the visual Studio? Theme documents are plain DTCG JSON: change a $value, save, and the dev server rebuilds. Run npx spin lint . to catch contrast or schema mistakes.",
  },
  {
    name: "3. Analyze before shipping",
    badge: "npx spin brand analyze",
    description:
      "The same six validation checks the Studio runs live are available from the CLI, so CI can gate on npx spin brand analyze or npx spin lint .",
  },
];

const SEATING_ITEMS: readonly PropEntry[] = [
  {
    name: "1. activeTheme in spin/config.json",
    badge: "Project default",
    description:
      "When spin/config.json names an activeTheme that exists in the resolved theme set, that theme is seated as the root default.",
  },
  {
    name: "2. Remembered Studio selection",
    badge: "Dev session",
    description:
      "During local development, the theme last selected in the Studio stays active across reloads.",
  },
  {
    name: "3. First theme in themeOrder",
    badge: "Fallback",
    description:
      "If no activeTheme is set, Spin seats the first theme in themeOrder (or the first brand directory in spin/, sorted by name).",
  },
];

const SWATCH_ROLES: readonly {
  readonly label: string;
  readonly bgClass: string;
  readonly path: string;
}[] = [
  { label: "surface", bgClass: "bg-surface", path: "color.surface" },
  {
    label: "raised",
    bgClass: "bg-surface-raised",
    path: "color.surface-raised",
  },
  { label: "text", bgClass: "bg-text", path: "color.text" },
  { label: "primary", bgClass: "bg-primary", path: "color.primary" },
  { label: "secondary", bgClass: "bg-secondary", path: "color.secondary" },
  { label: "accent", bgClass: "bg-accent", path: "color.accent" },
];

export default function ThemesOverview(): JSX.Element {
  const languages = themeSummaries();
  const [selectedName, setSelectedName] = createSignal<string>(
    languages[0]?.name ?? "minimal",
  );
  const selected = createMemo<ThemeSummary>(
    () =>
      languages.find((item) => item.name === selectedName()) ?? languages[0]!,
  );

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Brands"
        lede="A Spin project authors its brand in spin/<brand>/ over a starting design language and serves both light and dark modes. Edit visually in the Studio, commit clean DTCG JSON, and layer optional palette or spacing facets at runtime."
      />

      <Section id="vocabulary" title="Design Language, Brand, Facet, and Theme">
        <p class="max-w-prose">
          Spin separates the starting physics you inherit from the brand your
          repository owns and the runtime attributes the browser wears:
        </p>
        <PropList items={VOCABULARY_ITEMS} />
      </Section>
      <Section id="studio" title="Studio vs. CLI setup">
        <p class="max-w-prose">
          You do not write theme JSON by hand unless you want to. Spin ships
          with a live visual editor — the <A href="/studio">Studio</A> — that
          mounts directly beside your app during development. Any adjustment
          to a color role, font family, spacing step, or corner radius repaints
          your running application immediately before touching disk.
        </p>
        <PropList items={STUDIO_STEPS} />
        <p class="max-w-prose">
          Prefer the terminal? <code>npx spin init</code> scaffolds the same
          project, and every check the Studio runs live is also available from{" "}
          <code>npx spin lint</code> and <code>npx spin brand analyze</code>:
        </p>
        <PropList items={CLI_STEPS} />
        <p class="max-w-prose">
          Try the live editor on the <A href="/studio">Studio page</A>, or
          connect a coding agent via the{" "}
          <A href="/docs/tooling/mcp">MCP Server</A> so it can read and mutate
          tokens through the same validation pipeline.
        </p>
      </Section>

      <Section id="languages" title="Six starting design languages">
        <p class="max-w-prose">
          Spin includes six foundational design languages in{" "}
          <code>@spinjs/theme</code>. Select a design language below to
          inspect its baseline palette and signature tokens, or preview it across
          this documentation site.
        </p>

        <div class="my-4 flex flex-col gap-4 rounded-lg border bg-surface-raised p-4">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div class="flex flex-wrap items-center gap-2">
              <For each={languages}>
                {(item) => {
                  const isSelected = () => selected().name === item.name;
                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedName(item.name)}
                      class={`bare cursor-pointer rounded-md border px-3 py-1 transition-colors duration-fast ${
                        isSelected()
                          ? "border-primary bg-primary text-on-primary type-body-emphasized"
                          : "border bg-surface text-muted hover:border-strong type-code"
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                }}
              </For>
            </div>
            <button
              type="button"
              class="secondary"
              onClick={() => setTheme(selected().name)}
            >
              {theme() === selected().name
                ? `Active on site (${selected().name})`
                : `Apply ${selected().name} to site`}
            </button>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <span class="type-body-emphasized">
                {selected().name}
              </span>
              <div class="flex flex-wrap items-center gap-1">
                <For each={selected().modes}>
                  {(m) => <Chip>{m}</Chip>}
                </For>
              </div>
            </div>
            <Show when={selected().thesis}>
              <p class="max-w-prose text-muted">
                {selected().thesis}
              </p>
            </Show>

            <div
              data-theme={selected().name}
              data-mode={selected().modes[0] ?? "light"}
              class="grid grid-cols-2 gap-2 rounded-md border bg-surface p-3 sm:grid-cols-3 md:grid-cols-6"
            >
              <For each={SWATCH_ROLES}>
                {(role) => {
                  const swatch = () =>
                    selected().palette.find((s) => s.path === role.path);
                  return (
                    <div class="flex flex-col gap-1">
                      <div
                        class={`h-8 w-full rounded-sm border ${role.bgClass}`}
                      />
                      <span class="type-caption-emphasized">
                        {role.label}
                      </span>
                      <span class="truncate type-code text-muted">
                        {swatch()?.value ?? "—"}
                      </span>
                    </div>
                  );
                }}
              </For>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <For each={selected().signature}>
                {(entry) => (
                  <div class="flex flex-col gap-1 rounded-sm border bg-surface p-2">
                    <span class="type-code text-muted">
                      {entry.path}
                    </span>
                    <span class="truncate type-caption-emphasized">
                      {entry.value}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        <p class="max-w-prose">
          Languages are starting points, not copies to vendor. New projects
          write a sparse document that names its language in{" "}
          <code>"$extends"</code> and states only their own overrides — the
          language stays shipped, so a language fix reaches every theme that
          layers over it:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.sparseExtends}
            lang="json"
            title="spin/acme/tokens.json"
          />
        </div>
        <p class="max-w-prose">
          Pass <code>--vendor</code> to <code>npx spin init</code> only when
          you need a standalone snapshot you can edit in full. When you fork
          a language in the Studio and hit <strong>Save</strong>, it writes a
          copy into <code>spin/&lt;brand&gt;/tokens.json</code> that your project
          owns.
        </p>
      </Section>

      <Section id="project" title="Project files and seating order">
        <p class="max-w-prose">
          A Spin project stores its themes in the <code>spin/</code> directory
          at the project root. Each <code>spin/&lt;brand&gt;/tokens.json</code> file
          defines one named theme (<code>spin/acme/tokens.json</code> registers <code>data-theme="acme"</code>), and <code>spin/config.json</code>{" "}
          controls which theme is seated by default and the order themes appear
          in pickers:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.studioConfig}
            lang="json"
            title="spin/config.json"
          />
        </div>
        <PropList items={SEATING_ITEMS} />
      </Section>

      <Section id="axes" title="Four axes that compose">
        <p class="max-w-prose">
          A Spin page wears four independent decisions, each set with its own
          attribute on <code>&lt;html&gt;</code> or on any nested subtree.
          The base theme decides the whole look (<code>data-theme</code>: <code>spin/acme/tokens.json</code> registers <code>data-theme="acme"</code>), a palette facet swaps only the ink
          (<code>data-palette</code>, from{" "}
          <code>catppuccin.palette.json</code>), a spacing facet swaps only
          the rhythm (<code>data-spacing</code>, from{" "}
          <code>compact.spacing.json</code>), and the mode picks the light or
          dark answer for the ink (<code>data-mode="light|dark"</code>).
          Because each axis writes its own CSS variables, they layer without
          clashing — set all four on the page root:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.composedAxes}
            lang="html"
            title="Composing all four axes"
          />
        </div>
        <p class="max-w-prose">
          Axes nest too: a dense sidebar keeps the page's theme and ink while
          tightening its own spacing, and a marketing panel previews another
          palette inside the same page:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.nestedFacets}
            lang="html"
            title="Subtree facets"
          />
        </div>
        <p class="max-w-prose">
          Next, see{" "}
          <A href="/docs/themes/customization">Layers &amp; Overrides</A> for
          the files inside <code>spin/&lt;brand&gt;/</code>,{" "}
          <A href="/docs/themes/palettes">Palettes &amp; Paired Inks</A> for
          fill/ink pairs and contrast floors,{" "}
          <A href="/docs/themes/modes">Light &amp; Dark Modes</A> for{" "}
          <code>$modes</code> and subtree scoping,{" "}
          <A href="/docs/themes/facets">Facets: Palettes &amp; Density</A> for{" "}
          <code>data-palette</code> and <code>data-spacing</code>, or{" "}
          <A href="/docs/themes/fonts">Fonts &amp; Type Styles</A>.
        </p>
      </Section>

      <Section id="extends" title="Optional skins and shared brands">
        <p class="max-w-prose">
          One theme with two modes covers most applications. When your app
          offers user-selectable color skins — seasonal palettes, team colors,
          white-label variants — add more files to <code>spin/&lt;brand&gt;/</code>{" "}
          and list them in <code>themeOrder</code>. Multi-app teams can also
          publish a shared brand package exporting{" "}
          <code>{"{ themes: { ... } }"}</code> and pass it to any bundler
          adapter (<code>spin.vite()</code>, <code>spin.rspack()</code>,{" "}
          <code>spin.webpack()</code>, <code>spin.bun()</code>). Local files in{" "}
          <code>spin/&lt;brand&gt;/</code> layer on top of <code>extends</code>: a
          local theme with the same name overrides the shared one, and saving
          a shared theme in the Studio forks it into <code>spin/</code>.
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.viteSharedBrand}
            lang="ts"
            title="vite.config.ts"
          />
        </div>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.bundlerPlugin}
            lang="ts"
            title="Any bundler adapter"
          />
        </div>
        <p class="max-w-prose">
          Prefer the terminal? The same file is what{" "}
          <code>npx spin init</code> writes by default — no flags needed.
        </p>
      </Section>
    </main>
  );
}
