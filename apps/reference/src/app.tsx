import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { SECTIONS, utilitiesFor } from "@spin/preset/organization.ts";
import { describeCatalog } from "@spin/preset";
import { parseTokens } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";
import {
  FAMILIES,
  FAMILY_ICONS,
  PRIMITIVE_ICONS,
  PRIMITIVES,
} from "./primitives.ts";
import { colorValues, Swatch, UtilitiesPage } from "./utilities.tsx";

import type { CatalogSection } from "@spin/preset";
import type { Accessor } from "solid-js";
import type { TokenTree } from "@spin/theme";

const THEMES = Object.keys(starterThemes);

let themeTree: TokenTree | undefined;
function themeTreeOrParse(): TokenTree {
  if (themeTree === undefined) {
    const parsed = parseTokens(
      starterThemes.default as unknown as Parameters<typeof parseTokens>[0],
    );
    if (!parsed.ok) throw new Error(parsed.error);
    themeTree = parsed.tree;
  }
  return themeTree;
}

function useTheme() {
  const [theme, setTheme] = createSignal(
    localStorage.getItem("spin-theme") ?? "default",
  );
  const [mode, setMode] = createSignal(
    localStorage.getItem("spin-mode") ?? "base",
  );
  createEffect(() => {
    document.documentElement.dataset.theme = theme();
    document.documentElement.dataset.mode = mode();
    localStorage.setItem("spin-theme", theme());
    localStorage.setItem("spin-mode", mode());
  });
  return { theme, setTheme, mode, setMode };
}

/**
 * The accent each family is known by — one token, the same one in the rail, on
 * the landing, on a family page and beside a page title, so a family's color
 * is the family's name spelled in the theme rather than a hue invented at the
 * call site.
 *
 * The token is spent as ink (`text-`), as a mark (`bg-`) and as an edge
 * (`border-`), which the catalog safelists for every color the theme names.
 * The edge is not safelisted, because it is a variant of a color the rail only
 * ever names at runtime: a class interpolated into a template is a class the
 * scanner never sees, so the five are written out here, beside the token they
 * belong to.
 *
 * The mapping is chosen against the themes rather than against one palette:
 * `secondary` is a near-black slab in neobrut and console, and `accent` is a
 * pale amber in neobrut, so either of them spent as a glyph is a glyph that
 * disappears in a theme that is not the default. These five are the brand hue
 * plus the semantic set, each of which every starter theme states as ink
 * strong enough to read on its own surface.
 *
 * Content takes `text-muted` rather than a hue: document structure is what the
 * body copy is made of, so it wears the ink of body copy instead of competing
 * with the four families that are actually colored.
 */
const FAMILY_ACCENT: Readonly<
  Record<string, { token: string; current: string }>
> = {
  Forms: { token: "primary", current: "aria-[current]:border-primary" },
  Surfaces: {
    token: "semantic-error",
    current: "aria-[current]:border-semantic-error",
  },
  Navigation: {
    token: "semantic-info",
    current: "aria-[current]:border-semantic-info",
  },
  Feedback: {
    token: "semantic-warning",
    current: "aria-[current]:border-semantic-warning",
  },
  Content: { token: "text-muted", current: "aria-[current]:border-text-muted" },
};

/** The family each primitive is filed in, so a page wears its family's accent. */
const FAMILY_OF: Record<string, string> = Object.fromEntries(
  FAMILIES.flatMap((f) => f.members.map((m) => [m.id, f.title] as const)),
);

/**
 * A theme or mode chip. Selected is a QUIET state — raised surface, strong
 * border, full ink and a filled dot — never a fill of the text token: the chip
 * hover paints the text token, so a chip filled with it would put text on text
 * in every theme, and in console the text token is a mint slab rather than ink.
 */
const CHIP =
  "inline-flex items-center gap-1 rounded-full border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal whitespace-nowrap text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text aria-[current]:border-border-strong aria-[current]:text-text";

