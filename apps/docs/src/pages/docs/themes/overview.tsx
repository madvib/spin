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
    badge: "starting point",
    description:
      "One of six built-in looks — quiet minimal, printed editorial, tonal material, loud neobrutalist, soft neumorphic, frosted glassmorphic. Supplies the baseline your brand builds on; never a theme you ship as-is.",
  },
  {
    name: "Brand",
    badge: "spin/<brand>/",
    description:
      "Your project's own design identity in git — your colors, typography, spacing, and dark mode, shaped in Studio or your code editor.",
  },
  {
    name: "Facet",
    badge: "optional overlay",
    description:
      "A palette or density variation that layers over your brand at runtime: a seasonal palette, a compact sidebar — without duplicating the brand.",
  },
  {
    name: "Resolved Theme",
    badge: "what the browser wears",
    description:
      "What the page actually paints: your brand plus any active palette, density, and light-or-dark choice, resolved into CSS variables.",
  },
];

const STUDIO_STEPS: readonly PropEntry[] = [
  {
    name: "1. Click the Studio button",
    badge: "live overlay",
    description:
      "Start your dev server and click the floating Studio button in the bottom-right corner of your app (or run npx spin studio standalone).",
  },
  {
    name: "2. Create your brand in 4 steps (/init)",
    badge: "Brand → Language → Color → Type",
    description:
      "Name your brand, pick one of the six starting looks, seed your palette from one primary color, and choose a font pairing and icons.",
  },
  {
    name: "3. Tune with live contrast and scale feedback",
    badge: "workbenches",
    description:
      "Step through Color, Type, Spacing, Style, Motion, and Icons. Every fill-and-ink pair shows its live contrast ratio with a one-click Fix button.",
  },
  {
    name: "4. Save to spin/<brand>/",
    badge: "git-diffable",
    description:
      "Edits preview live first. Pressing Save writes clean files into spin/<brand>/ that diff, review, and merge like code.",
  },
];

const CLI_STEPS: readonly PropEntry[] = [
  {
    name: "1. Scaffold a project",
    badge: "npx spin init",
    description:
      "From an empty folder, answer two prompts and get a wired project with your first brand serving light and dark modes.",
  },
  {
    name: "2. Edit the files directly",
    badge: "spin/<brand>/",
    description:
      "Prefer an editor to the visual Studio? Change a value, save, and the dev server rebuilds. Run the linter to catch mistakes.",
  },
  {
    name: "3. Check before shipping",
    badge: "lint & analyze",
    description:
      "The same checks the Studio runs live are available from the terminal, so CI can gate on them.",
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
        title="Studio"
        lede="Create and edit your brand visually inside your running app, starting from one of six design languages."
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
          Spin ships six starting looks. Select one below to inspect its
          palette and character, or preview it across this documentation site.
          Your brand starts from the one you pick — then becomes its own thing.
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
          Languages are starting points, not copies to keep. Your brand names
          its language and states only its own decisions — the language stays
          shipped, so an improvement to it reaches every brand built on it:
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
          copy into your brand directory that your project owns.
        </p>
      </Section>

      <Section id="project" title="Project files and seating order">
        <p class="max-w-prose">
          A Spin project stores its brand in the <code>spin/</code> directory
          at the project root. Each brand directory registers one theme, and
          the project config controls which theme paints the page by default
          and the order themes appear in pickers:
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
          attribute on the page or on any nested section. The brand decides the
          whole look, a palette swaps only the ink, a density swaps only the
          rhythm, and the mode picks the light or dark answer for the ink.
          Because each axis writes its own variables, they layer without
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
          <A href="/docs/themes/customization">Brand Files</A> for
          the files inside your brand directory,{" "}
          <A href="/docs/themes/palettes">Color &amp; Contrast</A> for
          fill/ink pairs and contrast floors,{" "}
          <A href="/docs/themes/modes">Light &amp; Dark Modes</A> for{" "}
          per-mode ink and subtree scoping,{" "}
          <A href="/docs/themes/facets">Palettes &amp; Density</A> for{" "}
          subtree palette and density overlays, or{" "}
          <A href="/docs/themes/fonts">Typography &amp; Voices</A>.
        </p>
      </Section>

      <Section id="extends" title="Optional skins and shared brands">
        <p class="max-w-prose">
          One brand with two modes covers most applications. When your app
          offers user-selectable color skins — seasonal palettes, team colors,
          white-label variants — add more themes and list them in the project
          config. Multi-app teams can also publish a shared brand package and
          pass it to any bundler adapter. Local brand files layer on top of a
          shared package: a local theme with the same name overrides the shared
          one, and saving a shared theme in the Studio forks it into{" "}
          <code>spin/</code>.
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
