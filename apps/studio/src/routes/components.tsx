import { For, Match, Show, Switch } from "solid-js";
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { library } from "../lib/store.ts";

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
  return (
    <div class="flex flex-1 min-h-0">
      <nav
        aria-label="Components"
        class="flex w-44 shrink-0 flex-col gap-4 overflow-y-auto bg-surface-raised p-4"
      >
        <h2 class="text-sm font-semibold">Components</h2>
        <Switch
          fallback={
            <ul class="flex flex-col gap-1">
              <For each={library() ?? []}>
                {(component) => (
                  <li>
                    <A
                      href={`/components/${component.name}`}
                      class="text-sm capitalize hover:underline"
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
            <p class="text-sm text-slate-500">loading…</p>
          </Match>
          <Match when={(library() ?? []).length === 0}>
            <p class="text-sm text-slate-500">
              No components. Is the daemon running?
            </p>
          </Match>
        </Switch>
      </nav>
      {props.children}
    </div>
  );
}
