/**
 * The components gallery — the elements themselves, live, as the imagery.
 *
 * Each card is a stage holding the primitive's own first example, painted
 * by whatever theme the rail has set. Contract details live on the page
 * behind the card; the gallery earns its place by showing, not telling.
 *
 * The gallery is GROUPED, in the taxonomy's order, and every card wears the
 * glyph its element is known by. The groups are the ones the studio's rail
 * and the reference app's rail draw — one taxonomy, read three times — so
 * none of them can file an element where another files it elsewhere, and a
 * reader looking for a control finds it among the other controls of its
 * kind rather than in a wall of thirty names.
 */
import { For, Show } from "solid-js";
import type { JSX } from "solid-js";
import {
  examplesFor,
  primitiveCategories,
  type PrimitiveContract,
  primitiveContracts,
  primitiveElements,
} from "@spin/preset";
import { A } from "@solidjs/router";

const MACHINE_SOURCES = import.meta.glob(
  "../../../../../packages/components/src/*/examples/*.html",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const MACHINE_TAXONOMY: readonly {
  readonly id: string;
  readonly label: string;
  readonly members: readonly string[];
}[] = [
  { id: "inputs", label: "Inputs", members: ["slider", "tabs", "select", "combobox", "tags-input", "rating-group", "number-input", "pin-input", "color-picker", "date-picker", "date-input", "editable", "file-upload", "toggle-group", "angle-slider"] },
  { id: "display", label: "Display", members: ["avatar", "carousel", "pagination", "steps", "timer", "tour", "async-list"] },
  { id: "selection", label: "Selection", members: ["listbox", "menu", "navigation-menu", "tree-view", "cascade-select"] },
  { id: "layout", label: "Layout", members: ["splitter"] },
  { id: "media", label: "Media", members: ["image-cropper", "signature-pad", "floating-panel", "hover-card", "popover", "tooltip"] },
];

const MACHINE_GROUPS: readonly {
  readonly id: string;
  readonly label: string;
  readonly rows: readonly {
    readonly name: string;
    readonly icon: string;
    readonly mountHtml: string;
    readonly manifest: { readonly commands: readonly string[] };
  }[];
}[] = MACHINE_TAXONOMY.map((group) => ({
  id: group.id,
  label: group.label,
  rows: group.members
    .filter((name) =>
      Object.keys(MACHINE_SOURCES).some((path) => path.split("/").at(-3) === name)
    )
    .map((name) => {
      const first = Object.keys(MACHINE_SOURCES).find((path) => path.split("/").at(-3) === name)
        ?.split("/").at(-1)?.slice(0, -".html".length) ?? "basic";
      return {
        name,
        icon: "i-lucide-box",
        mountHtml: `<${name}-${first}></${name}-${first}>`,
        manifest: { commands: [] as string[] },
      };
    }),
})).filter((group) => group.rows.length > 0);

/** One card's row: the element, the glyph it wears, the contract behind it. */
interface Row {
  readonly name: string;
  readonly icon: string;
  readonly contract: PrimitiveContract;
}

/**
 * The groups, in the taxonomy's order, with the cards each one shows.
 *
 * The taxonomy files every element the library ships, and the manifest is
 * what a detail page reads — so an element the manifest does not know has
 * no page behind its card, and a card that links nowhere is a dead end in a
 * gallery of things to open. The rows are therefore the elements the
 * manifest knows, and a group the manifest empties is dropped rather than
 * drawn as a heading over nothing.
 */
const GROUPS = primitiveCategories
  .map((category) => ({
    id: category.id,
    label: category.label,
    rows: primitiveElements
      .filter((element) => element.category === category.id)
      .map((element): Row | undefined => {
        const contract: PrimitiveContract | undefined = primitiveContracts[
          element.name
        ];
        if (contract === undefined) return undefined;
        return { name: element.name, icon: element.icon, contract };
      })
      .filter((row): row is Row => row !== undefined),
  }))
  .filter((group) => group.rows.length > 0);

/**
 * The groups, as links.
 *
 * Grouping is what makes the gallery readable — a reader looking for a
 * control knows the kind they want — but it is also what puts a name under
 * a heading, so the headings get to be reached in one click rather than by
 * scrolling for them.
 */
function GroupNav(): JSX.Element {
  return (
    <nav
      class="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm"
      aria-label="component groups"
    >
      <For each={GROUPS}>
        {(group) => (
          <a
            href={`#${group.id}`}
            class="hover:text-text"
          >
            {group.label}
          </a>
        )}
      </For>
    </nav>
  );
}

export default function ComponentsIndex(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-6 py-10 md:py-16">
      <h1>Components</h1>
      <p class="text-text-muted max-w-screen-md">
        Every element spin paints — live, in the theme the rail has set. Open
        one to copy the markup, see the classes it answers to, and check what it
        reads from the theme.
      </p>
      <GroupNav />

      <For each={MACHINE_GROUPS}>
        {(group) => (
          <section class="mt-10 scroll-mt-20" id={`machine-${group.id}`}>
            <h2 class="text-text">
              {group.label} <span class="text-xs text-text-muted">· interactive</span>
            </h2>
            <div class="mt-4 grid gap-4 md:grid-cols-3">
              <For each={group.rows}>
                {(row) => (
                  <A
                    href={`/components/machine-${row.name}`}
                    class="block border border-border bg-surface-raised rounded-md overflow-hidden no-underline hover:border-border-strong transition-colors duration-fast"
                  >
                    <div class="flex h-20 items-center justify-center overflow-hidden border-b border-border bg-surface px-4">
                      <div innerHTML={row.mountHtml} />
                    </div>
                    <div class="flex items-center justify-between gap-2 px-4 py-3">
                      <span class="flex min-w-0 items-center gap-2 font-heading text-lg text-text">
                        <i
                          class={`${row.icon} icon-md shrink-0 text-text-muted`}
                          aria-hidden="true"
                        />
                        <span class="truncate">{row.name}</span>
                      </span>
                      <span class="shrink-0 text-xs text-text-muted">
                        {row.manifest.commands.length} commands
                      </span>
                    </div>
                  </A>
                )}
              </For>
            </div>
          </section>
        )}
      </For>
      <For each={GROUPS}>
        {(group) => (
          <section class="mt-10 scroll-mt-20" id={group.id}>
            <h2 class="text-text">
              {group.label}
            </h2>
            <div class="mt-4 grid gap-4 md:grid-cols-3">
              <For each={group.rows}>
                {(row) => {
                  const examples = examplesFor(row.name);
                  return (
                    <A
                      href={`/components/${row.name}`}
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
                      <div class="flex items-center justify-between gap-2 px-4 py-3">
                        <span class="flex min-w-0 items-center gap-2 font-heading text-lg text-text">
                          <i
                            class={`${row.icon} icon-md shrink-0 text-text-muted`}
                            aria-hidden="true"
                          />
                          <span class="truncate">{row.name}</span>
                        </span>
                        <span class="shrink-0 text-xs text-text-muted">
                          {row.contract.variants.length > 0
                            ? `${row.contract.variants.length} ${
                              row.contract.variants.length === 1
                                ? "variant"
                                : "variants"
                            }`
                            : "no classes"}
                        </span>
                      </div>
                    </A>
                  );
                }}
              </For>
            </div>
          </section>
        )}
      </For>
    </main>
  );
}
