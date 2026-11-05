import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import type { JSX } from "solid-js";
import { COMPONENT_ICONS } from "@spinjs/components";
import { primitiveElements } from "@spinjs/preset";
import {
  displayComponentName,
  unifiedComponentGroups,
} from "../lib/primitives.ts";
import { library } from "../lib/store.ts";
import { inDrawer } from "../lib/host.ts";
const ICONS: Readonly<Record<string, string>> = Object.fromEntries([
  ...primitiveElements.map((element) => [element.name, element.icon] as const),
  ...Object.entries(COMPONENT_ICONS).map(
    ([name, icon]) => [`component-${name}`, icon] as const,
  ),
]);

/**
 * The component gallery's side list, read from the daemon.
 *
 * It used to be four hardcoded entries — and one of them (`modal`) was not a
 * component name at all, so it navigated to a page that could not resolve.
 * A list typed by hand is a list that is wrong the moment the library
 * changes; this one is the same `primitives.list` the page renders, so the
 * navigation and the content cannot disagree.
 *
 * The list is GROUPED, and every row wears the glyph its element is known
 * by. The groups are the ones the taxonomy files the elements by — the same
 * ones the reference app's rail draws and the same ones the docs' gallery
 * reads — so an element cannot be filed in one app and drawn in another.
 *
 * A flat alphabetical list is a filing convention rather than a way to find
 * anything: a reader looks for the control they want — something to type
 * into, something to click — not for the first letter of its name. So the
 * rows are bucketed by what the thing is FOR, and the group headings are
 * what a reader scans.
 *
 * The search narrows THIS list and lives here beside it: a filter that sits
 * somewhere else looks like it applies to the page. The count says what the
 * filter did without the reader having to remember what was there before,
 * and a group the search empties is hidden rather than drawn over nothing.
 */

/**
 * The quiet row every entry shares: a hole until it is the row you are on, at
 * which point the surface is raised, the edge answers and the ink is full.
 *
 * The state paints the whole tile rather than the glyph and the text: a hit
 * target that stops at the end of the word is a hit target a reader has to
 * aim at.
 *
 * The reference app's rows are buttons and carry `ghost` — the button variant
 * that takes the theme's paint off a control. A row here is a LINK, and the
 * variant is scoped to buttons, so the class would style nothing.
 *
 * The state is drawn by `data-[current]:` rather than `aria-[current]:`,
 * because the router's own active class would leave a gallery row dark on
 * every page inside it, and a state a stylesheet can see has to be the state
 * the reader is in.
 *
 * The edge that answers is the ACTING colour: the row you are on and the
 * row the pointer is on both say so in the colour the theme spends on the
 * thing that is doing something. A raised surface on a raised rail is
 * nothing at all, which is what the row used to be.
 */
const RAIL_LINK =
  "flex w-full items-center gap-2 justify-start rounded-md border border-solid border-transparent bg-transparent p-2 text-left type-body normal-case text-text-muted no-underline cursor-pointer hover:border-primary hover:bg-surface-raised data-[current]:border-primary data-[current]:bg-surface-sunken";

/**
 * The band a run of rows is bucketed into.
 *
 * A heading outranks the rows under it: a size that is the same or larger, a
 * heavier weight, and full ink rather than the muted step — a rail whose
 * group titles are SMALLER than its members reads as one flat list of
 * unrelated things, and one whose titles are quieter reads as a caption over
 * the very things it captions. The air above is a bigger step than the air
 * below, so the heading belongs to its group rather than to the rail.
 *
 * The padding is a step wider than the row's own, so the band hangs over the
 * column of tiles instead of hiding in it.
 *
 * The size steps down on a narrow window, where the rail is a strip rather
 * than a column and the groups are read across rather than down.
 */
const RAIL_BAND =
  "mt-4 mb-2 flex items-center gap-2 px-2 py-1 type-body-strong normal-case first:mt-0";

