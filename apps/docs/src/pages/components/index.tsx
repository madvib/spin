/**
 * The components gallery — the elements themselves, live, as the imagery.
 *
 * Each card is a stage holding the primitive's own first example, painted
 * by whatever theme the rail has set. Contract details live on the page
 * behind the card; the gallery earns its place by showing, not telling.
 */
import { For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { type PrimitiveContract, primitiveContracts } from "@spin/preset";
import { examplesFor } from "@spin/preset/rules/primitives/examples-index.ts";
import { A } from "@solidjs/router";

const componentIds: readonly string[] = Object.keys(primitiveContracts)
  .filter((id) => id !== "a11y") // a11y is a utility family, not a primitive
  .sort();

export default function ComponentsIndex(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-xl px-4 py-10 md:py-16">
      <h1 class="text-2xl tracking-tight">Components</h1>
      <p class="text-text-muted max-w-screen-md mt-1">
        Every element spin paints — live, in the theme the rail has set. Open
        one to copy the markup, see the classes it answers to, and check what it
        reads from the theme.
      </p>
      <div class="mt-6 grid gap-4 md:grid-cols-3">
        <For each={componentIds}>
          {(id) => {
            const contract: PrimitiveContract = primitiveContracts[id];
            const examples = examplesFor(id);
            return (
              <A
                href={`/components/${id}`}
                class="block border border-border bg-surface-raised rounded-md overflow-hidden no-underline hover:border-border-strong transition-colors duration-fast"
              >
                <Show
                  when={examples}
                  fallback={
                    <div class="flex h-20 items-center justify-center border-b border-border bg-surface px-4">
                      <span class="text-xs text-text-muted">
                        utility family
                      </span>
                    </div>
                  }
                >
                  <div class="flex h-20 items-center justify-center overflow-hidden border-b border-border bg-surface px-4">
                    <div innerHTML={examples!.rows[0].html} />
                  </div>
                </Show>
                <div class="flex items-baseline justify-between gap-2 px-4 py-3">
                  <span class="font-heading text-lg tracking-tight text-text">
                    {id}
                  </span>
                  <span class="shrink-0 text-xs text-text-muted">
                    {contract.variants.length > 0
                      ? `${contract.variants.length} ${
                        contract.variants.length === 1 ? "variant" : "variants"
                      }`
                      : "no classes"}
                  </span>
                </div>
              </A>
            );
          }}
        </For>
      </div>
    </main>
  );
}
