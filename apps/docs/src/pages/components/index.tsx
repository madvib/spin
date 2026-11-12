/**
 * The components gallery — the elements themselves, live, as the imagery.
 *
 * One taxonomy, one list: each purpose group holds its elements and its
 * machines together, and the kind filter narrows the same list instead of
 * printing a second gallery under duplicate headings. The groups are the
 * ones the docs rail, the studio rail, and the reference rail draw.
 */
import { For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { A, useSearchParams } from "@solidjs/router";
import { COMPONENT_ICONS, UNIFIED_COMPONENT_GROUPS } from "@spinjs/components";
import { exampleSources } from "@spinjs/components/examples";
import "@spinjs/components/examples";
import {
  examplesFor,
  primitiveContracts,
  primitiveElements,
} from "@spinjs/preset";

const MACHINE_SOURCES = exampleSources();
const ELEMENT_ICONS = new Map(
  primitiveElements.map((element) => [element.name, element.icon]),
);

type Kind = "primitive" | "machine";

interface Row {
  readonly name: string;
  readonly icon: string;
  readonly href: string;
  readonly mountHtml: string;
  readonly meta: string;
  readonly kind: Kind;
}

interface Group {
  readonly id: string;
  readonly label: string;
  readonly rows: readonly Row[];
}

const GALLERY_VIGNETTES: Readonly<Record<string, string>> = {
  dialog: `<div class="w-full max-w-60 rounded-lg border bg-surface-raised p-3 shadow-md"><div class="type-label">Delete environment?</div><p class="mt-1 type-caption text-muted">Production keys will be revoked immediately.</p><div class="mt-3 flex justify-end gap-2"><button type="button" class="secondary s-sm">Cancel</button><button type="button" class="danger s-sm">Delete</button></div></div>`,
  popover: `<div class="flex flex-col items-center gap-2"><button type="button" class="secondary s-sm">Share</button><div class="w-56 rounded-md border bg-surface-raised p-3 shadow-md"><div class="type-caption-emphasized">Invite link</div><div class="mt-1 rounded-sm border bg-surface px-2 py-1 type-code text-muted">spin.dev/s/9f2a</div></div></div>`,
  tooltip: `<div class="flex flex-col items-center gap-2"><div class="rounded-sm border bg-surface-raised px-2 py-1 type-caption shadow-sm">⌘K · Quick search</div><button type="button" class="secondary s-sm">Search</button></div>`,
  "hover-card": `<div class="w-56 rounded-lg border bg-surface-raised p-3 shadow-md"><div class="flex items-center gap-2"><span class="grid h-7 w-7 place-items-center rounded-full bg-primary type-caption-emphasized text-on-primary">AC</span><div><div class="type-label">@ada</div><div class="type-caption text-muted">Maintainer · 42 commits</div></div></div></div>`,
  menu: `<div class="w-40 rounded-md border bg-surface-raised p-1 shadow-md"><div class="flex items-center justify-between rounded-sm bg-surface px-2 py-1 type-caption"><span>Duplicate</span><span class="text-muted">⌘D</span></div><div class="flex items-center justify-between px-2 py-1 type-caption"><span>Rename</span><span class="text-muted">⏎</span></div><div class="mt-1 border-t pt-1 px-2 py-1 type-caption text-semantic-error">Archive</div></div>`,
  "context-menu": `<div class="w-40 rounded-md border bg-surface-raised p-1 shadow-md"><div class="flex items-center justify-between rounded-sm bg-surface px-2 py-1 type-caption"><span>Inspect token</span><span class="text-muted">⌥I</span></div><div class="flex items-center justify-between px-2 py-1 type-caption"><span>Copy class</span><span class="text-muted">⌘C</span></div></div>`,
  toast: `<div class="flex w-60 items-center justify-between gap-2 rounded-md border bg-surface-raised px-3 py-2 shadow-md"><div class="flex items-center gap-2"><span class="i-lucide-check icon-sm text-semantic-success"></span><span class="type-caption-emphasized">Theme published</span></div><span class="type-caption text-muted">Undo</span></div>`,
  "floating-panel": `<div class="w-56 overflow-hidden rounded-lg border bg-surface-raised shadow-md"><div class="flex items-center justify-between border-b px-3 py-2"><span class="type-caption-emphasized">Inspector</span><span class="i-lucide-x icon-sm text-muted"></span></div><div class="p-3 type-caption text-muted">Draggable, resizable workspace tool window.</div></div>`,
  breadcrumbs: `<nav aria-label="Breadcrumb"><ol class="breadcrumbs"><li><a href="#actions">Workspace</a></li><li><a href="#actions">Billing</a></li><li aria-current="page">Invoices</li></ol></nav>`,
  table: `<table class="w-full type-caption"><thead><tr><th>Service</th><th>Status</th></tr></thead><tbody><tr><td>api-edge</td><td><badge variant="primary">Healthy</badge></td></tr><tr><td>worker</td><td>24ms</td></tr></tbody></table>`,
  pagination: `<div class="inline-flex items-center gap-1"><button type="button" class="ghost icon s-sm"><span class="i-lucide-chevron-left icon-sm"></span></button><button type="button" class="primary s-sm">1</button><button type="button" class="secondary s-sm">2</button><button type="button" class="secondary s-sm">3</button><button type="button" class="ghost icon s-sm"><span class="i-lucide-chevron-right icon-sm"></span></button></div>`,
};

const GROUPS: readonly Group[] = UNIFIED_COMPONENT_GROUPS.map((group) => ({
  id: group.id,
  label: group.label,
  rows: group.members.flatMap((member): Row[] => {
    if (member.startsWith("component-")) {
      const name = member.slice("component-".length);
      const stems = MACHINE_SOURCES.get(name);
      if (stems === undefined) return [];
      const first = stems[0]?.stem ?? "basic";
      return [{
        name,
        icon: COMPONENT_ICONS[name] ?? "i-lucide-box",
        href: `/components/machine-${name}`,
        mountHtml: GALLERY_VIGNETTES[name] ?? `<${name}-${first}></${name}-${first}>`,
        meta: "Stateful UI",
        kind: "machine",
      }];
    }
    const contract = primitiveContracts[member];
    if (contract === undefined) return [];
    const example = examplesFor(member);
    const firstTag = contract.tags[0];
    return [{
      name: member,
      icon: ELEMENT_ICONS.get(member) ?? COMPONENT_ICONS[member] ?? "i-lucide-box",
      href: `/components/${member}`,
      mountHtml: GALLERY_VIGNETTES[member] ?? example?.rows[0]?.html ?? "",
      meta: firstTag !== undefined ? `<${firstTag}>` : "HTML",
      kind: "primitive",
    }];
  }),
})).filter((group) => group.rows.length > 0);

const KINDS: readonly { readonly id: "all" | Kind; readonly label: string; readonly note: string; readonly href: string }[] = [
  { id: "all", label: "All", note: "Native HTML elements & stateful UI components", href: "/components" },
  { id: "primitive", label: "HTML Elements", note: "Styled native HTML tags — CSS only, zero JS (@spinjs/dev)", href: "/components?kind=primitives" },
  { id: "machine", label: "Interactive UI", note: "Accessible stateful components — copyable markup + statecharts (@spinjs/components)", href: "/components?kind=machines" },
];

/** The groups the current filter keeps, in the taxonomy's order. */
function groupsFor(kind: "all" | Kind): readonly Group[] {
  if (kind === "all") return GROUPS;
  return GROUPS.map((group) => ({
    ...group,
    rows: group.rows.filter((row) => row.kind === kind),
  })).filter((group) => group.rows.length > 0);
}

function GroupNav(props: { groups: readonly Group[] }): JSX.Element {
  return (
    <nav
      class="mt-6 flex flex-wrap gap-x-4 gap-y-1 type-body"
      aria-label="component groups"
    >
      <For each={props.groups}>
        {(group) => (
          <a href={`#${group.id}`}>
            {group.label}
          </a>
        )}
      </For>
    </nav>
  );
}

export default function ComponentsIndex(): JSX.Element {
  const [params] = useSearchParams();
  const kind = (): "all" | Kind => {
    const value = params["kind"];
    return value === "primitives" ? "primitive" : value === "machines" ? "machine" : "all";
  };
  const groups = () => groupsFor(kind());
  const countOf = (id: "all" | Kind): number =>
    GROUPS.reduce(
      (total, group) =>
        total +
        group.rows.filter((row) => id === "all" || row.kind === id).length,
      0,
    );

  return (
    <main class="mx-auto w-full max-w-screen-lg px-6 py-10">
      <h1>Components</h1>
      <p class="max-w-prose text-muted">
        Native HTML elements and interactive UI components, rendered live in the
        active design language. Select any card for live variations, copyable
        markup, and styling tokens.
      </p>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <nav
          class="inline-flex flex-wrap items-center gap-1 rounded-lg border bg-surface-raised p-1"
          aria-label="component kind"
        >
          <For each={KINDS}>
            {(entry) => (
              <A
                href={entry.href}
                class={`inline-flex h-7 items-center gap-2 rounded-md px-3 no-underline transition-colors duration-fast ${
                  kind() === entry.id
                    ? "bg-primary text-on-primary type-caption-emphasized"
                    : "text-muted hover:bg-surface type-caption"
                }`}
              >
                <span>{entry.label}</span>
                <span class="opacity-75">{countOf(entry.id)}</span>
              </A>
            )}
          </For>
        </nav>
        <span class="type-caption text-muted">
          {KINDS.find((entry) => entry.id === kind())?.note}
        </span>
      </div>
      <GroupNav groups={groups()} />

      <For each={groups()}>
        {(group) => (
          <section class="mt-10 scroll-mt-20" id={group.id}>
            <h2>{group.label}</h2>
            <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <For each={group.rows}>
                {(row) => (
                  <A
                    href={row.href}
                    class="group flex h-full flex-col overflow-hidden rounded-lg border bg-surface-raised no-underline shadow-sm transition-colors duration-fast hover:border-strong"
                  >
                    <div
                      ref={(el) => {
                        el.inert = true;
                      }}
                      class="pointer-events-none flex min-h-36 flex-1 select-none items-center justify-center overflow-hidden border-b bg-surface p-4"
                    >
                      <Show
                        when={row.mountHtml !== ""}
                        fallback={
                          <span class="type-caption text-muted">
                            Typography & layout utility
                          </span>
                        }
                      >
                        <div
                          class="flex w-full min-w-0 max-w-full items-center justify-center overflow-hidden"
                          innerHTML={row.mountHtml}
                        />
                      </Show>
                    </div>
                    <div class="flex items-center justify-between gap-2 px-4 py-3">
                      <span class="flex min-w-0 items-center gap-2 type-label">
                        <i
                          class={`${row.icon} icon-sm shrink-0 text-muted group-hover:text-primary`}
                          aria-hidden="true"
                        />
                        <span class="truncate">{row.name}</span>
                      </span>
                      <span class="shrink-0 rounded-sm border bg-surface px-2 py-0 type-code text-muted">
                        {row.meta}
                      </span>
                    </div>
                  </A>
                )}
              </For>
            </div>
          </section>
        )}
      </For>
    </main>
  );
}
