import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
  describeCatalog,
  primitiveCategories,
  primitiveElements,
  SECTIONS,
  utilitiesFor,
} from "@spin/preset";
import { parseTokens } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";
import {
  createThemeState,
  Logo,
  Specimen,
  ThemePicker,
  type ThemeState,
  Web,
} from "@spin/kit";
import { MontagePage } from "./montage.tsx";
import { PRIMITIVES } from "./primitives.ts";
import { COMPONENT_GROUPS, COMPONENT_ICONS, COMPONENTS, componentRequirement } from "./components.ts";
import { MONTAGE_ROUTE } from "./routes.ts";
import { THEMES, themeDocuments } from "./themes.ts";
import { UtilitiesLanding, UtilitiesPage } from "./utilities.tsx";

import type { CatalogSection } from "@spin/preset";
import type { Accessor } from "solid-js";
import type { TokenTree } from "@spin/theme";

/**
 * The glyph each element wears, keyed by the element's name.
 *
 * The taxonomy lives with the elements it files, in the preset: the studio's
 * rail and the docs' gallery read the same one, so a row cannot be drawn
 * here with one glyph and drawn elsewhere with another.
 */
const ICONS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    primitiveElements.map((element) => [element.name, element.icon]),
  ),
  ...COMPONENT_ICONS,
};

let themeTree: TokenTree | undefined;
function themeTreeOrParse(): TokenTree {
  if (themeTree === undefined) {
    const parsed = parseTokens(
      starterThemes.silk as unknown as Parameters<typeof parseTokens>[0],
    );
    if (!parsed.ok) throw new Error(parsed.error);
    themeTree = parsed.tree;
  }
  return themeTree;
}

/**
 * The app's theme state.
 *
 * The behaviour is the kit's: one signal pair, one document-element effect,
 * one persistence pair, and a stored choice clamped to a theme that exists.
 * The app brings only the documents it serves — the starters plus the
 * project's own `spin/*.json`.
 */
function useTheme(): ThemeState {
  return createThemeState({
    documents: themeDocuments,
    initialTheme: "silk",
    initialMode: "system",
    storage: { theme: "spin-theme", mode: "spin-mode" },
    followSystem: true,
  });
}

/**
 * The utilities/primitives/themes switch, and the specimen's segmented
 * toggle. Both are one shape: a bordered group, where unselected is a hole —
 * transparent edge, transparent fill, muted ink — so the selected one is the
 * only thing drawn: raised surface, strong edge, full ink and a step of
 * weight. A hover that painted the text token would put text on text in
 * console, where that token is a mint slab rather than ink, so hover moves
 * the edge only.
 *
 * `min-h-0` drops the height floor the button primitive puts under every
 * bare control: a segmented switch is chrome, not a call to action, and the
 * floor that makes a button comfortable to press makes a toolbar two rows
 * taller than its labels.
 */
const SURFACE_LINK =
  "flex-1 min-h-0 justify-center rounded-md border border-solid border-transparent bg-transparent px-2 py-1 font-mono text-xs font-regular normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong aria-[current]:border-border-strong aria-[current]:bg-surface-raised aria-[current]:text-text aria-[current]:font-medium";

/** The group either switch or toggle is drawn in. */
const SEGMENT_GROUP =
  "flex shrink-0 gap-1 rounded-md border border-solid border-border p-1";

/**
 * The quiet rail row every entry shares: a hole until it is current, at which
 * point the surface is raised, the edge answers and the ink is full. The
 * button fills the tile it is given — a hit target that stops at the end of
 * the word is a hit target a reader has to aim at, so the state paints the
 * whole row rather than the glyph and the text.
 *
 * The rows of both surfaces wear the same tile: a primitive and a section are
 * the same kind of thing to a reader looking for one, and a rail that styled
 * them differently would be a rail that explained its taxonomy instead of its
 * contents.
 *
 * `justify-start` and `text-left` re-state what the button primitive
 * centers: a bare `<button>` packs its contents to the middle, and a rail row
 * that floats its glyph and label in the middle of the tile is a rail that
 * looks sloppy in a column this narrow — the glyph should start at the tile's
 * own edge, the way the utilities side already reads. The state still paints
 * the whole tile; only where the glyph sits changes.
 */
