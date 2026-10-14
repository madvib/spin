/**
 * The specimen wall — every primitive the preset ships, rendered in the
 * theme being edited.
 *
 * Three things this page owes a theme author:
 *
 *   **The whole vocabulary, not the authored subset.** A component whose
 *   examples nobody has written still has tags and variants, and those still
 *   carry the rule — so its rows are generated from them. A page that filters
 *   on "has examples" loses components nobody knew were missing: `<hr>` was in
 *   that state, filed under the wrong key, for the whole of its life.
 *
 *   **What each component spends.** The manifest already records the custom
 *   properties a component reads, so the group states them beside the rows.
 *   Judging a theme edit needs to know what it moved.
 *
 *   **The variants, named.** A variant is part of the vocabulary, and a wall
 *   that shows only the base teaches the base alone.
 */

import { createEffect, createMemo, For, Match, Show, Switch } from "solid-js";
import { library, registerMarkup } from "../lib/store.ts";

interface Row {
  readonly name: string;
  html: string;
}

/** What a component contributes to the wall. */
interface Group {
  readonly name: string;
  readonly note: string;
  readonly tags: readonly string[];
  readonly variants: readonly string[];
  readonly reads: readonly string[];
  readonly rows: readonly Row[];
}

/**
 * A row for a tag nobody has written an example for.
 *
 * The tag is shown applied to itself, which renders the component's base
 * rule and nothing else — the honest minimum. An authored example always
 * wins; this is the floor, not a substitute.
 */
function generatedRows(tags: readonly string[]): readonly Row[] {
  return tags.map((tag) => ({
    name: tag,
    html: `<${tag} aria-label="${tag}">${tag}</${tag}>`,
  }));
}

/** A component's examples, as one group on the page. */
function SpecimenGroup(props: Group) {
  return (
    <section class="border-border rounded-lg border bg-surface-raised p-4">
      <div class="split">
        <h2 class="text-lg capitalize">{props.name.replace(/-/g, " ")}</h2>
        <div class="flex flex-wrap justify-end gap-1">
          <For each={[...props.reads]}>
            {(token) => <code class="text-text-muted text-xs">{token}</code>}
          </For>
        </div>
      </div>
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
      <Show
        when={props.variants.length > 0}
        fallback={
          <p class="text-text-muted mt-4 text-sm">
            Tags: {[...props.tags].join(", ")}
          </p>
        }
      >
        <p class="text-text-muted mt-4 text-sm">
          Variants: {[...props.variants].join(", ")}
        </p>
      </Show>
    </section>
  );
}

export default function SpecimenPage() {
  // Every component the preset ships, authored rows where they exist and
  // generated rows where they do not. A memo, not a plain call: the registry
  // arrives after first render, and a const would snapshot `undefined` and
  // show "loading" forever.
  const groups = createMemo<readonly Group[]>(() =>
    (library() ?? []).map((component) => ({
      name: component.name,
      note: component.examples?.note ?? "",
      tags: component.tags,
      variants: component.variants,
      reads: component.reads,
      rows: component.examples !== undefined
        ? component.examples.rows.map((row) => ({
          name: row.name,
          html: row.html,
        }))
        : generatedRows(component.tags),
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
              {(group) => <SpecimenGroup {...group} />}
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
