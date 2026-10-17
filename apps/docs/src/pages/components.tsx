/**
 * The components pages — generated from two sources of truth and no third:
 * `primitiveContracts` (tags, variants, reads, character) and
 * `componentExamples` (the markup an author actually writes). Nothing on
 * these pages is hand-maintained; when a primitive changes its mind, the
 * page changes with it.
 */
import { createMemo, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { type PrimitiveContract, primitiveContracts } from "@spin/preset";
import { examplesFor } from "@spin/preset/rules/primitives/examples-index.ts";
import { Link } from "../shell.tsx";
import { Chip, Section } from "./bits.tsx";
import { ExampleRow } from "../example-row.tsx";

const componentIds: readonly string[] = Object.keys(primitiveContracts)
  .filter((id) => id !== "a11y") // a11y is a utility family, not a primitive
  .sort();

export function ComponentsIndex(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-14">
      <h1 class="text-2xl tracking-tight">Components</h1>
      <p class="text-text-muted max-w-prose mt-1">
        Every element the primitives paint, with its contract: the tags it
        claims, the variants it answers to, and the threads it spends. Count
        {" "}
        <strong class="text-text">{componentIds.length}</strong>{" "}
        — open one and the markup on the page is the primitives' own example
        data, rendered live, all of it wearing{" "}
        <strong class="text-text">whatever deck this page wears</strong>.
      </p>
      <div class="mt-6 grid gap-3 sm:grid-cols-2">
        <For each={componentIds}>
          {(id) => {
            const contract: PrimitiveContract = primitiveContracts[id];
            const examples = examplesFor(id);
            return (
              <Link
                href={`/components/${id}`}
                class="block border border-border bg-surface-raised rounded-md p-4 hover:border-border-strong transition-colors duration-150"
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
                <p class="m-0 mt-1.5 text-sm text-text-muted">
                  {examples?.note ??
                    "A utility family — see the page for what it provides."}
                </p>
              </Link>
            );
          }}
        </For>
      </div>
    </main>
  );
}

export function ComponentPage(props: { id: string }): JSX.Element {
  const contract = createMemo(() => primitiveContracts[props.id]);
  const examples = createMemo(() => examplesFor(props.id));
  const known = createMemo(() => !!contract());
  return (
    <Show when={known()} fallback={<NotFound id={props.id} />}>
      <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-14">
        <p class="text-sm">
          <Link href="/components" class="text-text-muted hover:text-text">
            ← components
          </Link>
        </p>
        <h1 class="mt-1 text-2xl tracking-tight">{props.id}</h1>
        <Show when={examples()}>
          {(ex) => <p class="text-text-muted max-w-prose mt-1">{ex().note}</p>}
        </Show>

        <div class="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <p class="m-0 text-xs font-semibold uppercase tracking-widest text-text-muted">
              tags
            </p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <For each={contract()!.tags}>
                {(tag) => <Chip>{tag}</Chip>}
              </For>
              <Show when={contract()!.tags.length === 0}>
                <span class="text-sm text-text-muted">
                  none — a utility family
                </span>
              </Show>
            </div>
          </div>
          <div>
            <p class="m-0 text-xs font-semibold uppercase tracking-widest text-text-muted">
              variants
            </p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <For each={contract()!.variants}>
                {(variant) => <Chip>{variant}</Chip>}
              </For>
              <Show when={contract()!.variants.length === 0}>
                <span class="text-sm text-text-muted">none</span>
              </Show>
            </div>
          </div>
        </div>

        <div class="mt-8">
          <For each={examples()?.rows}>
            {(row) => (
              <ExampleRow
                name={row.name}
                html={row.html}
                onLoad={examples()?.onLoad}
              />
            )}
          </For>
        </div>

        <Section title="What it spends">
          <p>
            These are the threads this element reads from the deck — the names
            are the custom properties, the tokens are resolved by whatever{" "}
            <code class="font-mono">data-theme</code>{" "}
            scope the element sits in. The live specimens above are already
            spending them: switch the header deck to watch them re-resolve.
          </p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <For each={contract()!.reads}>
              {(read) => <Chip>{read}</Chip>}
            </For>
          </div>
        </Section>

        <Show when={contract()!.character.length > 0}>
          <Section title="Character — what the theme decides">
            <p>
              Character tokens are the decisions this element hands to the
              theme: a scaffold fills each one with the placeholder below, and a
              starter answers every one with a real opinion.
            </p>
            <div class="mt-4 overflow-x-auto">
              <table class="w-full border-collapse text-sm">
                <thead>
                  <tr class="border-b border-border text-left">
                    <th class="py-2 pr-4 font-semibold text-text">token</th>
                    <th class="py-2 pr-4 font-mono text-xs">type</th>
                    <th class="py-2 pr-4 font-mono text-xs">
                      scaffold placeholder
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={contract()!.character}>
                    {(token) => (
                      <tr class="border-b border-border">
                        <td class="py-1.5 pr-4 font-mono text-xs">
                          {token.path}
                        </td>
                        <td class="py-1.5 pr-4 font-mono text-xs text-text-muted">
                          {token.type}
                        </td>
                        <td class="py-1.5 pr-4 font-mono text-xs">
                          {token.value}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Section>
        </Show>
      </main>
    </Show>
  );
}

function NotFound(props: { id: string }): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-md px-4 py-24 text-center">
      <p class="text-text-muted">
        No primitive is named <code class="font-mono">{props.id}</code>.{" "}
        <Link href="/components" class="text-primary underline">
          See the index.
        </Link>
      </p>
    </main>
  );
}