const RAIL_LINK =
  "flex w-full items-center gap-2 justify-start ghost rounded-md border border-solid border-transparent bg-transparent p-2 text-left text-sm font-regular normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:bg-surface-raised hover:text-text aria-[current]:border-border-strong aria-[current]:bg-surface-raised aria-[current]:text-text aria-[current]:font-medium";

/**
 * The band a run of rows is bucketed into.
 *
 * A heading outranks the rows under it: a size that is the same or larger, a
 * heavier weight, and full ink rather than the muted step — a rail whose
 * group titles are SMALLER than its members reads as one flat list of
 * unrelated things, and one whose titles are quieter reads as a caption over
 * the very things it captains. The air above is a bigger step than the air
 * below, so the heading belongs to its group rather than to the rail.
 *
 * The padding is a step wider than the row's own, so the band hangs over the
 * column of tiles instead of hiding in it: a band that is indented exactly as
 * far as its rows does not read as their title.
 */
const RAIL_BAND =
  "mt-4 mb-2 flex items-center gap-2 px-2 py-1 text-md font-semibold normal-case tracking-normal text-text first:mt-0";

/**
 * The heading over the rail's list.
 *
 * It outranks the group bands beneath it, which outrank the rows beneath those:
 * three levels of rail, three distinct sizes. A list heading the same size as
 * its own groups reads as one band among many, and a rail whose hierarchy is
 * flat is a rail you have to read end to end.
 */
const RAIL_HEAD =
  "mb-2 flex items-center gap-2 px-2 pt-3 text-lg font-bold normal-case tracking-normal text-text first:mt-0";

/** What the rail says when the search has left it nothing to say. */
const RAIL_EMPTY = "px-2 py-1 text-xs text-text-muted";

/**
 * The glyph beside a page title: the small step in ink, so it supports the
 * heading rather than competing with it. Sized in `em` by the theme, like
 * every other glyph.
 */
const TITLE_ICON = "icon-sm mt-1 shrink-0 text-text-muted";

/**
 * The sub-heading every section of a page carries. Same rule as the rail's:
 * never smaller than the items under it — and it is the theme's own step, so
 * the ladder does the sizing and the weight and the ink carry the rest.
 */
const SUBHEAD = "mt-8 mb-2 normal-case tracking-normal text-text first:mt-0";

/**
 * The search field the rail is filtered through, and the input in it: one
 * line, an icon and a box, and no chrome beyond the field itself.
 */
const SEARCH_FIELD =
  "flex min-w-0 items-center gap-2 rounded-md border border-solid border-border bg-field px-2 py-1 text-xs";
// The field primitive pads and borders every `<input>` it claims, so a
// control inside a chrome of its own is a box within a box: the input spends
// its border and its padding here, and the field it sits in supplies both.
const SEARCH_INPUT =
  "w-full border-transparent bg-transparent p-0 text-xs text-text";

/** The quiet way out of a specimen: a link-shaped button. */
const QUIET_BUTTON =
  "self-start inline-flex min-h-0 items-center gap-1 rounded-md border border-solid border-transparent bg-transparent px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text";

/**
 * The panel every specimen sits in: ONE box, one surface, and only as much
 * room as the thing in it needs.
 *
 * The padding is the page's own step, not a full measure of it. A demo panel
 * is a stage, and a stage the size of a page turns every component into a
 * slab of nothing: the specimen is the subject, the panel is the floor it
 * stands on, and the floor should not compete. Tall content — a table, a
 * dialog — still gets its room by the panel growing, never by the padding.
 */
const SPECIMEN_PANEL =
  "min-h-16 rounded-md border border-dashed border-solid border-border bg-surface p-6 shadow-sm";

/** The measure a specimen's content is set at. */
const SPECIMEN_MEASURE = "max-w-md [--spacing-16:12rem]";

/**
 * The three specimens the landing shows. Each is the example that shows the
 * most of the component at once — the variants, every part, the whole tone
 * set.
 */
const FEATURED: readonly string[] = ["button", "card", "alert"];

