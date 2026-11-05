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

type Kind = "element" | "machine";

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
        mountHtml: `<${name}-${first}></${name}-${first}>`,
        meta: "state machine",
        kind: "machine",
      }];
    }
    const contract = primitiveContracts[member];
    if (contract === undefined) return [];
    const example = examplesFor(member);
    const variants = contract.variants.length;
    return [{
      name: member,
      icon: ELEMENT_ICONS.get(member) ?? COMPONENT_ICONS[member] ?? "i-lucide-box",
      href: `/components/${member}`,
      mountHtml: example?.rows[0]?.html ?? "",
      meta: variants > 0
        ? `${variants} ${variants === 1 ? "variant" : "variants"}`
        : "pure CSS",
      kind: "element",
    }];
  }),
})).filter((group) => group.rows.length > 0);

const KINDS: readonly { readonly id: "all" | Kind; readonly label: string; readonly href: string }[] = [
  { id: "all", label: "All", href: "/components" },
  { id: "element", label: "Elements", href: "/components?kind=elements" },
  { id: "machine", label: "Machines", href: "/components?kind=machines" },
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
    return value === "elements" ? "element" : value === "machines" ? "machine" : "all";
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
    <main class="mx-auto w-full max-w-screen-lg px-6 py-10 md:py-16">
      <h1>Components</h1>
      <p class="text-text-muted max-w-prose">
        Every element spin paints — live, in the theme the rail has set. Open
        one to copy the markup, see the classes it answers to, and check what it
        reads from the theme.
      </p>

      <nav
        class="mt-4 flex flex-wrap items-center gap-1"
        aria-label="component kind"
      >
        <For each={KINDS}>
          {(entry) => (
            <A
              href={entry.href}
              class={`rounded-md px-3 py-1 no-underline transition-colors duration-fast ${
                kind() === entry.id
                  ? "bg-primary text-on-primary type-body-strong"
                  : "text-text-muted hover:bg-surface type-body"
              }`}
            >
              {entry.label}{" "}
              <span class="type-caption opacity-70">{countOf(entry.id)}</span>
            </A>
          )}
        </For>
      </nav>

      <GroupNav groups={groups()} />

      <For each={groups()}>
        {(group) => (
          <section class="mt-10 scroll-mt-20" id={group.id}>
            <h2>
              {group.label}
            </h2>
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <For each={group.rows}>
                {(row) => (
                    <A
                      href={row.href}
                      class="group flex h-full items-stretch gap-4 overflow-hidden rounded-md border border-solid border-border bg-surface p-4 no-underline transition-colors duration-fast hover:border-border-strong"
                    >
                    <span class="flex w-24 shrink-0 flex-col items-start gap-1">
                      <span class="flex items-center gap-2 type-body-strong">
                        <i
                          class={`${row.icon} icon-md shrink-0 text-text-muted`}
                          aria-hidden="true"
                        />
                        <span class="truncate">{row.name}</span>
                      </span>
                      <span class="shrink-0 type-caption text-text-muted">
                        {row.meta}
                      </span>
                    </span>
                    <Show
                      when={row.mountHtml !== ""}
                      fallback={
                        <span class="flex min-h-20 flex-1 items-center justify-center type-caption text-text-muted">
                          utility family
                        </span>
                      }
                    >
                      <span class="flex min-h-20 min-w-0 flex-1 items-center justify-center overflow-hidden">
                        <span class="block w-full min-w-0 max-w-full overflow-hidden text-center [&>*]:mx-auto [&>*]:block [&>*]:max-w-full [&>*]:text-left" innerHTML={row.mountHtml} />
                      </span>
                    </Show>
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
