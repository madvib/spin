/**
 * One component, read rather than described.
 *
 * This page replaces four hand-written pages that each spelled their own
 * markup: the studio's button page contained `<button class="secondary">
 * Cancel</button>` typed by hand while `button.examples.ts` was shipping the
 * same control as data. Nothing here is a copy — the label, the note, and the
 * markup all arrive from `primitives.list`, so a change to a component's
 * examples is a change this page renders.
 *
 * The markup is set with `innerHTML` because it is sourced markup the studio
 * is asked to render, not markup it writes. The daemon is the only thing that
 * produces it.
 */

import { createMemo, createResource, For, Show } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { primitivesTokens } from "../../lib/primitives.ts";
import { activeMode, library, themeText } from "../../lib/store.ts";
import { analyzeTheme } from "../../lib/theme.ts";
import { editorRouteFor, tokenPathsByVar } from "../../lib/tokens.ts";

export default function ComponentPage() {
  const params = useParams();
  // The shared registry: the side list and this page are one fetch, and the
  // store owns it so neither can drift from the other.
  const components = library;
  const [tokens] = createResource(
    () => params.name,
    (name) => primitivesTokens(name),
  );
  // A memo, not a const: the resource resolves after first render, and a
  // const would snapshot `undefined` and never move. The memo re-derives when
  // the list lands, and the early return below still narrows it.
  const found = createMemo(() =>
    components()?.find((c) => c.name === params.name)
  );
  // Typed by hand because the studio's tsconfig has no `paths` for the
  // workspace packages, so the RPC client's types do not resolve under tsc —
  // the values are right at runtime, and a cast states the shape the daemon
  // sends. The real fix is a `paths` entry, not this cast.
  // The contract names the variables a component reads; the live theme
  // says which token path each one is, so the readout is editable identity
  // rather than emitted output.
  const tokenEntries = () => {
    const tree = analyzeTheme(themeText()).tree;
    if (tree === undefined) return [];
    const byVar = tokenPathsByVar(tree);
    const vars = Object.values(tokens()?.reads ?? {}).flat() as string[];
    const paths = vars
      .map((variable) => byVar.get(variable))
      .filter((path): path is string => path !== undefined);
    return [...new Set(paths)].map((path) => ({ path }));
  };
  const rows = () => found()?.examples?.rows ?? [];

  return (
    <div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
      <Show
        when={found()}
        keyed
        fallback={
          <Show
            when={components() !== undefined}
            fallback={
              <div>
                <h1 class="text-2xl capitalize">{params.name}</h1>
                <p class="text-sm text-text-muted">Loading…</p>
              </div>
            }
          >
            <p>
              No component named <code>{params.name}</code>.
            </p>
          </Show>
        }
      >
        {(component) => (
          <div>
            <h1 class="text-2xl capitalize">{component.name}</h1>
            <p class="text-sm text-text-muted">
              {component.examples?.note ?? ""}
            </p>

            <Show when={component.tags.length > 0}>
              <h2 class="mt-6 text-xl">Tags</h2>
              <p class="font-mono text-sm">
                {component.tags.map((t: string) => `<${t}>`).join("  ")}
              </p>
            </Show>

            <h2 class="mt-6 text-xl">Examples</h2>
            <Show
              when={rows().length > 0}
              fallback={<p class="text-sm">This component has no examples.</p>}
            >
              <For each={[...rows()]}>
                {(row) => (
                  <section class="mt-4 border-t border-border pt-3">
                    <h3 class="text-sm font-medium">{row.name}</h3>
                    <div
                      class="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-3"
                      innerHTML={row.html}
                    />
                  </section>
                )}
              </For>
            </Show>

            {
              /* Tokens this component reads, as paths. A path is the thing
                 the editor can edit and a `--variable` is not, so each entry
                 links to the editor that owns it. */
            }
            <Show when={tokenEntries().length > 0}>
              <h2 class="mt-6 text-xl">Tokens this reads</h2>
              <ul class="mt-2 flex flex-wrap gap-2">
                <For each={tokenEntries()}>
                  {({ path }) => (
                    <li>
                      <A
                        href={editorRouteFor(path)}
                        class="text-xs hover:underline"
                      >
                        <code>{path}</code>
                      </A>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
