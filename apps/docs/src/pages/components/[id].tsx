/**
 * components/[id] — one primitive's contract, from the same two sources
 * of truth as the index. The id arrives as a route param.
 */
import { createMemo, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import {
  examplesFor,
  type PrimitiveContract,
  primitiveContracts,
} from "@spin/preset";
import { A, useParams } from "@solidjs/router";
import { Chip, Section } from "../../bits.tsx";
import { ExampleRow } from "../../example-row.tsx";

export default function ComponentPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const contract = createMemo<PrimitiveContract | undefined>(
    () => primitiveContracts[params.id],
  );
  const examples = createMemo(() => examplesFor(params.id));
  const known = createMemo(() => !!contract());
  return (
    <Show when={known()} fallback={<NotFound id={params.id} />}>
      <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
        <p class="text-sm">
          <A href="/components" class="text-text-muted hover:text-text">
            ← components
          </A>
        </p>
        <h1>{params.id}</h1>
        <Show when={examples()}>
          {(ex) => <p class="text-text-muted max-w-screen-md">{ex().note}</p>}
        </Show>

        <div class="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-text-muted">
              tags
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
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
            <p class="text-xs font-semibold uppercase tracking-widest text-text-muted">
              variants
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
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
          <div class="mt-3 flex flex-wrap gap-2">
            <For each={contract()!.reads}>
              {(read) => <Chip>{read}</Chip>}
            </For>
          </div>
        </Section>

        <Show when={contract()!.component.length > 0}>
          <Section title="Component tokens — what the theme decides">
            <div class="mt-4 overflow-x-auto">
              <table class="w-full border-collapse">
                <thead>
                  <tr class="border-b border-border text-left">
                    <th class="py-2 pr-4">token</th>
                    <th class="py-2 pr-4 font-mono">type</th>
                    <th class="py-2 pr-4 font-mono">
                      scaffold placeholder
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={contract()!.component}>
                    {(token) => (
                      <tr class="border-b border-border">
                        <td class="font-mono text-xs">
                          {token.path}
                        </td>
                        <td class="font-mono text-xs text-text-muted">
                          {token.type}
                        </td>
                        <td class="font-mono text-xs">
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
        No primitive is named <code>{props.id}</code>.{" "}
        <A href="/components" class="text-primary underline">
          See the index.
        </A>
      </p>
    </main>
  );
}
