/**
 * components/[id] — one primitive's contract, from the same two sources
 * of truth as the index. The id arrives as a route param.
 *
 * Each example renders as a live `<Specimen>`: the component as a consumer
 * writes it, the markup behind it, and the copy control for the markup.
 */
import { createMemo, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import {
  examplesFor,
  type PrimitiveContract,
  primitiveContracts,
} from "@spin/preset";
import { A, useParams } from "@solidjs/router";
import { EXAMPLE_ONLOAD, Specimen } from "@spin/kit";
import { COMPONENT_GROUPS } from "../../nav.ts";
import { Chip, Section } from "../../bits.tsx";
import { ExampleRow } from "../../example-row.tsx";

/** The component ids in rail order, for the prev/next footer. */
const RAIL_ORDER: readonly string[] = COMPONENT_GROUPS.flatMap((group) =>
  group.items.map((item) => item.name)
);

export default function ComponentPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const contract = createMemo<PrimitiveContract | undefined>(
    () => primitiveContracts[params.id],
  );
  const machineId = createMemo(() =>
    params.id.startsWith("machine-") ? params.id.slice("machine-".length) : null
  );
  const examples = createMemo(() => examplesFor(params.id));
  const known = createMemo(() => !!contract() || machineId() !== null);
  const position = createMemo(() => RAIL_ORDER.indexOf(params.id));
  const prev = createMemo(() =>
    position() > 0 ? RAIL_ORDER[position() - 1] : undefined
  );
  const next = createMemo(() =>
    position() >= 0 && position() < RAIL_ORDER.length - 1
      ? RAIL_ORDER[position() + 1]
      : undefined
  );
  const category = createMemo(() =>
    COMPONENT_GROUPS.find((group) =>
      group.items.some((item) => item.name === params.id)
    )?.label
  );
  return (
    <Show when={known()} fallback={<NotFound id={params.id} />}>
      <Show
        when={machineId() === null}
        fallback={<MachineDetail name={machineId() ?? ""} />}
      >
        <main class="mx-auto max-w-screen-lg px-6 py-10 md:py-16">
          <Show when={category()}>
            <p class="overline text-text-muted">{category()}</p>
          </Show>
          <h1>{params.id}</h1>
          <Show when={examples()}>
            {(ex) => <p class="max-w-screen-md text-text-muted">{ex().note}</p>}
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
                <Specimen
                  name={row.name}
                  html={row.html}
                  onLoad={examples()?.onLoad}
                />
              )}
            </For>
          </div>

          <Show when={(contract()!.scope?.paints ?? []).length > 0}>
            <Section title="What it owns">
              <div class="mt-4 overflow-x-auto">
                <table class="w-full border-collapse">
                  <thead>
                    <tr class="border-b border-border text-left">
                      <th class="py-2 pr-4">element</th>
                      <th class="py-2 pr-4 font-mono">where</th>
                      <th class="py-2 pr-4 font-mono">owns</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={contract()!.scope.paints}>
                      {(paint) => (
                        <tr class="border-b border-border">
                          <td class="font-mono text-xs">
                            {paint.tag}
                          </td>
                          <td class="font-mono text-xs text-text-muted">
                            {paint.where}
                          </td>
                          <td class="font-mono text-xs">
                            {paint.owns.join(" · ")}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Section>
          </Show>

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

          <hr class="mt-16" />
          <nav
            class="flex items-center justify-between gap-4 pt-6"
            aria-label="more components"
          >
            <Show
              when={prev()}
              fallback={<span />}
            >
              {(name) => (
                <A
                  href={`/components/${name()}`}
                  class="text-text-muted no-underline hover:text-text"
                >
                  ← {name()}
                </A>
              )}
            </Show>
            <Show
              when={next()}
              fallback={<span />}
            >
              {(name) => (
                <A
                  href={`/components/${name()}`}
                  class="text-text-muted no-underline hover:text-text"
                >
                  {name()} →
                </A>
              )}
            </Show>
          </nav>
        </main>
      </Show>
    </Show>
  );
}
function MachineDetail(props: { name: string }): JSX.Element {
  const sources = import.meta.glob(
    "../../../../../packages/components/src/*/examples/*.html",
    { query: "?raw", import: "default", eager: true },
  ) as Record<string, string>;
  const rows = () =>
    Object.entries(sources)
      .filter(([path]) => path.split("/").at(-3) === props.name)
      .map(([path, html]) => ({
        name: path.split("/").at(-1)?.slice(0, -".html".length) ?? path,
        html,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <p class="text-sm">
        <A href="/components" class="text-text-muted hover:text-text">
          ← components
        </A>
      </p>
      <h1>{props.name}</h1>
      <p class="text-text-muted max-w-screen-md">
        Interactive machine component. Requires the runtime (@spin/runtime):
        markup drives a statechart.
      </p>
      <div class="mt-8">
        <For each={rows()}>
          {(row) => (
            <ExampleRow
              name={row.name}
              html={`<${props.name}-${row.name}></${props.name}-${row.name}>`}
              onLoad={EXAMPLE_ONLOAD[`${props.name}/${row.name}`]}
            />
          )}
        </For>
      </div>
    </main>
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