/** One chip of the picker, with the selected state drawn rather than declared. */
function Chip(props: { label: string; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onPick}
      aria-current={props.active || undefined}
      class={CHIP}
    >
      {props.active &&
        <i class="block h-2 w-2 shrink-0 rounded-full bg-text" />}
      {props.label}
    </button>
  );
}

/**
 * The utilities/primitives switch, and the specimen's segmented toggle. Both
 * are one shape: a bordered group of two, where unselected is a hole —
 * transparent edge, transparent fill, muted ink — so the selected one is the
 * only thing drawn: raised surface, strong edge, full ink and a step of
 * weight. A hover that painted the text token would put text on text in
 * console, where that token is a mint slab rather than ink, so hover moves
 * the edge only.
 */
const SURFACE_LINK =
  "flex-1 justify-center rounded-md border border-solid border-transparent bg-transparent px-2 py-1 font-mono text-xs font-regular normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong aria-[current]:border-border-strong aria-[current]:bg-surface-raised aria-[current]:text-text aria-[current]:font-medium";

/** The group either switch or toggle is drawn in. */
const SEGMENT_GROUP =
  "flex shrink-0 gap-1 rounded-md border border-solid border-border p-1";

/**
 * The quiet rail row every entry shares: a hole until it is current, at which
 * point the surface is raised and the ink is full. The edge stays transparent
 * here and is the one thing a caller adds — a component row answers with its
 * family's accent, a utilities row with the neutral strong edge — because a
 * state that must differ per family cannot be a constant.
 */
const RAIL_LINK =
  "flex items-center gap-2 rounded-md border border-solid border-transparent bg-transparent px-2 py-1 text-sm font-regular normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:bg-surface-raised hover:text-text aria-[current]:bg-surface-raised aria-[current]:text-text aria-[current]:font-medium";

/** A section row: no family to answer with, so the neutral edge. */
const RAIL_SECTION = `${RAIL_LINK} aria-[current]:border-border-strong`;

/** A family header in the rail: the glyph beside the name it heads. */
const RAIL_FAMILY =
  "mt-3 mb-1 flex items-center gap-1 px-2 text-xs font-semibold normal-case tracking-normal text-text-muted";

/** What the rail says when the search has left it nothing to say. */
const RAIL_EMPTY = "px-2 py-1 text-xs text-text-muted";

/**
 * The glyph beside a page title: the small step in ink, so it supports the
 * heading rather than competing with it. Sized in `em` by the theme, like
 * every other glyph — and colored by the family, so the page says which of the
 * five it belongs to before its title is read.
 */
const TITLE_ICON = "icon-sm mt-1 shrink-0 text-text-muted";

const RAIL_HEAD =
  "mb-2 flex items-center gap-2 text-xs font-semibold text-text-muted";

/** The sub-heading every section of the landing carries. */
const SUBHEAD =
  "mb-2 mt-8 text-xs font-semibold normal-case tracking-normal text-text-muted";

/** The brand mark: a spinner, at the size the icon scale calls large. */
const BRAND_MARK = "i-lucide-loader-circle icon-lg shrink-0 text-primary";

/** The search field the rail is filtered through, and the input in it. */
const SEARCH_FIELD =
  "flex min-w-0 flex-1 items-center gap-2 rounded-md border border-solid border-border bg-field px-2 py-1";
const SEARCH_INPUT = "w-full bg-transparent text-sm font-regular text-text";

/** The copy, within the revealed block: it acts on the code beside it. */
const COPY_BUTTON =
  "absolute end-2 top-2 inline-flex items-center gap-1 rounded-md border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text";

/** The quiet way out of a specimen: a link-shaped button. */
const QUIET_BUTTON =
  "self-start inline-flex items-center gap-1 rounded-md border border-solid border-transparent bg-transparent px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text";

