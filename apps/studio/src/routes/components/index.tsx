/**
 * The component gallery's index.
 *
 * Every component the preset ships examples for, one card each, linking to
 * its column. This is the index a route with a side navigation needs: landing
 * on `/components` used to render nothing at all, and the whole vocabulary
 * lived on a second page — a wall of every variant at once, which nobody
 * reads and which duplicated the navigation beside it.
 *
 * The cards are GROUPED, in the taxonomy's order, and each wears the glyph
 * its element is known by: the same groups the side list draws and the same
 * groups the reference app's rail draws, so the two never disagree about
 * where an element lives.
 *
 * The card is thin on purpose. The column it links to is where a component
 * is judged; this page is where you find it.
 *
 * The group is marked the way every group in the studio is marked — a bar in
 * the acting colour beside its name — so the reader scanning the page for
 * the family they want is scanning the same marks they scan everywhere else.
 */

import { createMemo, createSignal, For, Match, Switch } from "solid-js";
import { A } from "@solidjs/router";
import { COMPONENT_ICONS } from "@spinjs/components";
import { primitiveElements } from "@spinjs/preset";
import {
  displayComponentName,
  unifiedComponentGroups,
} from "../../lib/primitives.ts";
import { library } from "../../lib/store.ts";
import { inDrawer } from "../../lib/host.ts";
import { Marker } from "../../components/Concern.tsx";
const ICONS: Readonly<Record<string, string>> = Object.fromEntries([
  ...primitiveElements.map((element) => [element.name, element.icon] as const),
  ...Object.entries(COMPONENT_ICONS).map(
    ([name, icon]) => [`component-${name}`, icon] as const,
  ),
]);
export default function ComponentsIndex() {
  const drawer = createMemo(() => inDrawer());
  const [kindFilter, setKindFilter] = createSignal<"all" | "primitive" | "machine">("all");

  const groups = createMemo(() => {
    const all = library() ?? [];
    const byName = new Map(all.map((component) => [component.name, component]));
    return unifiedComponentGroups(all, kindFilter(), "", ICONS).map((group) => ({
      label: group.label,
      rows: group.rows.map((row) => ({
        ...row,
        component: byName.get(row.name),
      })),
    }));
  });
  return (
    <div
      data-studio-chrome=""
      class="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6"
    >
      <div class="mx-auto max-w-screen-lg stack-lg">
        <header class="stack-sm">
          <h1>Components</h1>
          <p class="max-w-screen-md text-sm text-text-muted">
            Every primitive and interactive component in the library. Pick one
            to inspect its variants, interactive examples, and tokens.
          </p>
          <div role="group" aria-label="Component kind" class="flex w-fit shrink-0 gap-1 rounded-md border border-solid border-border p-1">
            <For each={(["all", "primitive", "machine"] as const)}>
              {(kind) => (
                <button
                  type="button"
                  aria-pressed={kindFilter() === kind}
                  onClick={() => setKindFilter(kind)}
                  class="bare rounded-md border border-solid border-transparent px-2 py-1 text-xs text-text-muted hover:text-text aria-[pressed=true]:border-border aria-[pressed=true]:bg-surface-raised aria-[pressed=true]:text-text aria-[pressed=true]:font-medium"
                >
                  {kind === "all" ? "All" : kind === "primitive" ? "CSS" : "Interactive"}
                </button>
              )}
            </For>
          </div>
        </header>
        <Switch
          fallback={
            <div class="flex flex-col gap-8">
            <For each={groups()}>
              {(group) => (
                <section class="stack-sm" aria-label={group.label}>
                  <h2 class="row-sm">
                    <Marker />
                    <span>{group.label}</span>
                  </h2>
                  <div
                    class="grid gap-4"
                    classList={{
                      "grid-cols-2": drawer(),
                      "sm:grid-cols-2 lg:grid-cols-3": !drawer(),
                    }}
                  >
                    <For each={group.rows}>
                      {(row) => (
                        <A
                          href={`/components/${row.name}`}
                          class="stack-sm rounded-lg border border-border bg-surface-raised p-4 no-underline hover:border-primary"
                        >
                          <span class="flex items-center gap-2">
                            <i
                              class={`${row.icon} icon-md shrink-0 text-primary`}
                              aria-hidden="true"
                            />
                            <strong class="capitalize text-text">
                              {displayComponentName(row.name)}
                            </strong>
                          </span>
                          <span class="flex items-center justify-between text-xs text-text-muted">
                            <span>
                              {row.component?.examples?.rows.length ?? 0}{" "}
                              examples
                            </span>
                            <span>
                              {row.name.startsWith("component-")
                                ? "interactive"
                                : "primitive"}
                            </span>
                          </span>
                        </A>
                      )}
                    </For>
                  </div>
                </section>
              )}
            </For>
          </div>
        }
      >
        <Match when={library() === undefined}>
          <p class="text-sm text-text-muted">loading…</p>
        </Match>
        <Match when={(library() ?? []).length === 0}>
          <p class="text-sm text-text-muted">
            No components. Is the API running?
          </p>
        </Match>
        </Switch>
      </div>
    </div>
  );
}
