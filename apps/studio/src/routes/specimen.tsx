/**
 * The specimen gallery: what a theme looks like applied to real components.
 *
 * Until this existed the studio said "previewing acme" and previewed
 * nothing — the styled surface held the token editor, so the only thing a
 * theme changed was the rows you were editing it in. A theme studio whose
 * whole promise is "make it yours" has to answer the question that is
 * actually being asked: what does MY button look like.
 *
 * The markup is the preset's own examples, read over RPC, which means two
 * things that matter. First, the specimens are real: they are the same rows
 * the reference app and the docs site render, so a theme that looks right
 * here looks right everywhere. Second, nothing here is a copy — a new example
 * in the preset appears here without this file changing.
 *
 * Everything renders inside the app's `data-theme`/`data-mode` wrapper, so an
 * edit to any token re-themes every specimen at once, live.
 */

import { createEffect, createMemo, For, Match, Switch } from "solid-js";
import { library, registerMarkup } from "../lib/store.ts";

/** A component's examples, as one group on the page. */
function SpecimenGroup(props: {
  name: string;
  note: string;
  rows: readonly { readonly name: string; readonly html: string }[];
}) {
  return (
    <section class="border-border rounded-lg border bg-surface-raised p-4">
      <h2 class="text-lg capitalize">{props.name.replace(/-/g, " ")}</h2>
      <p class="text-text-muted mt-1 text-sm">{props.note}</p>
      <div class="mt-4 flex flex-col gap-6">
        <For each={[...props.rows]}>
          {(row) => (
            <div class="border-border border-t pt-4">
              <h3 class="text-text-muted text-xs font-medium">{row.name}</h3>
              <div
                class="mt-2 flex flex-wrap items-center gap-2"
                innerHTML={row.html}
              />
            </div>
          )}
        </For>
      </div>
    </section>
  );
}

export default function SpecimenPage() {
  // The components that have examples, which is every primitive except the
  // utility-shaped ones. A component with no specimens is absent rather than
  // present-and-empty, so the page cannot render a heading with nothing under
  // it.
  // A memo, not a plain call: the registry arrives after first render, and a
  // const would snapshot `undefined` and show "loading" forever.
  const groups = createMemo(() =>
    (library() ?? [])
      .filter((component) => component.examples !== undefined)
      .map((component) => ({
        name: component.name,
        note: component.examples?.note ?? "",
        rows: component.examples?.rows ?? [],
      }))
  );

  // Register what this route renders, so the stylesheet is generated for it.
  createEffect(() =>
    registerMarkup(groups().flatMap((g) => g.rows.map((r) => r.html)).join(" "))
  );

  return (
    <div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
      <h1 class="text-2xl">Specimens</h1>
      <p>
        Every primitive, rendered in the theme you are editing. Change a token
        and this page changes with it.
      </p>
      <Switch
        fallback={
          <div class="mt-6 flex flex-col gap-8">
            <For each={groups()}>
              {(group) => (
                <SpecimenGroup
                  name={group.name}
                  note={group.note}
                  rows={group.rows}
                />
              )}
            </For>
          </div>
        }
      >
        <Match when={groups().length === 0}>
          <p class="text-sm">
            No specimens. Is the daemon running, and does the project have a
            theme loaded?
          </p>
        </Match>
      </Switch>
    </div>
  );
}
