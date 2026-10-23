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
import { primitiveCategories, primitiveElements } from "@spin/preset";
import { library } from "../../lib/store.ts";
import { inDrawer } from "../../lib/host.ts";
import { Marker } from "../../components/Concern.tsx";

const MACHINE_TAXONOMY: readonly {
  readonly id: string;
  readonly label: string;
  readonly members: readonly { readonly name: string; readonly icon: string }[];
}[] = [
  { id: "inputs", label: "Inputs · interactive", members: [{ name: "component-angle-slider", icon: "i-lucide-compass" }, { name: "component-color-picker", icon: "i-lucide-palette" }, { name: "component-date-input", icon: "i-lucide-calendar-days" }, { name: "component-date-picker", icon: "i-lucide-calendar" }, { name: "component-editable", icon: "i-lucide-pencil" }, { name: "component-file-upload", icon: "i-lucide-upload" }, { name: "component-number-input", icon: "i-lucide-hash" }, { name: "component-pin-input", icon: "i-lucide-key-round" }, { name: "component-rating-group", icon: "i-lucide-star" }, { name: "component-slider", icon: "i-lucide-sliders-horizontal" }, { name: "component-tags-input", icon: "i-lucide-tags" }, { name: "component-toggle-group", icon: "i-lucide-toggle-left" }] },
  { id: "selectors", label: "Selection · interactive", members: [{ name: "component-cascade-select", icon: "i-lucide-list-tree" }, { name: "component-combobox", icon: "i-lucide-chevrons-up-down" }, { name: "component-listbox", icon: "i-lucide-listbox" }, { name: "component-menu", icon: "i-lucide-menu" }, { name: "component-navigation-menu", icon: "i-lucide-navigation" }, { name: "component-select", icon: "i-lucide-chevron-down" }, { name: "component-tree-view", icon: "i-lucide-folder-tree" }] },
  { id: "display", label: "Display · interactive", members: [{ name: "component-async-list", icon: "i-lucide-list-filter" }, { name: "component-avatar", icon: "i-lucide-circle-user" }, { name: "component-carousel", icon: "i-lucide-gallery-horizontal" }, { name: "component-pagination", icon: "i-lucide-chevrons-left-right" }, { name: "component-steps", icon: "i-lucide-list-ordered" }, { name: "component-tabs", icon: "i-lucide-layout-list" }, { name: "component-timer", icon: "i-lucide-timer" }, { name: "component-tour", icon: "i-lucide-route" }] },
  { id: "overlays", label: "Overlays · interactive", members: [{ name: "component-floating-panel", icon: "i-lucide-panel-top" }, { name: "component-hover-card", icon: "i-lucide-square-mouse-pointer" }, { name: "component-popover", icon: "i-lucide-message-circle" }, { name: "component-toast", icon: "i-lucide-bell" }, { name: "component-tooltip", icon: "i-lucide-message-circle-off" }] },
  { id: "layout", label: "Layout · interactive", members: [{ name: "component-splitter", icon: "i-lucide-columns-2" }] },
  { id: "media", label: "Media · interactive", members: [{ name: "component-image-cropper", icon: "i-lucide-crop" }, { name: "component-signature-pad", icon: "i-lucide-pen-line" }] },
];

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
    return [...primitiveCategories
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
      }))]
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
