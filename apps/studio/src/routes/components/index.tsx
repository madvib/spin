/**
 * The component gallery's index.
 *
 * Every primitive the preset ships, one card each, linking to its column.
 * This is the index a route with a side navigation needs: landing on
 * `/components` used to render nothing at all, and the whole vocabulary
 * lived on a second page — a wall of every variant at once, which nobody
 * reads and which duplicated the navigation beside it.
 *
 * The card is thin on purpose. The column it links to is where a component
 * is judged; this page is where you find it.
 */

import { For, Match, Switch } from "solid-js";
import { A } from "@solidjs/router";
import { library } from "../../lib/store.ts";

export default function ComponentsIndex() {
  return (
    <div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-8">
      <h1 class="text-2xl">Components</h1>
      <p class="max-w-screen-md text-text-muted">
        Every primitive the preset ships. Pick one to see its variants, what it
        reads, and where to change it.
      </p>
      <Switch
        fallback={
          <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <For each={library() ?? []}>
              {(component) => (
                <A
                  href={`/components/${component.name}`}
                  class="stack-sm rounded-lg border border-border bg-surface-raised p-4 no-underline"
                >
                  <strong class="capitalize">
                    {component.name.replace(/-/g, " ")}
                  </strong>
                  <span class="text-sm text-text-muted">
                    {component.tags.length === 1
                      ? `<${component.tags[0]}>`
                      : `${component.tags.length} tags`}
                  </span>
                </A>
              )}
            </For>
          </div>
        }
      >
        <Match when={library() === undefined}>
          <p class="mt-6 text-sm text-text-muted">loading…</p>
        </Match>
        <Match when={(library() ?? []).length === 0}>
          <p class="mt-6 text-sm text-text-muted">
            No components. Is the API running?
          </p>
        </Match>
      </Switch>
    </div>
  );
}
