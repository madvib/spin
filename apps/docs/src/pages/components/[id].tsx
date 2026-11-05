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
  type ClassDoc,
} from "@spinjs/preset";
import { exampleSources } from "@spinjs/components/examples";
import "@spinjs/components/examples";
import * as library from "@spinjs/components";
import { A, Navigate, useParams } from "@solidjs/router";
import { EXAMPLE_ONLOAD, Specimen } from "@spinjs/kit";
import { COMPONENT_ALIASES, COMPONENT_GROUPS } from "../../nav.ts";
import { Chip, Code, Section } from "../../ui/index.ts";
import { ExampleRow } from "../../example-row.tsx";

/** A machine or controller export, read off the library namespace. */
interface ComponentHandle {
  readonly fields?: readonly string[];
  readonly events?: Readonly<Record<string, { readonly on: string }>>;
  readonly manifest?: {
    readonly parts: readonly string[];
    readonly slots: readonly string[];
    readonly readers: readonly string[];
    readonly methods: readonly string[];
    readonly commands: readonly string[];
    readonly events: readonly string[];
  };
}

/** The library's export name for a kebab-case machine id. */
function exportOf(name: string): string {
  if (name === "tags-input") return "tags";
  if (name === "cascade-select") return "cascade";
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** The live contract handle for a machine id, if the library exports it. */
function handleOf(name: string): ComponentHandle | undefined {
  const handle = (library as unknown as Record<string, unknown>)[exportOf(name)];
  if (handle === undefined || handle === null) return undefined;
  if (typeof handle !== "function" && typeof handle !== "object") return undefined;
  return handle as ComponentHandle;
}

/** Whether the handle is a platform controller rather than a machine. */
function isController(name: string): boolean {
  const manifest = (library as unknown as Record<string, unknown>)[`${exportOf(name)}Manifest`];
  return manifest !== undefined;
}

/** Every component id in rail order, for the prev/next footer. */
const RAIL_ORDER: readonly string[] = COMPONENT_GROUPS.flatMap((group) =>
  group.items.map((item) =>
    item.href.includes("/machine-") ? `machine-${item.name}` : item.name
  )
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
  const alias = createMemo(() => COMPONENT_ALIASES[params.id]);
  let classesDialog: HTMLDialogElement | undefined;
  const page = (
    <Show when={known()} fallback={<NotFound id={params.id} />}>
      <Show
        when={machineId() === null}
        fallback={<MachineDetail name={machineId() ?? ""} />}
      >
        <main class="px-6 py-6">
          <Show when={category()}>
            <p class="uppercase tracking-wider text-text-muted">{category()}</p>
          </Show>
          <h1>{params.id}</h1>
          <Show when={examples()}>
            {(ex) => <p class="max-w-prose text-text-muted">{ex().note}</p>}
          </Show>

          <div class="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p class="uppercase tracking-widest text-text-muted">
                tags
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <For each={contract()!.tags}>
                  {(tag) => <Chip>{tag}</Chip>}
                </For>
                <Show when={contract()!.tags.length === 0}>
                  <span class="type-body text-text-muted">
                    none — a utility family
                  </span>
                </Show>
              </div>
            </div>
            <div>
              <p class="uppercase tracking-widest text-text-muted">
                variants
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <For each={contract()!.variants}>
                  {(variant) => <Chip>{variant}</Chip>}
                </For>
                <Show when={contract()!.variants.length === 0}>
                  <span class="type-body text-text-muted">none</span>
                </Show>
              </div>
            </div>
            <Show when={(examples()?.classes ?? []).length > 0}>
              <div class="flex items-end">
                <button
                  type="button"
                  class="secondary s-sm"
                  onClick={() => classesDialog?.showModal()}
                >
                  Classes & tags ({(examples()?.classes ?? []).length})
                </button>
              </div>
            </Show>
          </div>

          <Show when={(examples()?.classes ?? []).length > 0}>
            <dialog
              ref={classesDialog}
              class="w-full max-w-screen-lg"
              aria-label={`${params.id} classes and tags`}
              onClick={(e: MouseEvent) => {
                if (e.target === e.currentTarget) classesDialog?.close();
              }}
            >
              <header>
                <h2>{params.id} — classes & tags</h2>
                <button
                  type="button"
                  class="bare"
                  aria-label="Close"
                  onClick={() => classesDialog?.close()}
                >
                  <span class="i-lucide-x icon-sm" aria-hidden="true" />
                </button>
              </header>
              <div class="overflow-x-auto">
                <ClassTable classes={examples()?.classes ?? []} />
              </div>
            </dialog>
          </Show>

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
                <table class="w-full border-collapse wrap">
                  <thead>
                    <tr class="border-b border-border text-left">
                      <th class="py-2 pr-4">element</th>
                      <th class="py-2 pr-4">where</th>
                      <th class="py-2 pr-4">owns</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={contract()!.scope.paints}>
                      {(paint) => (
                        <tr class="border-b border-border">
                          <td class="type-code">
                            {paint.tag}
                          </td>
                          <td class="type-code text-text-muted">
                            {paint.where}
                          </td>
                          <td class="type-code">
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

          <Show when={contract()!.component.length > 0}>
            <Section title="Component tokens — what the theme decides">
              <div class="mt-4 overflow-x-auto">
                <table class="w-full border-collapse wrap">
                  <thead>
                    <tr class="border-b border-border text-left">
                      <th class="py-2 pr-4">token</th>
                      <th class="py-2 pr-4">type</th>
                      <th class="py-2 pr-4">scaffold placeholder</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={contract()!.component}>
                      {(token) => (
                        <tr class="border-b border-border">
                          <td class="type-code">
                            {token.path}
                          </td>
                          <td class="type-code text-text-muted">
                            {token.type}
                          </td>
                          <td class="type-code">
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

          <hr />
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
                  class="text-text-muted no-underline"
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
                  class="text-text-muted no-underline"
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

  return (
    <Show when={alias()} fallback={page}>
      {(target) => <Navigate href={`/components/${target()}`} />}
    </Show>
  );
}
function ClassTable(props: { classes: readonly ClassDoc[] }): JSX.Element {
  return (
    <table class="w-fit max-w-full border-collapse text-left wrap">
      <thead>
        <tr class="border-b border-border bg-surface-raised text-text-muted">
          <th class="px-3 py-2">Class / Tag</th>
          <th class="px-3 py-2">Type</th>
          <th class="px-3 py-2">Description</th>
        </tr>
      </thead>
      <tbody>
        <For each={props.classes}>
          {(item) => (
            <tr class="border-b border-border last:border-b-0">
              <td class="shrink-0 whitespace-nowrap type-code text-primary">
                <code>{item.name}</code>
              </td>
              <td class="shrink-0 whitespace-nowrap type-code text-text-muted">
                <span class="inline-flex items-center rounded-sm border border-border bg-surface-raised px-2 py-0 type-code">
                  {item.kind}
                </span>
              </td>
              <td class="text-text-muted">
                {item.description}
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}

function MachineDetail(props: { name: string }): JSX.Element {
  const rows = () => exampleSources().get(props.name) ?? [];
  const handle = () => handleOf(props.name);
  const manifest = () => handle()?.manifest;
  const category = () =>
    COMPONENT_GROUPS.find((group) =>
      group.items.some((item) => item.name === props.name)
    )?.label;
  const controller = () => isController(props.name);
  const events = (): readonly (readonly [string, string])[] =>
    Object.entries(handle()?.events ?? {}).map(([dom, contract]) => [dom, contract.on] as const);
  return (
    <main class="px-6 py-6">
      <Show when={category()}>
        <p class="uppercase tracking-wider text-text-muted">{category()}</p>
      </Show>
      <h1>{props.name}</h1>
      <p>
        <Chip>{controller() ? "controller" : "machine"}</Chip>
      </p>
      <Code code={`npx spin component copy ${props.name} basic`} lang="bash" />
      <Show when={(manifest()?.parts ?? []).length > 0}>
        <p>Parts</p>
        <div class="flex flex-wrap gap-2">
          <For each={manifest()?.parts ?? []}>
            {(part) => <Chip>{part}</Chip>}
          </For>
        </div>
      </Show>
      <Show when={(manifest()?.slots ?? []).length > 0}>
        <p>Slots</p>
        <div class="flex flex-wrap gap-2">
          <For each={manifest()?.slots ?? []}>
            {(slot) => <Chip>{slot}</Chip>}
          </For>
        </div>
      </Show>
      <div class="mt-4">
        <For each={rows()}>
          {(row) => (
            <ExampleRow
              name={row.stem}
              html={`<${props.name}-${row.stem} class="flex w-full min-w-0 flex-col items-center"></${props.name}-${row.stem}>`}
              source={row.html}
              onLoad={EXAMPLE_ONLOAD[`${props.name}/${row.stem}`]}
            />
          )}
        </For>
      </div>
      <Show when={handle() !== undefined}>
        <Section title="Component contract">
          <Show when={(handle()?.fields ?? []).length > 0}>
            <h3>Props</h3>
            <div class="flex flex-wrap gap-2">
              <For each={handle()?.fields ?? []}>
                {(field) => <Chip>{field}</Chip>}
              </For>
            </div>
          </Show>
          <Show when={events().length > 0}>
            <h3>Events</h3>
            <table class="wrap">
              <thead>
                <tr>
                  <th>DOM event</th>
                  <th>Callback prop</th>
                </tr>
              </thead>
              <tbody>
                <For each={events()}>
                  {([dom, prop]) => (
                    <tr>
                      <td><code>{dom}</code></td>
                      <td><code>{prop}</code></td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>
          <Show when={(manifest()?.commands ?? []).length > 0}>
            <h3>Commands</h3>
            <div class="flex flex-wrap gap-2">
              <For each={manifest()?.commands ?? []}>
                {(command) => <Chip>ctl.commands.{command}()</Chip>}
              </For>
            </div>
          </Show>
          <Show when={(manifest()?.readers ?? []).length > 0}>
            <h3>State readers</h3>
            <div class="flex flex-wrap gap-2">
              <For each={manifest()?.readers ?? []}>
                {(reader) => <Chip>ctl.state.{reader}</Chip>}
              </For>
            </div>
          </Show>
          <Show when={(manifest()?.methods ?? []).length > 0}>
            <h3>Methods</h3>
            <div class="flex flex-wrap gap-2">
              <For each={manifest()?.methods ?? []}>
                {(method) => <Chip>machine.{method}()</Chip>}
              </For>
            </div>
          </Show>
        </Section>
      </Show>
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
