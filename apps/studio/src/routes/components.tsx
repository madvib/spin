import { For, Match, Switch } from "solid-js";
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
 */
export default function ComponentsLayout(props: { children?: JSX.Element }) {
  const location = useLocation();
  // The drawer has no room for a rail beside the content: the list becomes a
  // wrapping strip above the page it navigates.
  const drawer = inDrawer();
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
        <Switch
          fallback={
            <ul class={listClass()}>
              <For each={library() ?? []}>
                {(component) => (
                  <li>
                    <A
                      href={`/components/${component.name}`}
                      class="no-underline text-sm capitalize hover:underline"
                      classList={{
                        "font-semibold text-text":
                          location.pathname === `/components/${component.name}`,
                      }}
                    >
                      {component.name.replace(/-/g, " ")}
                    </A>
                  </li>
                )}
              </For>
            </ul>
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
