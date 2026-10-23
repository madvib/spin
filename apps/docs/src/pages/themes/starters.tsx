/**
 * The catalogue of starter themes.
 *
 * Every word on this page is read out of the theme documents rather than
 * written here: the palette, the modes, the type, shape, depth and motion
 * decisions, and the thesis, which is the document's own `$description`. A
 * theme that has not written one says so, because a catalogue that invents a
 * thesis is a catalogue that is wrong about somebody's design.
 *
 * Each theme is rendered in itself. The card re-declares `data-theme`, so the
 * utilities inside it resolve against that theme's own custom properties, and
 * the dark panel re-declares the mode as well. The colors on this page are
 * painted by the same mechanism a consumer's app uses.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Chip } from "../../bits.tsx";
import { themeSummaries } from "../../theme-docs.ts";
import type { Swatch, ThemeSummary } from "../../theme-docs.ts";
export default function Starters(): JSX.Element {
  const themes = themeSummaries();
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <h1>Starters</h1>
      <p class="max-w-screen-md text-text-muted">
        The themes the package ships. Each one is a document in{" "}
        <code>@spin/theme/themes</code>, and this page is a rendering of those
        documents, so it cannot drift from them. A project forks one by writing
        a file of the same name into its own <code>spin/</code>{" "}
        directory. Fork yours in{" "}
        <A href="/themes/studio">the Studio</A>, or by hand following{" "}
        <A href="/themes/authoring">Authoring a theme</A>.
      </p>
      <div class="mt-8">
        <For each={themes}>
          {(theme) => <ThemeCard theme={theme} />}
        </For>
      </div>
    </main>
  );
}

/** One theme, in itself. */
function ThemeCard(props: { theme: ThemeSummary }): JSX.Element {
  const theme = props.theme;
  return (
    <article
      class="mb-8 overflow-hidden rounded-md border border-border bg-surface text-text"
      data-theme={theme.name}
    >
      <header class="border-b border-border bg-surface-raised p-4">
        <div class="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h2>{theme.name}</h2>
          <div class="flex flex-wrap gap-2">
            <For each={theme.modes}>
              {(mode) => <Chip>{mode}</Chip>}
            </For>
          </div>
        </div>
        <p class="text-sm">
          {theme.thesis ??
            "The thesis is unwritten. This document states no description of its own, so the palette and the axes below are all it has to say."}
        </p>
      </header>

      <div class="p-4">
        <p class="text-xs font-semibold uppercase tracking-widest text-text-muted">
          palette
        </p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <For each={theme.palette}>
            {(swatch) => <SwatchCell swatch={swatch} />}
          </For>
        </div>
      </div>

      <hr />

      {theme.carriesDark
        ? (
          <div
            class="bg-surface p-4"
            data-theme={theme.name}
            data-mode="dark"
          >
            <p class="text-xs font-semibold uppercase tracking-widest text-text-muted">
              the same palette, in the dark
            </p>
            <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <For each={theme.palette}>
                {(swatch) => <SwatchCell swatch={swatch} dark />}
              </For>
            </div>
          </div>
        )
        : (
          <div class="p-4">
            <p class="text-sm text-text-muted">
              This theme states one rendering. It has no second set of values,
              so the panel above is the whole of it.
            </p>
          </div>
        )}

      <hr />

      <div class="p-4">
        <p class="text-xs font-semibold uppercase tracking-widest text-text-muted">
          signature
        </p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4">axis</th>
                <th class="py-2 pr-4">token</th>
                <th class="py-2 pr-4">value</th>
              </tr>
            </thead>
            <tbody>
              <For each={theme.signature}>
                {(entry) => (
                  <tr class="border-b border-border">
                    <td class="text-text-muted">{entry.axis}</td>
                    <td class="font-mono text-xs text-text">
                      {entry.path}
                    </td>
                    <td class="font-mono text-xs break-all">
                      {entry.value}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}

/**
 * One color role: the swatch, the name, and the value the document states.
 *
 * The swatch is painted by a utility, so the color is whatever that theme's
 * own custom property says in this scope. The dark panel reads the same
 * utility in the dark scope, so the two panels cannot disagree.
 */
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