/** The panel a specimen is demoed in: the md measure, the bound prose reads at. */
const SPECIMEN_PANEL =
  "min-h-16 max-h-screen overflow-auto rounded-md border border-dashed border-solid border-border bg-surface-raised p-4 shadow-sm";
const SPECIMEN_MEASURE = "max-w-md [--spacing-16:12rem]";

/**
 * The palette the landing strips, in the order a reader meets it: the three
 * brand hues, the status set, the surfaces a page is built from, and the inks
 * and edges that say what is on them.
 */
const PALETTE: readonly string[] = [
  "bg-primary",
  "bg-secondary",
  "bg-accent",
  "bg-semantic-success",
  "bg-semantic-warning",
  "bg-semantic-error",
  "bg-semantic-info",
  "bg-surface",
  "bg-surface-raised",
  "bg-surface-sunken",
  "bg-field",
  "bg-text",
  "bg-text-muted",
  "bg-border",
  "bg-border-strong",
  "bg-link",
];

/**
 * The three specimens the landing shows. One per family that has a face:
 * Forms, Surfaces and Feedback, each the example that shows the most of the
 * component at once — the variants, every part, the whole tone set.
 */
const FEATURED: readonly string[] = ["button", "card", "alert"];

/**
 * One example of one primitive: the component, or its markup — one or the
 * other, never both. A stacked pair put the markup between every two
 * specimens, which turns a page of components into a page of code with
 * components in the gaps; the toggle puts the choice where it belongs, on the
 * specimen, and leaves the page a single surface at a time.
 */
function ExampleSection(props: {
  name: string;
  html: string;
  accent: string;
  onLoad?: string;
}) {
  let pre!: HTMLPreElement;
  const [tab, setTab] = createSignal<"component" | "code">("component");
  const [copied, setCopied] = createSignal(false);
  createEffect(() => {
    if (props.onLoad) new Function(props.onLoad)();
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pre.textContent ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: no-op */
    }
  };
  // The panel decides the room the specimen gets, and the markup says which
  // room it is: a page header is a page-width thing, and the md measure —
  // where the page's own prose reads — squeezes a header until its trail
  // wraps into a column of links. Everything else reads at the measure.
  const measure = props.html.trimStart().startsWith("<header")
    ? ""
    : SPECIMEN_MEASURE;
  return (
    <section class="mb-8">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 class="m-0 flex items-center gap-2 text-sm font-semibold text-text">
          <span class={`block h-1 w-4 rounded-full bg-${props.accent}`} />
          {props.name}
        </h3>
        <div class={SEGMENT_GROUP}>
          <button
            type="button"
            onClick={() => setTab("component")}
            aria-current={tab() === "component" || undefined}
            class={SURFACE_LINK}
          >
            <i class="i-lucide-eye icon-md" />
            component
          </button>
          <button
            type="button"
            onClick={() => setTab("code")}
            aria-current={tab() === "code" || undefined}
            class={SURFACE_LINK}
          >
            <i class="i-lucide-code-xml icon-md" />
            code
          </button>
        </div>
      </div>
      <Show
        when={tab() === "component"}
        fallback={
          <div class="relative mt-4">
            <pre
              ref={pre}
              class="max-w-full overflow-x-auto rounded-md border border-solid border-border bg-surface-raised px-2 py-2 font-mono text-xs text-text-muted shadow-sm"
            >
            {props.html.trim()}
            </pre>
            <button type="button" onClick={copy} class={COPY_BUTTON}>
              <i class="i-lucide-copy icon-md" />
              {copied() ? "copied" : "copy"}
            </button>
          </div>
        }
      >
        {
          /* The demo is the markup exactly as a consumer writes it; the panel
            decides the room it gets. The demo area is the md measure — the
            bound the page's own prose reads at — so a row of size variants
            stacks into a column that compares them instead of a ragged wrap.
            The largest spacing step is three steps tall so a demo's own
            fixed-height scroller (`h-16`) has something to scroll, and the
            panel is the scroller for anything taller still. */
        }
        <div class={SPECIMEN_PANEL}>
          <div class={measure} innerHTML={props.html} />
        </div>
      </Show>
    </section>
  );
}

