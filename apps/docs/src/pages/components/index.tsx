/**
 * The components index — generated from the same two sources of truth
 * as each page: `primitiveContracts` (tags, variants, reads) and
 * `componentExamples` (the markup an author actually writes). Nothing
 * here is hand-maintained; when a primitive changes its mind, the page
 * changes with it.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { type PrimitiveContract, primitiveContracts } from "@spin/preset";
import { examplesFor } from "@spin/preset/rules/primitives/examples-index.ts";
import { A } from "@solidjs/router";

const componentIds: readonly string[] = Object.keys(primitiveContracts)
  .filter((id) => id !== "a11y") // a11y is a utility family, not a primitive
  .sort();

export default function ComponentsIndex(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <h1 class="text-2xl tracking-tight">Components</h1>
      <p class="text-text-muted max-w-screen-md mt-1">
        Every element spin paints. Open one to copy live examples, see the
        classes it answers to, and check what it reads from the theme — all
        rendered in whatever theme the rail has set.
      </p>
      <div class="mt-6 grid gap-3 md:grid-cols-2">
        <For each={componentIds}>
          {(id) => {
            const contract: PrimitiveContract = primitiveContracts[id];
            const examples = examplesFor(id);
            return (
              <A
                href={`/components/${id}`}
                class="block border border-border bg-surface-raised rounded-md p-4 hover:border-border-strong transition-colors duration-fast"
              >
                <p class="m-0 flex items-baseline gap-2">
                  <span class="font-heading text-lg tracking-tight">{id}</span>
                  <span class="text-xs text-text-muted">
                    {contract.tags.length} tags · {contract.variants.length}
                    {" "}
                    variants · {contract.reads.length} reads
                    {examples ? ` · ${examples.rows.length} examples` : ""}
                  </span>
                </p>
                <p class="m-0 mt-2 text-sm text-text-muted">
                  {examples?.note ??
                    "A utility family — see the page for what it provides."}
                </p>
              </A>
            );
          }}
        </For>
      </div>
    </main>
  );
}
