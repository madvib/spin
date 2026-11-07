/**
 * Themes Overview: one brand theme with light and dark modes, the Studio vs. CLI
 * setup walkthrough, the starter switcher, and optional multi-theme skins.
 */
import { A } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { setTheme, theme } from "@spinjs/kit";
import { Chip, Code, PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";
import { themeSummaries, type ThemeSummary } from "../../../markdown/theme-docs.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const STUDIO_STEPS: readonly PropEntry[] = [
  {
    name: "1. Launch the Studio",
    badge: "/__spin/studio/",
    description:
      "With a Spin bundler plugin running (spin.vite(), spin.rspack(), spin.webpack(), spin.bun(), or any of the seven adapters), click the Studio pill in the bottom-right corner of your app — or run npx spin studio standalone beside any dev server.",
  },
  {
    name: "2. Fork a starter or create a theme",
    badge: "New theme",
    description:
      "Pick one of the five starter archetypes (spin, silk, material, neobrut, industrial) or start from a clean scaffold, then tune colors, typefaces, spacing, and radii against your live page.",
  },
  {
    name: "3. Check live contrast & scale checks",
    badge: "6 checks",
    description:
      "Every fill-and-ink pair displays its live WCAG contrast ratio and offers a one-click fix whenever a token drops below its legibility floor.",
  },
  {
    name: "4. Save to spin/<brand>/tokens.json",
    badge: "git-diffable",
    description:
      "Changes preview in memory first. Pressing Save writes spin/<brand>/tokens.json and updates spin/config.json in your repository.",
  },
];

const CLI_STEPS: readonly PropEntry[] = [
  {
    name: "1. Scaffold a project",
    badge: "npx spin init",
    description:
      "From an empty folder, npx spin init detects your bundler, writes the plugin wiring, and creates spin/default.json — a single brand theme serving light and dark modes.",
  },
  {
    name: "2. Edit the JSON directly",
    badge: "spin/default.json",
    description:
      "Prefer an editor to the visual Studio? Theme documents are plain DTCG JSON: change a $value, save, and the dev server rebuilds. Run npx spin lint . to catch contrast or schema mistakes.",
  },
  {
    name: "3. Analyze before shipping",
    badge: "npx spin theme analyze",
    description:
      "The same six validation checks the Studio runs live are available from the CLI, so CI can gate on npx spin theme analyze or npx spin lint .",
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
  const starters = themeSummaries();
  const [selectedName, setSelectedName] = createSignal<string>(
    starters[0]?.name ?? "spin",
  );
  const selected = createMemo<ThemeSummary>(
    () =>
      starters.find((item) => item.name === selectedName()) ?? starters[0]!,
  );

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Overview"
        lede="Most applications need one brand theme — spin/default.json — serving light and dark modes. Design it visually in the Studio or scaffold it from the CLI, commit the generated JSON to spin/, and switch modes at runtime with zero rebuild."
      />

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
          <code>npx spin lint</code> and <code>npx spin theme analyze</code>:
        </p>
        <PropList items={CLI_STEPS} />
        <p class="max-w-prose">
          Try the live editor on the <A href="/studio">Studio page</A>, or
          connect a coding agent via the{" "}
          <A href="/docs/tooling/mcp">MCP Server</A> so it can read and mutate
          tokens through the same validation pipeline.
        </p>
      </Section>

      <Section id="starters" title="Starter palettes">
        <p class="max-w-prose">
          Spin includes five starter themes in{" "}
          <code>@spinjs/spin/theme</code>. Select a starter below to inspect
          its palette and signature tokens, or apply it to this documentation
          site.
        </p>

        <div class="my-4 flex flex-col gap-4 rounded-lg border bg-surface-raised p-4">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div class="flex flex-wrap items-center gap-2">
              <For each={starters}>
                {(item) => {
                  const isSelected = () => selected().name === item.name;
                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedName(item.name)}
                      class={`bare cursor-pointer rounded-md border px-3 py-1 transition-colors duration-fast ${
                        isSelected()
                          ? "border-primary bg-primary text-on-primary type-body-strong"
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
              <span class="type-body-strong">
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
                      <span class="type-caption-strong">
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
                    <span class="truncate type-caption-strong">
                      {entry.value}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        <p class="max-w-prose">
          Starters are starting points, not copies to vendor. New projects
          write a sparse document that names its starter in{" "}
          <code>"$extends"</code> and states only their own overrides — the
          starter stays shipped, so a starter fix reaches every theme that
          layers over it:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.sparseExtends}
            lang="json"
            title="spin/acme.json"
          />
        </div>
        <p class="max-w-prose">
          Pass <code>--vendor</code> to <code>npx spin init</code> only when
          you need a standalone snapshot you can edit in full. When you fork
          a starter in the Studio and hit <strong>Save</strong>, it writes a
          copy into <code>spin/&lt;brand&gt;/tokens.json</code> that your project
          owns.
        </p>
      </Section>

      <Section id="project" title="Project files and seating order">
        <p class="max-w-prose">
          A Spin project stores its themes in the <code>spin/</code> directory
          at the project root. Each <code>spin/&lt;brand&gt;/tokens.json</code> file
          defines one named theme (<code>spin/acme.json</code> registers{" "}
          <code>data-theme="acme"</code>), and <code>spin/config.json</code>{" "}
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
          The base theme decides the whole look (<code>data-theme</code>:{" "}
          <code>spin/acme.json</code> registers{" "}
          <code>data-theme="acme"</code>), a palette facet swaps only the ink
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
          Next, see <A href="/docs/themes/modes">Modes</A> for the palette,
          density, and mode axes live,{" "}
          <A href="/docs/themes/fonts">Fonts</A> for web fonts and the type
          scale, <A href="/docs/themes/customization">Customization</A> for
          palette roles and element overrides,{" "}
          <A href="/docs/themes/validation">Validation</A> for the six
          validation checks, or <A href="/docs/themes/reference">Token
          Reference</A> for every token group and role.
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
