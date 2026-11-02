/**
 * Starter Themes: live-rendered catalogue of the five shipped starter palettes.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Chip, Section } from "../../../bits.tsx";
import { PageHeader } from "../../../ui/index.ts";
import { themeSummaries } from "../../../theme-docs.ts";
import type { Swatch, ThemeSummary } from "../../../theme-docs.ts";

export default function Starters(): JSX.Element {
  const themes = themeSummaries();
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Starter Themes"
        lede={
          <>
            The five starter themes shipped in{" "}
            <code>@spinjs/spin/theme/themes</code> (<code>starterThemes</code>,{" "}
            <code>StarterThemeName</code>, and <code>starterGroups()</code>):{" "}
            <code>silk</code>, <code>neobrut</code>, <code>console</code>,{" "}
            <code>synthwave</code>, and <code>spin</code>.
          </>
        }
      />

      <Section id="forking" title="Creation-only templates & forking">
        <p class="max-w-prose">
          Starters are creation-only templates and are never auto-served into a
          project's <code>spin/</code> directory. An unforked theme served from
          the package or a <code>themes</code> map has a project path of{" "}
          <code>null</code>; saving or writing{" "}
          <code>spin/&lt;name&gt;.json</code> (for example{" "}
          <code>spin/silk.json</code>) forks it into your project. Fork yours
          in <A href="/studio">the Studio</A>, or by hand following{" "}
          <A href="/docs/themes/authoring">Authoring &amp; Gates</A>.
        </p>
      </Section>

      <Section id="palettes" title="Shipped palettes">
        <div class="mt-4 flex flex-col gap-8">
          <For each={themes}>
            {(theme) => <ThemeCard theme={theme} />}
          </For>
        </div>
      </Section>
    </main>
  );
}

function ThemeCard(props: { theme: ThemeSummary }): JSX.Element {
  const theme = props.theme;
  return (
    <article
      class="overflow-hidden rounded-lg border border-border bg-surface text-text shadow-sm"
      data-theme={theme.name}
    >
      <header class="border-b border-border bg-surface-raised p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3>{theme.name}</h3>
          <div class="flex flex-wrap gap-2">
            <For each={theme.modes}>{(mode) => <Chip>{mode}</Chip>}</For>
          </div>
        </div>
        <p class="text-sm text-text-muted">
          {theme.thesis ?? "No $description declared in document."}
        </p>
      </header>

      <div class="p-4">
        <p class="text-xs font-semibold uppercase tracking-widest text-text-muted">
          Base palette
        </p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <For each={theme.palette}>
            {(swatch) => <SwatchCell swatch={swatch} />}
          </For>
        </div>
      </div>

      <hr />

      {theme.carriesDark ? (
        <div
          class="bg-surface p-4"
          data-theme={theme.name}
          data-mode="dark"
        >
          <p class="text-xs font-semibold uppercase tracking-widest text-text-muted">
            Dark mode palette
          </p>
          <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <For each={theme.palette}>
              {(swatch) => <SwatchCell swatch={swatch} dark />}
            </For>
          </div>
        </div>
      ) : (
        <div class="p-4">
          <p class="text-sm text-text-muted">
            Single-mode theme — base values are the only rendering.
          </p>
        </div>
      )}

      <hr />

      <div class="p-4">
        <p class="text-xs font-semibold uppercase tracking-widest text-text-muted">
          Signature tokens
        </p>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <For each={theme.signature}>
            {(entry) => (
              <div class="flex items-baseline justify-between gap-2 rounded-sm border border-border bg-surface-raised px-3 py-2 text-xs">
                <span class="font-mono text-text-muted">{entry.axis}</span>
                <span class="truncate font-mono text-text" title={entry.value}>
                  {entry.path}: <strong>{entry.value}</strong>
                </span>
              </div>
            )}
          </For>
        </div>
      </div>
    </article>
  );
}

function SwatchCell(props: { swatch: Swatch; dark?: boolean }): JSX.Element {
  const swatch = props.swatch;
  const short = swatch.path.split(".").slice(1).join(".");
  return (
    <div class="min-w-0">
      <div
        class={`h-10 w-full rounded-sm border border-border ${swatch.utility}`}
        title={`${swatch.path} ${swatch.value}`}
      />
      <div class="mt-1 truncate font-mono text-xs text-text">{short}</div>
      <div class="truncate font-mono text-xs text-text-muted">
        {props.dark === true ? (swatch.dark ?? "not restated") : swatch.value}
      </div>
    </div>
  );
}
