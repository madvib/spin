/**
 * Themes Overview: Studio workflow, interactive starter preview, project files, and shared brands.
 */
import { A } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { setTheme, theme } from "@spinjs/kit";
import { Chip, Code, Section } from "../../../bits.tsx";
import { PageHeader, PropList, type PropEntry } from "../../../ui/index.ts";
import { themeSummaries, type ThemeSummary } from "../../../theme-docs.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const STUDIO_STEPS: readonly PropEntry[] = [
  {
    name: "1. Launch the Studio",
    badge: "/__spin/studio/",
    description:
      "With spin.vite() running, click the Studio pill in the bottom-right corner of your app (or run npx spin studio for any other bundler).",
  },
  {
    name: "2. Fork a starter or create a theme",
    badge: "New theme",
    description:
      "Pick one of the five starter palettes (spin, silk, neobrut, console, synthwave) or start from a clean scaffold, then tune colors, typefaces, spacing, and radii against your live page.",
  },
  {
    name: "3. Check live contrast & scale gates",
    badge: "6 gates",
    description:
      "Every fill-and-ink pair displays its live WCAG contrast ratio and offers a one-click fix whenever a token drops below its legibility floor.",
  },
  {
    name: "4. Save to spin/<name>.json",
    badge: "git-diffable",
    description:
      "Changes preview in memory first. Pressing Save writes spin/<name>.json and updates spin/config.json in your repository.",
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
      "If no activeTheme is set, Spin seats the first theme in themeOrder (or the first alphabetical file in spin/*.json).",
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
        lede="A Spin theme defines your application's palette, typography, spacing, radii, shadows, and motion. Design and validate themes visually in the Studio, commit the generated JSON to spin/, and switch themes or modes at runtime with zero rebuild."
      />

      <Section id="studio" title="Designing in the Studio">
        <p class="max-w-prose">
          You do not write theme JSON by hand. Spin ships with a live visual
          editor — the <A href="/studio">Studio</A> — that mounts directly
          beside your app during development. Any adjustment to a color role,
          font family, spacing step, or corner radius repaints your running
          application immediately before touching disk.
        </p>
        <PropList items={STUDIO_STEPS} />
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

        <div class="my-4 flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div class="flex flex-wrap items-center gap-2">
              <For each={starters}>
                {(item) => {
                  const isSelected = () => selected().name === item.name;
                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedName(item.name)}
                      class={`bare cursor-pointer rounded-md border px-3 py-1 font-mono text-xs transition-colors duration-fast ${
                        isSelected()
                          ? "border-primary bg-primary text-on-primary font-semibold"
                          : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text"
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
              <span class="font-mono text-sm font-semibold text-text">
                {selected().name}
              </span>
              <div class="flex flex-wrap items-center gap-1">
                <For each={selected().modes}>
                  {(m) => <Chip>{m}</Chip>}
                </For>
              </div>
            </div>
            <Show when={selected().thesis}>
              <p class="max-w-prose text-sm text-text-muted">
                {selected().thesis}
              </p>
            </Show>

            <div
              data-theme={selected().name}
              data-mode={selected().modes[0] ?? "light"}
              class="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface p-3 sm:grid-cols-3 md:grid-cols-6"
            >
              <For each={SWATCH_ROLES}>
                {(role) => {
                  const swatch = () =>
                    selected().palette.find((s) => s.path === role.path);
                  return (
                    <div class="flex flex-col gap-1">
                      <div
                        class={`h-8 w-full rounded-sm border border-border ${role.bgClass}`}
                      />
                      <span class="font-mono text-xs font-semibold text-text">
                        {role.label}
                      </span>
                      <span class="truncate font-mono text-xs text-text-muted">
                        {swatch()?.value ?? "—"}
                      </span>
                    </div>
                  );
                }}
              </For>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <For each={selected().signature.slice(0, 4)}>
                {(entry) => (
                  <div class="flex flex-col gap-1 rounded-sm border border-border bg-surface p-2">
                    <span class="font-mono text-xs text-text-muted">
                      {entry.path}
                    </span>
                    <span class="truncate font-mono text-xs font-semibold text-text">
                      {entry.value}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        <p class="max-w-prose text-sm text-text-muted">
          Starters are templates: when your project has its own{" "}
          <code>spin/*.json</code> files, Spin serves only your project's
          themes unless you explicitly include starters via{" "}
          <code>extends</code>. When you fork a starter in the Studio and hit{" "}
          <strong>Save</strong>, it writes a copy into{" "}
          <code>spin/&lt;name&gt;.json</code> that your project owns.
        </p>
      </Section>

      <Section id="project" title="Project files and seating order">
        <p class="max-w-prose">
          A Spin project stores its themes in the <code>spin/</code> directory
          at the project root. Each <code>spin/&lt;name&gt;.json</code> file
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

      <Section id="extends" title="Sharing a brand across apps">
        <p class="max-w-prose">
          Multi-app teams can publish a shared brand package exporting{" "}
          <code>{"{ themes: { ... } }"}</code> and pass it to{" "}
          <code>spin.vite({"{ extends: acmeBrand }"})</code>. Local files in{" "}
          <code>spin/*.json</code> layer on top of <code>extends</code>: a
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
        <p class="max-w-prose">
          Next, see <A href="/docs/themes/modes">Modes</A> for light and dark
          mode scoping, <A href="/docs/themes/customization">Customization</A>{" "}
          for fonts and element overrides,{" "}
          <A href="/docs/themes/validation">Validation</A> for the six build
          gates, or <A href="/docs/themes/reference">Token Reference</A> for
          every token group and role.
        </p>
      </Section>
    </main>
  );
}