function PrimitivePage(props: { id: string; onLoad?: string }) {
  const fixture = createMemo(() => PRIMITIVES.find((r) => r.id === props.id) ?? COMPONENTS.find((r) => r.id === props.id));
  return (
    <Show when={fixture()} fallback={<p>Not found</p>}>
      {(f) => (
        <>
          <header class="mb-8 flex items-start justify-between gap-4">
            <div class="flex items-start gap-2">
              <i class={`${ICONS[f().id] ?? "i-lucide-cog"} ${TITLE_ICON}`} />
              <div>
                <h2>
                  {f().title}
                </h2>
                <div class="font-mono text-xs text-text-muted">
                  {f().kind}
                </div>
                <Show when={f().id.startsWith("component-")}>
                  <div class="mt-1 text-xs text-text-muted">
                    {componentRequirement(f().id)}
                  </div>
                </Show>
              </div>
            </div>
            <span class="shrink-0 rounded-lg border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted">
              {f().examples.length} examples
            </span>
          </header>
          <p class="max-w-screen-md text-md text-text-muted">
            {f().note}
          </p>
          <For each={[...f().examples]}>
            {(e) => (
              <Specimen
                name={e.name}
                html={e.html}
                source={e.source}
                onLoad={e.onLoad ?? f().onLoad ?? props.onLoad}
              />
            )}
          </For>
        </>
      )}
    </Show>
  );
}

/** Every primitive and machine component, by id, for the index rows. */
const PAGE_BY_ID: Record<string, (typeof PRIMITIVES)[number] | (typeof COMPONENTS)[number]> = Object
  .fromEntries([...PRIMITIVES, ...COMPONENTS].map((p) => [p.id, p]));

/** One specimen on the landing: a component, as a consumer writes it. */
function FeaturedSpecimen(props: { id: string }) {
  const page = PAGE_BY_ID[props.id];
  return (
    <section class="flex min-w-0 flex-col gap-2">
      <div class="flex items-center gap-2">
        <i class={`${ICONS[props.id]} icon-md text-text-muted`} />
        <h4 class="text-text">{page.title}</h4>
      </div>
      <div class={SPECIMEN_PANEL}>
        <div class={SPECIMEN_MEASURE} innerHTML={page.examples[0].html} />
      </div>
      <button
        type="button"
        onClick={() => (location.hash = `#/components/${props.id}`)}
        class={QUIET_BUTTON}
      >
        <i class="i-lucide-arrow-right icon-md" />
        open {page.title.toLowerCase()}
      </button>
    </section>
  );
}

/**
 * One row of the landing's index: the glyph, the name, the count. Alphabetical,
 * because a reader looking for a name scans a sorted list rather than a
 * taxonomy they have to learn first — and a filing is an opinion about where a
 * component belongs, which is a decision the reference has no business making
 * on a reader's behalf.
 */
function IndexRow(props: { id: string }) {
  const page = PAGE_BY_ID[props.id];
  return (
    <button
      type="button"
      onClick={() => (location.hash = `#/components/${props.id}`)}
      class="secondary s-sm flex w-full items-center gap-2 text-left hover:border-border-strong"
    >
      <i
        class={`${ICONS[props.id]} icon-md shrink-0 text-text-muted`}
      />
      <span class="min-w-0 flex-1 truncate text-sm text-text">
        {page.title}
      </span>
      <span class="shrink-0 font-mono text-xs text-text-muted">
        {page.examples.length}
      </span>
    </button>
  );
}

/**
 * The landing.
 *
 * Not a menu: the rail is the navigable list and it is on screen at the same
 * time, so a landing that repeats it is the same menu twice. What a landing
 * can say that a rail cannot is what the thing IS — the mark, the line it
 * stands for, three specimens to look at, and the index a reader scans.
 */