/**
 * The row, as the drawer wears it.
 *
 * The drawer has no room for a column: the list becomes a strip above the
 * page it navigates, and a row that filled the width would be a row that
 * fills the drawer instead. The state is the same state — a raised surface, a
 * strong edge, full ink — so a reader who knows the rail knows it collapsed.
 */
const DRAWER_LINK =
  "inline-flex items-center gap-1 rounded-md border border-solid border-transparent px-2 py-1 type-body no-underline text-text-muted hover:border-primary hover:bg-surface-raised data-[current]:border-primary data-[current]:bg-surface-sunken";

/**
 * The group heading, as the drawer wears it.
 *
 * The drawer stacks the groups — a heading, and then the rows it names — so
 * the heading is a heading: a size above the rows under it, a heavier
 * weight, and the page's own ink rather than the muted step. A heading
 * beside its rows, at their size and their quietness, is one more row, and
 * the reader loses the one thing the group was there to say.
 */
const DRAWER_BAND =
  "type-body-strong normal-case";

/** One row of the list: the component it names, and the glyph it wears. */
interface Row {
  /** The element's name, as the library lists it. */
  readonly name: string;
  /** The glyph the element wears: the whole class, name included. */
  readonly icon: string;
}

/** The rail's list, as a stable component the split can place. */
function NavBody(props: {
  drawer: () => boolean;
  navClass: () => string;
  listClass: () => string;
  query: () => string;
  setQuery: (query: string) => void;
  kindFilter: () => "all" | "primitive" | "machine";
  setKindFilter: (kind: "all" | "primitive" | "machine") => void;
  needle: () => string;
  total: () => number;
  shown: () => readonly { readonly name: string }[];
  groups: () => readonly { readonly label: string; readonly rows: readonly Row[] }[];
  path: () => string;
}) {
  return (
    <>
      <h2 classList={{ "text-text-muted": props.drawer() }}>
        Components
      </h2>
      <div role="group" aria-label="Component kind" class="flex w-fit min-w-0 shrink-0 gap-1 rounded-md border border-solid border-border p-1">
        <For each={(["all", "primitive", "machine"] as const)}>
          {(kind) => (
            <button
              type="button"
              aria-pressed={props.kindFilter() === kind}
              onClick={() => props.setKindFilter(kind)}
              class="bare rounded-md border border-solid border-transparent px-2 py-1 type-caption text-text-muted aria-[pressed=true]:border-border aria-[pressed=true]:bg-surface-raised"
            >
              {kind === "all" ? "All" : kind === "primitive" ? "CSS" : "Interactive"}
            </button>
          )}
        </For>
      </div>
      <label class="relative flex min-w-0 items-center">
        <span
          class="i-lucide-search icon-sm pointer-events-none absolute start-2 shrink-0 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={props.query()}
          onInput={(event) => props.setQuery(event.currentTarget.value)}
          aria-label="Filter the components"
          placeholder="filter…"
          class="min-w-0 flex-1 ps-7"
        />
      </label>
      <div class="flex items-center justify-between gap-2 type-caption text-text-muted">
        <span>components</span>
        <span class="type-code">
          {props.needle() === "" ? `${props.total()}` : `${props.shown().length} of ${props.total()}`}
        </span>
      </div>
      <Switch
        fallback={
          <Show
            when={props.shown().length > 0}
            fallback={
              <p class="text-text-muted">
                No component matches “{props.query()}”.
              </p>
            }
          >
            <div
              class={props.drawer() ? "flex flex-col gap-3" : "flex flex-col"}
            >
              <For each={props.groups()}>
                {(group) => (
                  <>
                    {props.drawer()
                      ? <div class={DRAWER_BAND}>{group.label}</div>
                      : <div class={RAIL_BAND}>{group.label}</div>}
                    <ul class={props.listClass()}>
                      <For each={group.rows}>
                        {(row) => (
                          <li>
                            <A
                              href={`/components/${row.name}`}
                              class={props.drawer() ? DRAWER_LINK : RAIL_LINK}
                              data-current={props.path() ===
                                  `/components/${row.name}`
                                ? ""
                                : undefined}
                              activeClass=""
                              inactiveClass=""
                            >
                              <i
                                class={`${row.icon} icon-md shrink-0`}
                                aria-hidden="true"
                              />
                              <span class="min-w-0 truncate capitalize">
                                {displayComponentName(row.name)}
                              </span>
                            </A>
                          </li>
                        )}
                      </For>
                    </ul>
                  </>
                )}
              </For>
            </div>
          </Show>
        }
      >
        <Match when={library() === undefined}>
          <p class="text-text-muted">loading…</p>
        </Match>
        <Match when={(library() ?? []).length === 0}>
          <p class="text-text-muted">
            No components. Is the daemon running?
          </p>
        </Match>
      </Switch>
    </>
  );
}

