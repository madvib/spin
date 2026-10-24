import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import type { JSX } from "solid-js";
import { COMPONENT_GROUPS, COMPONENT_ICONS } from "@spinjs/components";
import { primitiveCategories, primitiveElements } from "@spinjs/preset";
import { library } from "../lib/store.ts";
import { inDrawer } from "../lib/host.ts";

const MACHINE_TAXONOMY = COMPONENT_GROUPS.map((g) => ({
  id: g.id,
  label: `${g.label} · interactive`,
  members: g.members.map((m) => ({
    name: `component-${m}`,
    icon: COMPONENT_ICONS[m] ?? "i-lucide-box",
  })),
}));

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
  "flex w-full items-center gap-2 justify-start rounded-md border border-solid border-transparent bg-transparent p-2 text-left text-sm font-regular normal-case tracking-normal text-text-muted no-underline cursor-pointer hover:border-primary hover:bg-surface-raised hover:text-text data-[current]:border-primary data-[current]:bg-surface-sunken data-[current]:text-text data-[current]:font-medium";

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
  "mt-4 mb-2 flex items-center gap-2 px-2 py-1 text-sm font-semibold normal-case tracking-normal text-text first:mt-0 lg:text-md";

/**
 * The row, as the drawer wears it.
 *
 * The drawer has no room for a column: the list becomes a strip above the
 * page it navigates, and a row that filled the width would be a row that
 * fills the drawer instead. The state is the same state — a raised surface, a
 * strong edge, full ink — so a reader who knows the rail knows it collapsed.
 */
const DRAWER_LINK =
  "inline-flex items-center gap-1 rounded-md border border-solid border-transparent px-2 py-1 text-sm no-underline text-text-muted hover:border-primary hover:bg-surface-raised hover:text-text data-[current]:border-primary data-[current]:bg-surface-sunken data-[current]:text-text data-[current]:font-medium";

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
  "text-sm font-semibold normal-case tracking-normal text-text";

/** One row of the list: the component it names, and the glyph it wears. */
interface Row {
  /** The element's name, as the library lists it. */
  readonly name: string;
  /** The glyph the element wears: the whole class, name included. */
  readonly icon: string;
}

export default function ComponentsLayout(props: { children?: JSX.Element }) {
  const location = useLocation();
  // The drawer has no room for a rail beside the content: the list becomes a
  // wrapping strip above the page it navigates. It is read through a memo, so
  // the page re-lays-out when the host switches the studio between the
  // drawer and the modal — a layout that only changed on the next
  // navigation was a layout that was stale until the author left.
  const drawer = createMemo(() => inDrawer());
  const [query, setQuery] = createSignal("");
  const needle = () => query().trim().toLowerCase();
  const total = () => library()?.length ?? 0;
  const shown = () => {
    const all = library() ?? [];
    const asked = needle();
    return asked === ""
      ? all
      : all.filter((c) => c.name.replace(/-/g, " ").includes(asked));
  };

  /**
   * The groups, in the taxonomy's order, with the rows each one shows.
   *
   * The order is the taxonomy's rather than the library's: the taxonomy is
   * where the elements are filed, and a group the reader has to hunt for is
   * not a group. A group the filter empties is dropped rather than drawn as a
   * heading over nothing.
   */
  const groups = createMemo(() => {
    const kept = new Map(
      shown().map((component) => [component.name, component]),
    );
    return [
      ...primitiveCategories
        .map((category) => ({
          label: category.label,
          rows: primitiveElements
            .filter((element) => element.category === category.id)
            .map((element): Row | undefined =>
              kept.has(element.name)
                ? { name: element.name, icon: element.icon }
                : undefined
            )
            .filter((row): row is Row => row !== undefined),
        })),
      ...MACHINE_TAXONOMY.map((category) => ({
        label: category.label,
        rows: category.members
          .map((element): Row | undefined =>
            kept.has(element.name)
              ? { name: element.name, icon: element.icon }
              : undefined
          )
          .filter((row): row is Row => row !== undefined),
      })),
    ]
      .filter((group) => group.rows.length > 0);
  });

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
      : "flex w-full shrink-0 flex-col gap-4 border-b border-border bg-surface-raised p-4 lg:w-[13rem] lg:border-b-0 lg:overflow-y-auto";
  const listClass = () =>
    drawer()
      ? "flow-list flex flex-wrap gap-x-2 gap-y-1"
      : "flow-list flex flex-wrap gap-x-2 gap-y-1 lg:flex-col lg:flex-nowrap lg:gap-1";

  return (
    <div
      class={drawer()
        ? "flex min-h-0 flex-col"
        : "drawer-scroll flex flex-col lg:flex-row"}
    >
      <nav aria-label="Components" class={navClass()}>
        <h2
          class={drawer() ? "text-sm text-text-muted" : "text-sm font-semibold"}
        >
          Components
        </h2>
        <label class="flex min-w-0 items-center gap-2">
          <i
            class="i-lucide-search icon-sm shrink-0 text-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            aria-label="Filter the components"
            placeholder="filter…"
            class="min-w-0 flex-1"
          />
        </label>
        <div class="flex items-center justify-between gap-2 text-xs text-text-muted">
          <span>components</span>
          <span class="font-mono">
            {needle() === "" ? `${total()}` : `${shown().length} of ${total()}`}
          </span>
        </div>
        <Switch
          fallback={
            <Show
              when={shown().length > 0}
              fallback={
                <p class="text-xs text-text-muted">
                  No component matches “{query()}”.
                </p>
              }
            >
              <div
                class={drawer() ? "flex flex-col gap-3" : "flex flex-col"}
              >
                <For each={groups()}>
                  {(group) => (
                    <>
                      {drawer()
                        ? <div class={DRAWER_BAND}>{group.label}</div>
                        : <div class={RAIL_BAND}>{group.label}</div>}
                      <ul class={listClass()}>
                        <For each={group.rows}>
                          {(row) => (
                            <li>
                              <A
                                href={`/components/${row.name}`}
                                class={drawer() ? DRAWER_LINK : RAIL_LINK}
                                // The row is current when the URL names it.
                                // The state is drawn by `data-[current]:`, so
                                // the router's own active class has nothing to
                                // add — and a class that styles nothing is a
                                // class that lies.
                                data-current={location.pathname ===
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
                                  {row.name.replace(/-/g, " ")}
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
            <p class="text-sm text-text-muted">loading…</p>
          </Match>
          <Match when={(library() ?? []).length === 0}>
            <p class="text-sm text-text-muted">
              No components. Is the daemon running?
            </p>
          </Match>
        </Switch>
      </nav>
      {props.children}
    </div>
  );
}
