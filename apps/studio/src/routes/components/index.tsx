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

import { createMemo, For, Match, Switch } from "solid-js";
import { A } from "@solidjs/router";
import { COMPONENT_GROUPS, COMPONENT_ICONS } from "@spinjs/components";
import { primitiveCategories, primitiveElements } from "@spinjs/preset";
import { library } from "../../lib/store.ts";
import { inDrawer } from "../../lib/host.ts";
import { Marker } from "../../components/Concern.tsx";

const MACHINE_TAXONOMY = COMPONENT_GROUPS.map((g) => ({
  id: g.id,
  label: `${g.label} · interactive`,
  members: g.members.map((m) => ({
    name: `component-${m}`,
    icon: COMPONENT_ICONS[m] ?? "i-lucide-box",
  })),
}));
export default function ComponentsIndex() {
  // Read through a memo, so the gallery re-lays-out when the host switches
  // the studio between the drawer and the modal: a grid that only changed
  // on the next navigation was a grid that was stale until the author left.
  const drawer = createMemo(() => inDrawer());

  /**
   * The groups, in the taxonomy's order, with the cards each one shows.
   *
   * The taxonomy is the filing: it says which group an element belongs to
   * and in what order the groups are read, so the gallery cannot drift from
   * the rail beside it.
   */
  const groups = createMemo(() => {
    const kept = new Map(
      (library() ?? []).map((component) => [component.name, component]),
    );
    return [
      ...primitiveCategories
        .map((category) => ({
          label: category.label,
          rows: primitiveElements
            .filter((element) => element.category === category.id)
            .map((element) => ({
              name: element.name,
              icon: element.icon,
              component: kept.get(element.name),
            }))
            .filter((row) => row.component !== undefined),
        })),
      ...MACHINE_TAXONOMY.map((category) => ({
        label: category.label,
        rows: category.members
          .map((element) => ({
            name: element.name,
            icon: element.icon,
            component: kept.get(element.name),
          }))
          .filter((row) => row.component !== undefined),
      })),
    ]
      .filter((group) => group.rows.length > 0);
  });

  return (
    <div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-8">
      <header class="stack-sm">
        <h1>Components</h1>
        <p class="max-w-screen-md text-sm text-text-muted">
          Every primitive the preset ships, in the groups the library files them
          by. Pick one to see its variants, what it reads, and where to change
          it.
        </p>
      </header>
      <Switch
        fallback={
          <div class="mt-6 flex flex-col gap-8">
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
                              {row.name.replace(/-/g, " ")}
                            </strong>
                          </span>
                          <span class="text-sm text-text-muted">
                            {row.component?.examples?.rows.length ?? 0} examples
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
  );
}