function LandingPage() {
  const components = createMemo(() =>
    [...PRIMITIVES, ...COMPONENTS].sort((a, b) => a.title.localeCompare(b.title))
  );
  return (
    <>
      <header class="mb-8">
        <div class="flex items-center gap-3">
          <Web class="h-5 w-5 shrink-0 text-primary" />
          <h2>Primitives</h2>
        </div>
        <div class="font-mono text-xs text-text-muted">
          spin reference · {PRIMITIVES.length + COMPONENTS.length} components
        </div>
        <p class="max-w-screen-md text-md text-text-muted">
          A verification layer and primitives for agent-authored UI. The tag is
          the component and the theme is the only value source: nothing in this
          app carries a color, a space or a radius that is not a token.
        </p>
      </header>

      <section class="mb-8">
        <h3 class={SUBHEAD}>Specimens</h3>
        <p class="max-w-screen-md text-sm text-text-muted">
          Three of the{" "}
          {PRIMITIVES.length}, rendered from the markup a consumer writes — no
          wrapper, no adapter, the rules beside the rule they came from.
        </p>
        <div class="grid grid-cols-3 gap-4">
          <For each={FEATURED}>
            {(id) => <FeaturedSpecimen id={id} />}
          </For>
        </div>
      </section>

      <section class="mb-8">
        <h3 class={SUBHEAD}>Index</h3>
        <p class="max-w-screen-md text-sm text-text-muted">
          Every component, alphabetical, with the number of examples each one
          carries.
        </p>
        <div class="grid grid-cols-3 gap-2">
          <For each={components()}>
            {(page) => <IndexRow id={page.id} />}
          </For>
        </div>
      </section>
    </>
  );
}

/**
 * The header: the brand, and the two controls that choose the look — the theme
 * and the mode. Sticky at the top of the SIDEBAR, not above the page: the
 * look is the rail's own control, and a top bar would spend the page's width
 * on chrome that only ever touches the rail.
 *
 * The search is NOT here. It filters the rail's list, so it lives in the rail,
 * in its own row above the list it filters — a filter that sits in the header
 * is a filter that looks like it applies to the page.
 *
 * Every row is one line and one control. The taller a sticky block is, the
 * more of the rail it covers while the rail scrolls under it, so the chrome is
 * the compact thing here and the list is the prominent one.
 *
 * The brand is a lockup rather than a control: the mark and the wordmark sit
 * in their own row with a real step of air above and below, and there is no
 * button wrapper around them. The wordmark used to be a click target that went
 * home, but the rail's list is the navigation and a reader who clicks a logo
 * to get back has to aim at a 74-pixel target in the corner of a 224-pixel
 * column. A word that cannot be clicked is a word that can be given room.
 */
function AppHeader(props: { state: ThemeState }) {
  return (
    <div class="sticky top-0 z-dropdown -mx-4 -mt-4 mb-2 flex flex-col gap-1 border-b border-solid border-border bg-surface px-4 pt-2 pb-2">
      <div class="flex items-center gap-2 py-4">
        <Logo size="sm" />
      </div>
      <div class="flex items-center gap-2">
        <span class="shrink-0 font-mono text-xs text-text-muted">theme</span>
        <ThemePicker
          state={props.state}
          system
          class="min-w-0 flex-1"
          triggerClass="w-full justify-between"
        />
      </div>
    </div>
  );
}

/**
 * One row of the rail, whichever side it came from.
 *
 * The two sides are the same thing to a reader looking for one — a place to go
 * — so they are the same row here, and the only difference is what each one
 * carries: a component has the glyph that names it, a section has the number
 * of utilities it draws. Building the union once means the rail has ONE row
 * renderer rather than two that drift.
 */
interface RailRow {
  readonly id: string;
  readonly title: string;
  readonly icon?: string;
  readonly count?: number;
}

/**
 * The rail: the header, the side switch, the search that filters the list, and
 * the list itself — bucketed into bands. Everything the rail does to narrow
 * the list is in the rail: a filter that lived in the header was a filter that
 * looked like it applied to the page.
 *
 * A row the search empties is hidden rather than drawn as a heading over
 * nothing, and the count tells the reader what the filter did without their
 * having to compare against what they remember.
 */