export default function ComponentsLayout(props: { children?: JSX.Element }) {
  const location = useLocation();
  const drawer = () => inDrawer();
  const [query, setQuery] = createSignal("");
  const [kindFilter, setKindFilter] = createSignal<"all" | "primitive" | "machine">("all");
  const needle = () => query().trim().toLowerCase();
  const total = () => library()?.length ?? 0;
  const shown = () => {
    const all = library() ?? [];
    const asked = needle();
    const kind = kindFilter();
    return all.filter((c) =>
      (kind === "all" || c.kind === kind) &&
      (asked === "" ||
        displayComponentName(c.name).includes(asked) ||
        c.name.replace(/-/g, " ").includes(asked))
    );
  };

  const groups = createMemo(() =>
    unifiedComponentGroups(library() ?? [], kindFilter(), query(), ICONS)
  );

  /**
   * The rail's own shape, and the page's beside it.
   *
   * The drawer has no room for a column: the list becomes a strip above the
   * page it navigates. A narrow WINDOW has no room for one either — a
   * thirteen-rem column beside a page that is four hundred pixels wide
   * leaves the page a sliver and pushes its cards off the screen — so the
   * window lays the rail out as a strip until there is room for a column.
   * The strip is the drawer's layout, so a reader who has seen one knows
   * the other.
   */
  const navClass = () =>
    drawer()
      ? "flex shrink-0 flex-col gap-2 border-b border-border bg-surface-raised p-3"
      : "flex w-full shrink-0 flex-col gap-3 border-b border-border bg-surface-raised p-4 lg:w-[13rem] lg:border-b-0 lg:border-r lg:overflow-y-auto";
  const listClass = () =>
    drawer()
      ? "flex flex-wrap gap-x-2 gap-y-1"
      : "flex flex-wrap gap-x-2 gap-y-1 lg:flex-col lg:flex-nowrap lg:gap-1";

  return (
    <Show
      when={!inDrawer()}
      fallback={
        <div class="flex min-h-0 flex-col">
          <nav data-studio-chrome="" aria-label="Components" class={navClass()}>
            <NavBody
              drawer={drawer}
              navClass={navClass}
              listClass={listClass}
              query={query}
              setQuery={setQuery}
              kindFilter={kindFilter}
              setKindFilter={setKindFilter}
              needle={needle}
              total={total}
              shown={shown}
              groups={groups}
              path={() => location.pathname}
            />
          </nav>
          {props.children}
        </div>
      }
    >
      <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav data-studio-chrome="" aria-label="Components" class={navClass()}>
          <NavBody
            drawer={drawer}
            navClass={navClass}
            listClass={listClass}
            query={query}
            setQuery={setQuery}
            kindFilter={kindFilter}
            setKindFilter={setKindFilter}
            needle={needle}
            total={total}
            shown={shown}
            groups={groups}
            path={() => location.pathname}
          />
        </nav>
        <div class="drawer-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          {props.children}
        </div>
      </div>
    </Show>
  );
}