function PrimitivePage(props: { id: string; onLoad?: string }) {
  const fixture = createMemo(() => PRIMITIVES.find((r) => r.id === props.id));
  return (
    <Show when={fixture()} fallback={<p>Not found</p>}>
      {(f) => {
        const accent = FAMILY_ACCENT[FAMILY_OF[f().id]];
        return (
          <>
            <header class="mb-8 flex items-start justify-between gap-4">
              <div class="flex items-start gap-2">
                <i
                  class={`${
                    PRIMITIVE_ICONS[f().id]
                  } ${TITLE_ICON} text-${accent.token}`}
                />
                <div>
                  <h2 class="m-0 text-2xl font-bold tracking-tight">
                    {f().title}
                  </h2>
                  <div class="font-mono text-xs text-text-muted">
                    {f().kind}
                  </div>
                </div>
              </div>
              <span class="shrink-0 rounded-full border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted">
                {f().examples.length} examples
              </span>
            </header>
            <p class="mb-8 max-w-screen-md text-md text-text-muted">
              {f().note}
            </p>
            <For each={[...f().examples]}>
              {(e) => (
                <ExampleSection
                  name={e.name}
                  html={e.html}
                  accent={accent.token}
                  onLoad={f().onLoad ?? props.onLoad}
                />
              )}
            </For>
          </>
        );
      }}
    </Show>
  );
}

/** Every primitive, by id, for the index rows. */
const PAGE_BY_ID: Record<string, (typeof PRIMITIVES)[number]> = Object
  .fromEntries(PRIMITIVES.map((p) => [p.id, p]));

/**
 * The family's members, alphabetical by the title the rail spells: the
 * grouping is the index's, and within a family a reader scans a sorted list.
 */
function membersOf(family: (typeof FAMILIES)[number]) {
  return [...family.members].sort((a, b) =>
    PAGE_BY_ID[a.id].title.localeCompare(PAGE_BY_ID[b.id].title)
  );
}

