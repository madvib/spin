import { createSignal, For, Match, Show, Switch } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import type { JSX } from "solid-js";
import { library } from "../lib/store.ts";
import { inDrawer } from "../app.tsx";

/**
 * The component gallery's side list, read from the daemon.
 *
 * It used to be four hardcoded entries — and one of them (`modal`) was not a
 * component name at all, so it navigated to a page that could not resolve.
 * A list typed by hand is a list that is wrong the moment the library
 * changes; this one is the same `primitives.list` the page renders, so the
 * navigation and the content cannot disagree.
 *
 * The search narrows THIS list and lives here beside it: a filter that sits
 * somewhere else looks like it applies to the page. The count says what the
 * filter did without the reader having to remember what was there before,
 * and a row the search empties is hidden rather than drawn over nothing.
 */
export default function ComponentsLayout(props: { children?: JSX.Element }) {
  const location = useLocation();
  // The drawer has no room for a rail beside the content: the list becomes a
  // wrapping strip above the page it navigates.
  const drawer = inDrawer();
  const [query, setQuery] = createSignal("");
  const needle = () => query().trim().toLowerCase();
  const total = () => library()?.length ?? 0;
  const shown = () => {
    const all = library() ?? [];
    const asked = needle();
    return asked === ""
      ? all
      : all.filter((c) => c.name.replace(/-/g, " ").includes(asked));
  };
  const navClass = () =>
    drawer
      ? "flex shrink-0 flex-col gap-2 border-b border-border bg-surface-raised p-3"
      : "flex w-[11rem] shrink-0 flex-col gap-4 overflow-y-auto bg-surface-raised p-4";
  const listClass = () =>
    drawer
      ? "flow-list flex flex-wrap gap-x-3 gap-y-1"
      : "flow-list flex flex-col gap-1";

  return (
    <div
      class={drawer
        ? "flex min-h-0 flex-col"
        : "drawer-scroll flex flex-1 min-h-0"}
    >
      <nav aria-label="Components" class={navClass()}>
        <h2
          class={drawer ? "text-sm text-text-muted" : "text-sm font-semibold"}
        >
          Components
        </h2>
        <label class="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1">
          <i
            class="i-lucide-search icon-sm shrink-0 text-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            aria-label="Filter the components"
            placeholder="filter…"
            class="min-w-0 flex-1 border-none bg-transparent p-0 text-sm text-text placeholder:text-text-muted"
          />
        </label>
        <div class="flex items-center justify-between gap-2 text-xs text-text-muted">
          <span>components</span>
          <span class="font-mono">
            {needle() === "" ? `${total()}` : `${shown().length} of ${total()}`}
          </span>
        </div>
        <Switch
          fallback={
            <Show
              when={shown().length > 0}
              fallback={
                <p class="text-xs text-text-muted">
                  No component matches “{query()}”.
                </p>
              }
            >
              <ul class={listClass()}>
                <For each={shown()}>
                  {(component) => (
                    <li>
                      <A
                        href={`/components/${component.name}`}
                        class="no-underline text-sm capitalize hover:underline"
                        classList={{
                          "font-semibold text-text": location.pathname ===
                            `/components/${component.name}`,
                        }}
                      >
                        {component.name.replace(/-/g, " ")}
                      </A>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          }
        >
          <Match when={library() === undefined}>
            <p class="text-sm text-text-muted">loading…</p>
          </Match>
          <Match when={(library() ?? []).length === 0}>
            <p class="text-sm text-text-muted">
              No components. Is the daemon running?
            </p>
          </Match>
        </Switch>
      </nav>
      {props.children}
    </div>
  );
}