function Rail(props: {
  route: Accessor<string>;
  query: Accessor<string>;
  setQuery: (query: string) => void;
  catalog: Accessor<readonly CatalogSection[]>;
  state: ThemeState;
}) {
  const needle = createMemo(() => props.query().trim().toLowerCase());
  const utilities = () => props.route().startsWith("/utilities");
  // The montage is a page of the app, not a surface of components: it holds
  // every theme side by side, so the rail's list has nothing to say about it
  // and the switch is the only thing that moves.
  const montage = () => props.route().startsWith(MONTAGE_ROUTE);

  const components = createMemo(() =>
    [...PRIMITIVES, ...COMPONENTS].filter((page) => page.title.toLowerCase().includes(needle()))
      .sort((a, b) => a.title.localeCompare(b.title))
  );

  const sections = createMemo(() =>
    SECTIONS.filter((s) => s.title.toLowerCase().includes(needle()))
  );

  const shown = () => utilities() ? sections().length : components().length;
  const total = () => utilities() ? SECTIONS.length : PRIMITIVES.length + COMPONENTS.length;

  const byId = createMemo(
    () => new Map(components().map((page) => [page.id, page])),
  );

  /**
   * The groups. The primitives side is grouped by what a reader came for —
   * inputs, actions, containers — because a letter bucket is a filing
   * convention rather than a way to find anything. The utilities side keeps
   * its own section titles, which are already groups.
   */
  const groups = createMemo<
    readonly {
      readonly label: string;
      readonly count?: number;
      readonly rows: readonly RailRow[];
    }[]
  >(() =>
    utilities()
      ? sections().map((sec) => ({
        label: sec.title,
        count: utilitiesFor(sec, props.catalog()).length,
        // A utility is a token's spelling — `bg-primary`, `p-2` — and has no
        // page of its own, so a rail row per utility is a column of links
        // that go nowhere.
        rows: [],
      }))
      : [...primitiveCategories.map((cat) => ({
        label: cat.label,
        rows: primitiveElements
          .filter((element) => element.category === cat.id)
          .map((element) => byId().get(element.name))
          .filter((page) => page !== undefined)
          .map((page) => ({
            id: page.id,
            title: page.title,
            icon: ICONS[page.id],
          })),
      })),
      ...COMPONENT_GROUPS.map((group) => ({
        label: group.label,
        rows: group.members
          .map((id) => byId().get(`component-${id}`))
          .filter((page) => page !== undefined)
          .map((page) => ({
            id: page.id,
            title: page.title,
            icon: ICONS[page.id],
          })),
      }))]
        .filter((group) => group.rows.length > 0)
  );

  return (
    <nav class="sticky top-0 flex h-screen w-[16rem] shrink-0 flex-col border-e border-solid border-border">
      <div class="shrink-0 px-4 pt-4 pb-3">
        <AppHeader state={props.state} />
        <div class={SEGMENT_GROUP}>
          <button
            type="button"
            onClick={() => (location.hash = "#/utilities")}
            aria-current={utilities() || undefined}
            class={SURFACE_LINK}
          >
            utilities
          </button>
          <button
            type="button"
            onClick={() => (location.hash = "#/components")}
            aria-current={!utilities() && !montage() || undefined}
            class={SURFACE_LINK}
          >
            primitives
          </button>
          <button
            type="button"
            onClick={() => (location.hash = `#${MONTAGE_ROUTE}`)}
            aria-current={montage() || undefined}
            class={SURFACE_LINK}
          >
            themes
          </button>
        </div>
        <Show when={!montage()}>
          <label class={SEARCH_FIELD}>
            <i class="i-lucide-search icon-sm shrink-0 text-text-muted" />
            <input
              type="search"
              value={props.query()}
              onInput={(event) => props.setQuery(event.currentTarget.value)}
              aria-label="Filter the rail"
              class={SEARCH_INPUT}
            />
          </label>
        </Show>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div class={RAIL_HEAD}>
          <span>
            {montage() ? "themes" : utilities() ? "sections" : "components"}
          </span>
          <span class="font-mono text-xs font-regular">
            {montage()
              ? `${THEMES.length}`
              : needle() === ""
              ? `${total()}`
              : `${shown()} of ${total()}`}
          </span>
        </div>
        <Show
          when={!montage() && groups().length > 0}
          fallback={
            <p class={RAIL_EMPTY}>
              {montage()
                ? "Every starter theme, side by side. The page compares them."
                : `No ${
                  utilities() ? "section" : "component"
                } matches “${props.query()}”.`}
            </p>
          }
        >
          <For each={groups()}>
            {(group) => (
              <>
                {
                  /*
                  A group with no rows IS its row: the utilities side
                  navigates by section, and a section's name is the thing you
                  click.
                */
                }
                <Show when={group.rows.length === 0}>
                  <button
                    type="button"
                    onClick={() => (location.hash =
                      `#/utilities/${group.label.toLowerCase()}`)}
                    aria-current={routeSection(props.route()) ===
                        group.label.toLowerCase() || undefined}
                    class={RAIL_LINK}
                  >
                    <span class="min-w-0 truncate">{group.label}</span>
                    <span class="ms-auto shrink-0 font-mono text-xs text-text-muted">
                      {group.count}
                    </span>
                  </button>
                </Show>
                <Show when={group.rows.length > 0}>
                  <div class={RAIL_BAND}>{group.label}</div>
                </Show>
                <For each={group.rows}>
                  {(row) => {
                    const current = () =>
                      utilities()
                        ? routeSection(props.route()) === row.id
                        : props.route() === `/components/${row.id}`;
                    return (
                      <button
                        type="button"
                        onClick={() => (location.hash = `#/${
                          utilities() ? "utilities" : "components"
                        }/${row.id}`)}
                        aria-current={current() || undefined}
                        class={RAIL_LINK}
                      >
                        <Show when={row.icon !== undefined}>
                          <i class={`${row.icon} icon-md`} />
                        </Show>
                        <span class="min-w-0 truncate">{row.title}</span>
                        <Show when={row.count !== undefined}>
                          <span class="ms-auto shrink-0 font-mono text-xs text-text-muted">
                            {row.count}
                          </span>
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </>
            )}
          </For>
        </Show>
      </div>
    </nav>
  );
}

/**
 * The section a utilities route names, or the empty string for the bare one —
 * a bare route is a question ("what is on this side"), the first section is
 * not an answer to it, and the landing is.
 */
function routeSection(route: string): string {
  const parts = route.split("/");
  if (parts[1] !== "utilities") return "";
  return parts[2] ?? "";
}

export default function App() {
  const state = useTheme();
  const [query, setQuery] = createSignal("");
  const [route, setRoute] = createSignal(
    location.hash.slice(1) || "/components",
  );
  createEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || "/components");
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  });
  const catalog = createMemo(() => describeCatalog(themeTreeOrParse()));

  const primitiveId = createMemo(() => {
    const parts = route().split("/");
    return parts[1] === "components" && (parts[2] ?? "") !== ""
      ? parts[2]
      : undefined;
  });
  const utilities = createMemo(() => route().startsWith("/utilities"));
  const sectionId = createMemo(() => routeSection(route()));
  const montage = createMemo(() => route().startsWith(MONTAGE_ROUTE));
  const landing = createMemo(
    () => primitiveId() === undefined && !utilities() && !montage(),
  );

  return (
    <div class="flex min-h-screen bg-surface">
      {
        /*
        `min-w-0` on the wrapper and not only on `main`: the wrapper is the
        flex item, and a flex item's automatic minimum size is its
        min-content — which, with one unbreakable line of markup anywhere
        below, was the whole page width. The specimen's pre wraps now, but
        the column that holds it has to be ALLOWED to shrink. */
      }
      <div class="flex min-w-0 flex-1 items-start">
        <Rail
          route={route}
          query={query}
          setQuery={setQuery}
          catalog={catalog}
          state={state}
        />
        <main class="min-w-0 flex-1 p-8 pb-16">
          <Show when={primitiveId()} keyed>
            {(id) => <PrimitivePage id={id} />}
          </Show>
          <Show when={landing()}>
            <LandingPage />
          </Show>
          <Show when={utilities()}>
            <Show when={sectionId() !== ""} fallback={<UtilitiesLanding />}>
              <UtilitiesPage group={sectionId()} />
            </Show>
          </Show>
          <Show when={montage()}>
            <MontagePage />
          </Show>
        </main>
      </div>
    </div>
  );
}
