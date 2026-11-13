/**
 * components/[id] — one primitive's contract, from the same two sources
 * of truth as the index. The id arrives as a route param.
 *
 * Each example renders as a live `<Specimen>`: the component as a consumer
 * writes it, the markup behind it, and the copy control for the markup.
 */
import { createMemo, createSignal, For, Show } from "solid-js";
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
import { Specimen } from "@spinjs/kit";
import { EXAMPLE_ONLOAD } from "@spinjs/dev/examples";
import { COMPONENT_ALIASES, COMPONENT_GROUPS } from "../../shell/nav.ts";
import { Chip, Section } from "../../ui/index.ts";
import { ExampleRow } from "../../playground/example-row.tsx";

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

/** Every component id in rail order, for the prev/next footer. */
const RAIL_ORDER: readonly string[] = COMPONENT_GROUPS.flatMap((group) =>
  group.items.map((item) =>
    item.href.includes("/machine-") ? `machine-${item.name}` : item.name
  )
);

const ELEMENT_SUMMARIES: Readonly<Record<string, string>> = {
  button: "Actions and form triggers with semantic variants, three sizes, and theme-driven press physics.",
  badge: "Compact status labels and counts in neutral, brand, and semantic tones.",
  card: "Framed content containers with structured header, body, media, and action slots.",
  alert: "Inline callouts for status updates, warnings, and actionable notices.",
  dialog: "Modal and non-modal native <dialog> overlays with focus trapping and backdrop scrim.",
  panel: "Elevated floating surfaces and selectable item lists for menus, popovers, and command palettes.",
  field: "Single-line inputs, textareas, and native selects sharing one height and focus ring.",
  checkbox: "Binary and indeterminate selection boxes styled directly on native <input type=\"checkbox\">.",
  radio: "Mutually exclusive option controls on native <input type=\"radio\">.",
  switch: "Immediate on/off toggle state built on <input type=\"checkbox\" role=\"switch\">.",
  range: "Continuous and stepped numeric sliders on native <input type=\"range\">.",
  progress: "Determinate and indeterminate completion bars on native <progress>.",
  meter: "Capacity and threshold gauges on native <meter>.",
  table: "Data tables with tabular alignment, sticky headers, and optional zebra rows.",
  disclosure: "Collapsible native <details> and <summary> sections with animated disclosure markers.",
  breadcrumbs: "Hierarchical trail navigation using semantic ordered lists.",
  join: " horizontally attached button and input groups with shared borders and outer radii.",
  kbd: "Keyboard shortcut caps styled for inline hints and command menus.",
  avatar: "User and workspace identity thumbnails with image and initials support.",
  stat: "Key metric readouts pairing a headline figure with label and trend context.",
  skeleton: "Loading placeholders that pulse smoothly while content resolves.",
  divider: "Horizontal and labeled section rules on native <hr>.",
  label: "Accessible form field captions with automatic inline alignment for checkboxes and radios.",
};

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
  const summary = createMemo(
    () => ELEMENT_SUMMARIES[params.id]?.trim() ?? examples()?.note ?? "",
  );

  const page = (
    <Show when={known()} fallback={<NotFound id={params.id} />}>
      <Show
        when={machineId() === null}
        fallback={<MachineDetail name={machineId() ?? ""} prev={prev()} next={next()} />}
      >
        <main class="mx-auto w-full max-w-screen-lg px-6 py-8">
          <span class="block type-overline uppercase text-muted">
            {category() ? `${category()} · HTML Element` : "HTML Element"}
          </span>
          <div class="mt-1 flex flex-wrap items-baseline justify-between gap-3">
            <h1>{params.id}</h1>
            <Show when={contract()!.tags.length > 0}>
              <div class="flex flex-wrap items-center gap-2">
                <For each={contract()!.tags}>
                  {(tag) => <code>&lt;{tag}&gt;</code>}
                </For>
              </div>
            </Show>
          </div>
          <Show when={summary() !== ""}>
            <p class="max-w-prose text-muted">{summary()}</p>
          </Show>

          <div class="mt-6">
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

          <Show when={(examples()?.classes ?? []).length > 0}>
            <Section title="Classes & elements">
              <div class="mt-3 overflow-x-auto rounded-lg border bg-surface">
                <ClassTable classes={examples()?.classes ?? []} />
              </div>
            </Section>
          </Show>

          <Show when={contract()!.component.length > 0}>
            <Section title="Theme tokens">
              <div class="mt-3 overflow-x-auto rounded-lg border bg-surface">
                <table class="w-full border-collapse text-left wrap">
                  <thead>
                    <tr class="border-b bg-surface-raised text-muted">
                      <th class="px-3 py-2">Token</th>
                      <th class="px-3 py-2">Type</th>
                      <th class="px-3 py-2">Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={contract()!.component}>
                      {(token) => (
                        <tr class="border-b last:border-b-0">
                          <td class="type-code text-primary">
                            <code>{token.path}</code>
                          </td>
                          <td class="type-code text-muted">
                            {token.type}
                          </td>
                          <td class="type-code text-muted">
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

          <PrevNextNav prev={prev()} next={next()} />
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

function PrevNextNav(props: { prev?: string; next?: string }): JSX.Element {
  const labelOf = (id: string): string =>
    id.startsWith("machine-") ? id.slice("machine-".length) : id;
  return (
    <nav
      class="mt-10 flex items-center justify-between gap-4 border-t pt-6"
      aria-label="more components"
    >
      <Show when={props.prev} fallback={<span />}>
        {(name) => (
          <A href={`/components/${name()}`} class="text-muted no-underline hover:text-primary">
            ← {labelOf(name())}
          </A>
        )}
      </Show>
      <Show when={props.next} fallback={<span />}>
        {(name) => (
          <A href={`/components/${name()}`} class="text-muted no-underline hover:text-primary">
            {labelOf(name())} →
          </A>
        )}
      </Show>
    </nav>
  );
}
function ClassTable(props: { classes: readonly ClassDoc[] }): JSX.Element {
  return (
    <table class="w-full border-collapse text-left wrap">
      <thead>
        <tr class="border-b bg-surface-raised text-muted">
          <th class="px-3 py-2">Class / Tag</th>
          <th class="px-3 py-2">Type</th>
          <th class="px-3 py-2">Description</th>
        </tr>
      </thead>
      <tbody>
        <For each={props.classes}>
          {(item) => (
            <tr class="border-b last:border-b-0">
              <td class="shrink-0 whitespace-nowrap type-code text-primary">
                <code>{item.name}</code>
              </td>
              <td class="shrink-0 whitespace-nowrap type-code text-muted">
                <span class="inline-flex items-center rounded-sm border bg-surface-raised px-2 py-0 type-code">
                  {item.kind}
                </span>
              </td>
              <td class="text-muted">
                {item.description}
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}

function MachineDetail(props: { name: string; prev?: string; next?: string }): JSX.Element {
  const rows = () => exampleSources().get(props.name) ?? [];
  const handle = () => handleOf(props.name);
  const manifest = () => handle()?.manifest;
  const category = () =>
    COMPONENT_GROUPS.find((group) =>
      group.items.some((item) => item.name === props.name)
    )?.label;
  const events = (): readonly (readonly [string, string])[] =>
    Object.entries(handle()?.events ?? {}).map(([dom, contract]) => [dom, contract.on] as const);
  const [copiedCli, setCopiedCli] = createSignal(false);
  const cliCommand = () => `npx spin component copy ${props.name} basic`;
  const copyCli = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(cliCommand());
    }
    setCopiedCli(true);
    window.setTimeout(() => setCopiedCli(false), 1200);
  };

  return (
    <main class="mx-auto min-w-0 w-full max-w-screen-lg px-6 py-8">
      <span class="block type-overline uppercase text-muted">
        {category() ? `${category()} · Interactive UI` : "Interactive UI"}
      </span>
      <div class="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1>{props.name}</h1>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyCli}
            aria-label="Copy CLI scaffold command"
            class="subtle s-xs inline-flex h-8 items-center gap-2 type-code text-muted transition-colors"
          >
            <span class="text-primary">$</span>
            <span>{cliCommand()}</span>
            <span
              class={copiedCli() ? "i-lucide-check icon-sm text-semantic-success" : "i-lucide-copy icon-sm"}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <div class="mt-6">
        <For each={rows()}>
          {(row) => (
            <ExampleRow
              name={row.stem}
              overlay
              html={`<${props.name}-${row.stem} class="flex w-full min-w-0 flex-col items-center"></${props.name}-${row.stem}>`}
              source={row.html}
              onLoad={EXAMPLE_ONLOAD[`${props.name}/${row.stem}`]}
            />
          )}
        </For>
      </div>

      <Show when={handle() !== undefined}>
        <Section title="Props & events">
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
            <div class="overflow-x-auto rounded-lg border bg-surface">
              <table class="w-full border-collapse text-left wrap">
                <thead>
                  <tr class="border-b bg-surface-raised text-muted">
                    <th class="px-3 py-2">DOM event</th>
                    <th class="px-3 py-2">Callback prop</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={events()}>
                    {([dom, prop]) => (
                      <tr class="border-b last:border-b-0">
                        <td class="type-code text-primary"><code>{dom}</code></td>
                        <td class="type-code text-muted"><code>{prop}</code></td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
          <Show when={(manifest()?.parts ?? []).length > 0 || (manifest()?.slots ?? []).length > 0}>
            <h3>Template anatomy</h3>
            <div class="overflow-x-auto rounded-lg border bg-surface">
              <table class="w-full border-collapse text-left wrap">
                <tbody>
                  <Show when={(manifest()?.parts ?? []).length > 0}>
                    <tr class="border-b last:border-b-0">
                      <th>Parts</th>
                      <td class="type-code text-muted">
                        {(manifest()?.parts ?? []).join(", ")}
                      </td>
                    </tr>
                  </Show>
                  <Show when={(manifest()?.slots ?? []).length > 0}>
                    <tr class="border-b last:border-b-0">
                      <th>Slots</th>
                      <td class="type-code text-muted">
                        {(manifest()?.slots ?? []).join(", ")}
                      </td>
                    </tr>
                  </Show>
                </tbody>
              </table>
            </div>
          </Show>
        </Section>
      </Show>

      <PrevNextNav prev={props.prev} next={props.next} />
    </main>
  );
}

function NotFound(props: { id: string }): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-md px-4 py-24 text-center">
      <p class="text-muted">
        No primitive is named <code>{props.id}</code>.{" "}
        <A href="/components" class="text-primary underline">
          See the index.
        </A>
      </p>
    </main>
  );
}