/** One specimen on the landing: a component, as a consumer writes it. */
function FeaturedSpecimen(props: { id: string }) {
  const page = PAGE_BY_ID[props.id];
  const accent = FAMILY_ACCENT[FAMILY_OF[props.id]];
  return (
    <section class="flex min-w-0 flex-col gap-2">
      <div class="flex items-center gap-2">
        <i
          class={`${PRIMITIVE_ICONS[props.id]} icon-md text-${accent.token}`}
        />
        <h4 class="m-0 text-sm font-semibold text-text">{page.title}</h4>
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
 * The landing.
 *
 * Not a menu: the rail is the navigable list and it is on screen at the same
 * time, so a landing that repeats it is the same menu twice. What a landing
 * can say that a rail cannot is what the thing IS — the mark, the line it
 * stands for, the palette that is the product, the five families as places to
 * go, and three specimens to look at.
 */
function LandingPage(props: { values: Readonly<Record<string, string>> }) {
  return (
    <>
      <header class="mb-8">
        <div class="flex items-center gap-3">
          <i class={BRAND_MARK} />
          <h2 class="m-0 text-2xl font-bold tracking-tight">Primitives</h2>
        </div>
        <div class="font-mono text-xs text-text-muted">
          spin reference · {PRIMITIVES.length} components · {FAMILIES.length}
          {" "}
          families
        </div>
        <p class="mt-4 max-w-screen-md text-md text-text-muted">
          A verification layer and primitives for agent-authored UI. The tag is
          the component and the theme is the only value source: nothing in this
          app carries a color, a space or a radius that is not a token.
        </p>
      </header>

      <section class="mb-8">
        <h3 class={SUBHEAD}>The palette</h3>
        <p class="mb-4 max-w-screen-md text-sm text-text-muted">
          Every color on every page is one of these tokens, filled by a class
          and resolved by the theme. Switching the theme in the header is the
          whole product changing, not a repaint.
        </p>
        <div class="flex flex-wrap gap-2">
          <For each={PALETTE}>
            {(name) => <Swatch name={name} values={props.values} />}
          </For>
        </div>
      </section>

      <section class="mb-8">
        <h3 class={SUBHEAD}>Families</h3>
        <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
          <For each={FAMILIES}>
            {(family) => {
              const accent = FAMILY_ACCENT[family.title];
              return (
                <button
                  type="button"
                  onClick={() => (location.hash = `#/family/${family.title}`)}
                  class="flex flex-col items-start gap-2 rounded-md border border-solid border-border bg-surface-raised p-4 text-left shadow-sm hover:border-border-strong"
                >
                  <span class="flex w-full items-center gap-2">
                    <i
                      class={`${
                        FAMILY_ICONS[family.title]
                      } icon-md text-${accent.token}`}
                    />
                    <span class="text-sm font-semibold text-text">
                      {family.title}
                    </span>
                    <span class="ms-auto font-mono text-xs text-text-muted">
                      {family.members.length}
                    </span>
                  </span>
                  <span class="text-xs text-text-muted">{family.blurb}</span>
                </button>
              );
            }}
          </For>
        </div>
      </section>

      <section class="mb-8">
        <h3 class={SUBHEAD}>Specimens</h3>
        <p class="mb-4 max-w-screen-md text-sm text-text-muted">
          Three of the{" "}
          {PRIMITIVES.length}, rendered from the markup a consumer writes — no
          wrapper, no adapter, the rules beside the rule they came from.
        </p>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <For each={FEATURED}>
            {(id) => <FeaturedSpecimen id={id} />}
          </For>
        </div>
      </section>
    </>
  );
}

/** One family, as a page: what it is, and every member filed under it. */
function FamilyPage(props: { title: string }) {
  const family = createMemo(() =>
    FAMILIES.find((f) => f.title === props.title)
  );
  return (
    <Show when={family()} fallback={<p>Not found</p>}>
      {(f) => {
        const accent = FAMILY_ACCENT[f().title];
        return (
          <>
            <header class="mb-8 flex items-start justify-between gap-4">
              <div class="flex items-start gap-2">
                <i
                  class={`${
                    FAMILY_ICONS[f().title]
                  } ${TITLE_ICON} text-${accent.token}`}
                />
                <div>
                  <h2 class="m-0 text-2xl font-bold tracking-tight">
                    {f().title}
                  </h2>
                  <div class="font-mono text-xs text-text-muted">
                    {f().members.length} components
                  </div>
                </div>
              </div>
            </header>
            <p class="mb-8 max-w-screen-md text-md text-text-muted">
              {f().blurb}
            </p>
            <ul class="flex list-none flex-col gap-2 p-0">
              <For each={membersOf(f())}>
                {(member) => (
                  <li>
                    <button
                      type="button"
                      onClick={() => (location.hash =
                        `#/components/${member.id}`)}
                      class="flex w-full items-center gap-4 rounded-md border border-solid border-border bg-surface-raised px-4 py-2 text-left shadow-sm hover:border-border-strong"
                    >
                      <i
                        class={`${
                          PRIMITIVE_ICONS[member.id]
                        } icon-md shrink-0 text-${accent.token}`}
                      />
                      <span class="w-32 shrink-0 text-sm text-text">
                        {PAGE_BY_ID[member.id].title}
                      </span>
                      <span class="min-w-0 flex-1 text-xs text-text-muted">
                        {member.note}
                      </span>
                      <span class="shrink-0 font-mono text-xs text-text-muted">
                        {PAGE_BY_ID[member.id].examples.length} examples
                      </span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </>
        );
      }}
    </Show>
  );
}

/**
 * The header: the brand, the search that filters the rail, and the controls
 * that were the rail's. Sticky at the top, so the rail's own contents scroll
 * under it and the one thing a reader always has is the way to change the
 * theme, switch the surface, or name a component.
 */
function AppHeader(props: {
  route: Accessor<string>;
  theme: Accessor<string>;
  setTheme: (theme: string) => void;
  mode: Accessor<string>;
  setMode: (mode: string) => void;
  query: Accessor<string>;
  setQuery: (query: string) => void;
}) {
  const utilities = () => props.route().startsWith("/utilities");
  return (
    <header class="sticky top-0 z-dropdown border-b border-solid border-border bg-surface">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <button
          type="button"
          onClick={() => (location.hash = "#/components")}
          class="flex items-center gap-2 rounded-md border border-solid border-transparent bg-transparent px-1 py-1 text-text shadow-none cursor-pointer hover:border-border-strong"
        >
          <i class={BRAND_MARK} />
          <span class="text-lg font-bold tracking-tight">spin</span>
        </button>
        <label class={SEARCH_FIELD}>
          <i class="i-lucide-search icon-md shrink-0 text-text-muted" />
          <input
            type="search"
            value={props.query()}
            onInput={(event) => props.setQuery(event.currentTarget.value)}
            aria-label="Filter the rail"
            class={SEARCH_INPUT}
          />
        </label>
        <div class="flex flex-wrap items-center gap-1">
          <For each={THEMES}>
            {(t) => (
              <Chip
                label={t}
                active={props.theme() === t}
                onPick={() => props.setTheme(t)}
              />
            )}
          </For>
          <Chip
            label="base"
            active={props.mode() === "base"}
            onPick={() => props.setMode("base")}
          />
          <Chip
            label="dark"
            active={props.mode() === "dark"}
            onPick={() => props.setMode("dark")}
          />
        </div>
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
            aria-current={!utilities() || undefined}
            class={SURFACE_LINK}
          >
            primitives
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * The rail: families first, then alphabetical within each, filtered by the
 * search in the header. A family the search empties is hidden rather than
 * drawn as a heading over nothing, and the counts tell the reader what the
 * filter did without their having to compare against what they remember.
 */
function Rail(props: {
  route: Accessor<string>;
  query: Accessor<string>;
  catalog: Accessor<readonly CatalogSection[]>;
}) {
  const needle = createMemo(() => props.query().trim().toLowerCase());
  const utilities = () => props.route().startsWith("/utilities");

  const groups = createMemo(() =>
    FAMILIES.map((family) => ({
      family,
      accent: FAMILY_ACCENT[family.title],
      members: membersOf(family).filter((m) =>
        PAGE_BY_ID[m.id].title.toLowerCase().includes(needle())
      ),
    })).filter((g) => g.members.length > 0)
  );

  const sections = createMemo(() =>
    SECTIONS.filter((s) => s.title.toLowerCase().includes(needle()))
  );

  const shown = () =>
    utilities()
      ? sections().length
      : groups().reduce((total, g) => total + g.members.length, 0);
  const total = () => (utilities() ? SECTIONS.length : PRIMITIVES.length);

  return (
    <nav class="w-64 shrink-0 self-start border-e border-solid border-border p-4">
      <div class={RAIL_HEAD}>
        <span>{utilities() ? "sections" : "components"}</span>
        <span class="font-mono font-regular">
          {needle() === "" ? `${total()}` : `${shown()} of ${total()}`}
        </span>
      </div>
      <Show
        when={utilities()}
        fallback={
          <Show
            when={groups().length > 0}
            fallback={
              <p class={RAIL_EMPTY}>No component matches “{props.query()}”.</p>
            }
          >
            <For each={groups()}>
              {(g) => (
                <div>
                  <div class={RAIL_FAMILY}>
                    <i
                      class={`${
                        FAMILY_ICONS[g.family.title]
                      } icon-md text-${g.accent.token}`}
                    />
                    {g.family.title}
                    <span class="ms-auto font-mono text-xs font-regular text-text-muted">
                      {g.members.length}
                    </span>
                  </div>
                  <For each={g.members}>
                    {(member) => {
                      const current = () =>
                        props.route() === `/components/${member.id}`;
                      return (
                        <button
                          type="button"
                          onClick={() => (location.hash =
                            `#/components/${member.id}`)}
                          aria-current={current() || undefined}
                          class={`${RAIL_LINK} ${g.accent.current}`}
                        >
                          <i
                            class={`${PRIMITIVE_ICONS[member.id]} icon-md ${
                              current() ? `text-${g.accent.token}` : ""
                            }`}
                          />
                          {PAGE_BY_ID[member.id].title}
                          <Show when={current()}>
                            <i
                              class={`ms-auto block h-2 w-2 shrink-0 rounded-full bg-${g.accent.token}`}
                            />
                          </Show>
                        </button>
                      );
                    }}
                  </For>
                </div>
              )}
            </For>
          </Show>
        }
      >
        <Show
          when={sections().length > 0}
          fallback={
            <p class={RAIL_EMPTY}>No section matches “{props.query()}”.</p>
          }
        >
          <For each={sections()}>
            {(sec) => (
              <button
                type="button"
                onClick={() => (location.hash = `#/utilities/${sec.id}`)}
                aria-current={routeSection(props.route()) === sec.id ||
                  undefined}
                class={RAIL_SECTION}
              >
                <span>{sec.title}</span>
                <span class="ms-auto shrink-0 font-mono text-xs text-text-muted">
                  {utilitiesFor(sec, props.catalog()).length}
                </span>
              </button>
            )}
          </For>
        </Show>
      </Show>
    </nav>
  );
}

/** The section a utilities route names, or the first one for a bare route. */
function routeSection(route: string): string {
  const parts = route.split("/");
  if (parts[1] !== "utilities") return "";
  return parts[2] || SECTIONS[0]?.id || "";
}

export default function App() {
  const { theme, setTheme, mode, setMode } = useTheme();
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
  // A bare `#/utilities` names no section. The first one is the answer: an
  // empty route is a question, and "No such section" is not an answer to it.
  const section = createMemo(() => routeSection(route()));
  // The palette the landing strips is the theme the reader picked, in the mode
  // they picked it in: a landing that showed one theme's hexes under another
  // theme's fills would be a page that lies about the product.
  const palette = createMemo(() => colorValues(theme(), mode()));

  const primitiveId = createMemo(() => {
    const parts = route().split("/");
    return parts[1] === "components" && (parts[2] ?? "") !== ""
      ? parts[2]
      : undefined;
  });
  const familyTitle = createMemo(() => {
    const parts = route().split("/");
    return parts[1] === "family" && (parts[2] ?? "") !== ""
      ? decodeURIComponent(parts[2])
      : undefined;
  });
  const utilities = createMemo(() => route().startsWith("/utilities"));
  const landing = createMemo(
    () =>
      primitiveId() === undefined && familyTitle() === undefined &&
      !utilities(),
  );

  return (
    <div class="flex min-h-screen flex-col bg-surface">
      <AppHeader
        route={route}
        theme={theme}
        setTheme={setTheme}
        mode={mode}
        setMode={setMode}
        query={query}
        setQuery={setQuery}
      />
      <div class="flex flex-1 items-start">
        <Rail route={route} query={query} catalog={catalog} />
        <main class="min-w-0 flex-1 p-8 pb-16">
          <Show when={primitiveId()} keyed>
            {(id) => <PrimitivePage id={id} />}
          </Show>
          <Show when={familyTitle()} keyed>
            {(title) => <FamilyPage title={title} />}
          </Show>
          <Show when={utilities()}>
            <UtilitiesPage group={section()} />
          </Show>
          <Show when={landing()}>
            <LandingPage values={palette()} />
          </Show>
        </main>
      </div>
    </div>
  );
}
