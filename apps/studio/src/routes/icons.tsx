/**
 * Icons — the glyphs a theme can spend, at the sizes the theme spends them,
 * and the ones this project has decided to keep.
 *
 * Five iconify collections are installed, 44,082 names between them. This
 * page is where they are chosen, and it answers three questions:
 *
 *   **What is there?** A picker over the five collections and a search that
 *     matches a query ANYWHERE in a name — the prefix-only match the font
 *     picker shipped is the failure this fixes. The result is a grid of real
 *     glyphs, each drawn as inline SVG at the resolved `icon.*` value.
 *
 *   **How big does it read?** Each glyph is offered at `sm`, `md` and `lg`,
 *     read live from the theme's own `icon` group through the same
 *     `groupTokens` the colours page uses — so the row under the grid is
 *     the thing being drawn, not a number repeated next to it. Editing a
 *     row resizes the grid above it.
 *
 *   **What do I write down?** Click a glyph: `i-<collection>-<name>` goes
 *     to the clipboard, named so the preset's icon rules resolve it against
 *     the same collections the server reads. No rule is safelisted for the
 *     44k — the page renders bodies it was given, never classes it hopes
 *     exist.
 *
 * The SAVED ICONS are the project's own: the library it keeps, as against
 * the catalogue anybody may draw. A glyph the author chooses is written into
 * the project with where it came from — the collection it was fetched from,
 * and that collection's author and licence — so the library can be reused
 * and credited. The library is the project's data; the daemon owns the
 * files, and this page asks it.
 */

import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  Show,
  Switch,
} from "solid-js";
import ValueInput from "../components/demos/ValueInput.tsx";
import LinkToggle from "../components/demos/LinkToggle.tsx";
import { Marker } from "../components/Concern.tsx";
import {
  attributionText,
  collectionsIn,
  type IconEntry,
  type IconGlyph,
  iconMarkup,
  iconUtility,
  loadIconCatalog,
  loadIconCollections,
  loadIconGlyph,
  loadSavedIcons,
  removeSavedIcon,
  type SavedIcon,
  saveSavedIcon,
  searchIcons,
} from "../lib/icons.ts";
import { createLockstep, type Lockstep } from "../lib/lockstep.ts";
import { activeMode, activeTree } from "../lib/store.ts";
import { inDrawer } from "../lib/host.ts";
import { groupTokens } from "../lib/tokens.ts";

/** One size step the theme states, with the value it is worth right now. */
interface Step {
  readonly step: string;
  readonly value: string;
}
function cssLength(value: string): string {
  return /^\d*\.?\d+$/.test(value) ? `${value}px` : value;
}
type IconTab = "available" | "library";

/** The icon grid: the catalogue's rows as copy buttons. */
function GridSwitch(props: {
  results: readonly IconEntry[];
  loading: boolean;
  errored: boolean;
  emptyQuery: string;
  picked: string;
  copied: string | null;
  chosen: IconEntry | null;
  box: string;
  onChoose: (entry: IconEntry) => void;
}) {
  return (
    <Switch
      fallback={
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))] gap-2">
          <For each={props.results}>
            {(entry) => (
              <li class="m-0">
                <button
                  type="button"
                  class="secondary s-sm stack-sm w-full items-center py-2 text-text-muted hover:border-primary"
                  classList={{
                    "border-primary": props.copied ===
                        iconUtility(entry) ||
                      (props.chosen?.collection === entry.collection &&
                        props.chosen?.name === entry.name),
                  }}
                  aria-label={`Copy ${iconUtility(entry)}`}
                  onClick={() => props.onChoose(entry)}
                >
                  <Glyph entry={entry} box={props.box} />
                  <span class="w-full truncate text-center text-xs">
                    {props.copied === iconUtility(entry) ? "copied" : entry.name}
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>
      }
    >
      <Match when={props.loading}>
        <p class="text-sm text-text-muted">loading catalogue…</p>
      </Match>
      <Match when={props.errored}>
        <p class="text-sm text-text-muted">
          No glyphs. Is the API running?
        </p>
      </Match>
      <Match when={props.results.length === 0}>
        <p class="text-sm text-text-muted">
          {props.emptyQuery.trim() === ""
            ? "This collection is empty."
            : `No glyph name contains “${props.emptyQuery.trim()}”.`}
        </p>
      </Match>
    </Switch>
  );
}

/** Full library browser view inside the primary pane when the Library tab is active. */
function LibraryBrowser(props: {
  saved: readonly SavedIcon[] | undefined;
  query: string;
  box: string;
  onSelect: (icon: SavedIcon) => void;
  onUnkeep: (name: string) => void;
}) {
  const filtered = createMemo(() => {
    const list = props.saved ?? [];
    const q = props.query.trim().toLowerCase();
    if (q === "") return list;
    return list.filter((icon) =>
      icon.name.toLowerCase().includes(q) ||
      (icon.attribution.collection ?? "").toLowerCase().includes(q)
    );
  });
  return (
    <Switch
      fallback={
        <div class="grid gap-3 sm:grid-cols-2">
          <For each={filtered()}>
            {(icon) => (
              <card class="p-4">
                <div class="split items-center gap-4">
                  <button
                    type="button"
                    class="bare row-sm min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => props.onSelect(icon)}
                  >
                    <span class="flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-sunken p-2">
                      <span
                        class="block [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                        style={{ width: props.box, height: props.box }}
                        aria-hidden="true"
                        innerHTML={icon.markup}
                      />
                    </span>
                    <span class="stack-xs min-w-0 flex-1">
                      <span class="block truncate text-sm font-semibold">
                        {icon.name}
                      </span>
                      <span class="block truncate text-xs text-text-muted">
                        {attributionText(icon.attribution)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="secondary s-sm shrink-0 text-xs text-text-muted"
                    aria-label={`Remove ${icon.name} from the library`}
                    onClick={() => props.onUnkeep(icon.name)}
                  >
                    Remove
                  </button>
                </div>
              </card>
            )}
          </For>
        </div>
      }
    >
      <Match when={props.saved === undefined}>
        <p class="text-sm text-text-muted">reading the library…</p>
      </Match>
      <Match when={(props.saved ?? []).length === 0}>
        <card class="stack-xs p-5">
          <p class="m-0 text-sm font-semibold">
            No saved icons in this project yet
          </p>
          <p class="m-0 text-xs text-text-muted">
            Select any glyph in the Available tab and press “Keep in library” to vendor its SVG into spin/icons/.
          </p>
        </card>
      </Match>
      <Match when={filtered().length === 0}>
        <p class="text-sm text-text-muted">
          {`No saved icon matches “${props.query.trim()}”.`}
        </p>
      </Match>
    </Switch>
  );
}

/** Primary browser content: either the Available icon grid or the Saved Library browser. */
function BrowserContent(props: {
  tab: IconTab;
  query: string;
  picked: string;
  results: readonly IconEntry[];
  loading: boolean;
  errored: boolean;
  copied: string | null;
  chosen: IconEntry | null;
  box: string;
  onChoose: (entry: IconEntry) => void;
  saved: readonly SavedIcon[] | undefined;
  onSelectSaved: (icon: SavedIcon) => void;
  onUnkeep: (name: string) => void;
}) {
  return (
    <Show
      when={props.tab === "available"}
      fallback={
        <LibraryBrowser
          saved={props.saved}
          query={props.query}
          box={props.box}
          onSelect={props.onSelectSaved}
          onUnkeep={props.onUnkeep}
        />
      }
    >
      <GridSwitch
        results={props.results}
        loading={props.loading}
        errored={props.errored}
        emptyQuery={props.query}
        picked={props.picked}
        copied={props.copied}
        chosen={props.chosen}
        box={props.box}
        onChoose={props.onChoose}
      />
    </Show>
  );
}

/** The inspector: selected glyph stage, spacious size scale controls, and saved library shelf. */
function InspectorAside(props: {
  chosen: IconEntry | null;
  steps: readonly Step[];
  box: string;
  kept: boolean;
  copied: string | null;
  notice: string | null;
  onCopy: (entry: IconEntry) => void;
  onKeep: (entry: IconEntry) => void;
  saved: readonly SavedIcon[] | undefined;
  onUnkeep: (name: string) => void;
  onOpenLibrary: () => void;
  sizes: Lockstep;
}) {
  const groupValues = createMemo(() => props.sizes.rows().map((r) => r.value));
  return (
    <aside class="stack-lg min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-surface-raised p-5 sm:p-6">
      <Show when={props.chosen}>
        {(entry) => (
          <section class="stack rounded-lg border border-border bg-surface p-4">
            <div class="split flex-wrap items-start gap-3">
              <div class="stack-xs min-w-0">
                <p class="m-0 truncate text-md font-semibold">
                  {entry().collection} · {entry().name}
                </p>
                <code class="truncate text-xs text-text-muted">
                  {iconUtility(entry())}
                </code>
              </div>
              <div class="row-sm flex-wrap">
                <button
                  type="button"
                  class="secondary s-sm"
                  onClick={() => props.onCopy(entry())}
                >
                  {props.copied === iconUtility(entry()) ? "Copied" : "Copy utility"}
                </button>
                <button
                  type="button"
                  class="s-sm"
                  onClick={() => props.onKeep(entry())}
                >
                  {props.kept ? "Replace in library" : "Keep in library"}
                </button>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <For each={props.steps}>
                {(step) => {
                  const currentVal = () =>
                    props.sizes.shown(`icon.${step.step}`, step.value);
                  return (
                    <div class="stack-xs items-center justify-end rounded-md border border-border bg-surface-sunken p-3">
                      <Glyph
                        entry={entry()}
                        box={cssLength(currentVal())}
                      />
                      <span class="text-xs font-semibold">
                        {step.step}
                      </span>
                      <code class="text-xs text-text-muted">
                        {currentVal()}
                      </code>
                    </div>
                  );
                }}
              </For>
            </div>
            <Show when={props.notice !== null}>
              <p class="m-0 text-xs text-text-muted" role="status">
                {props.notice}
              </p>
            </Show>
            <Show when={props.copied !== null}>
              <p class="sr-only" role="status">
                copied <code>{props.copied}</code>
              </p>
            </Show>
          </section>
        )}
      </Show>
      <section class="stack">
        <div class="split">
          <div class="row-sm">
            <Marker />
            <h2>Glyph sizes</h2>
          </div>
          <LinkToggle group="icon" ratio={props.sizes.activeRatio()} />
        </div>
        <div class="stack-sm">
          <For each={props.sizes.rows()}>
            {(row) => {
              const stepName = () => row.path.slice("icon.".length);
              const liveVal = () => props.sizes.shown(row.path, row.value);
              return (
                <card class="p-4">
                  <div class="split flex-wrap items-center gap-3">
                    <div class="row-sm items-center gap-3">
                      <Show when={props.chosen}>
                        {(entry) => (
                          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface p-2">
                            <Glyph
                              entry={entry()}
                              box={cssLength(liveVal())}
                            />
                          </div>
                        )}
                      </Show>
                      <div class="stack-xs">
                        <span class="text-sm font-semibold">
                          {stepName()}
                        </span>
                        <code class="text-xs text-text-muted">{row.path}</code>
                      </div>
                    </div>
                    <ValueInput
                      id={`token-${row.path}`}
                      value={row.value}
                      type={row.type}
                      label={row.path}
                      group={groupValues()}
                      variable={row.variable}
                      onCommit={(value) => props.sizes.commit(row.path, value)}
                      onPreview={(value) => props.sizes.preview(row.path, value)}
                      onCancel={props.sizes.abandon}
                      proposed={liveVal()}
                    />
                  </div>
                </card>
              );
            }}
          </For>
        </div>
      </section>
      <section class="stack-sm">
        <div class="split">
          <div class="row-sm">
            <Marker />
            <h2>Saved icons</h2>
          </div>
          <div class="row-sm">
            <span class="text-xs text-text-muted">
              {props.saved?.length ?? 0} kept
            </span>
            <Show when={(props.saved?.length ?? 0) > 0}>
              <button
                type="button"
                class="bare text-xs font-medium text-text-muted"
                onClick={props.onOpenLibrary}
              >
                Open library
              </button>
            </Show>
          </div>
        </div>
        <Switch
          fallback={
            <ul class="stack-sm">
              <For each={props.saved ?? []}>
                {(icon) => (
                  <li class="split items-center gap-3 rounded-md border border-border bg-surface p-3">
                    <div class="row-sm min-w-0 flex-1 items-center gap-3">
                      <span class="flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-sunken p-2">
                        <span
                          class="block [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                          style={{ width: props.box, height: props.box }}
                          aria-hidden="true"
                          innerHTML={icon.markup}
                        />
                      </span>
                      <span class="stack-xs min-w-0 flex-1">
                        <span class="block truncate text-sm font-medium">
                          {icon.name}
                        </span>
                        <span class="block truncate text-xs text-text-muted">
                          {attributionText(icon.attribution)}
                        </span>
                      </span>
                    </div>
                    <button
                      type="button"
                      class="secondary s-sm shrink-0 text-xs text-text-muted"
                      aria-label={`Remove ${icon.name} from the library`}
                      onClick={() => props.onUnkeep(icon.name)}
                    >
                      Remove
                    </button>
                  </li>
                )}
              </For>
            </ul>
          }
        >
          <Match when={props.saved === undefined}>
            <p class="text-sm text-text-muted">reading the library…</p>
          </Match>
          <Match when={(props.saved ?? []).length === 0}>
            <p class="text-sm text-text-muted">
              Nothing kept yet.
            </p>
          </Match>
        </Switch>
      </section>
    </aside>
  );
}

export default function IconsPage() {
  // The `icon` group, resolved live: the grid draws at what these rows say,
  // and editing one of them is what the rows are for. Linked, the sizes are
  // one scale — one row's track resizes the whole grid.
  const iconSizes = createLockstep(() => groupTokens(activeTree(), [["icon"]], activeMode()), "icon");
  const steps = createMemo<readonly Step[]>(() =>
    iconSizes.rows().map((row) => ({
      step: row.path.slice("icon.".length),
      value: row.value,
    }))
  );

  const [catalog] = createResource(loadIconCatalog);
  const [installed] = createResource(loadIconCollections);
  const [saved, { refetch: refetchSaved }] = createResource(loadSavedIcons);
  // A background refetch keeps the resolved lists on screen: the pane's
  // `<Suspense>` must not tear the split-pane down for data it already has.
  const currentCatalog = () =>
    catalog.state === "refreshing" ? catalog.latest : catalog();
  const currentSaved = () =>
    saved.state === "refreshing" ? saved.latest : saved();
  const [tab, setTab] = createSignal<IconTab>("available");
  const [picked, setPicked] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [size, setSize] = createSignal("md");
  const [copied, setCopied] = createSignal<string | null>(null);
  /** The glyph the author is looking at: the one the panel offers to keep. */
  const [chosen, setChosen] = createSignal<IconEntry | null>(null);
  /** What the page last did about the library. */
  const [notice, setNotice] = createSignal<string | null>(null);
  let copiedFor: ReturnType<typeof globalThis.setTimeout> | undefined;

  /** The collections the catalogue carries, in the order it lists them. */
  const collections = createMemo(() => collectionsIn(currentCatalog() ?? []));

  /** The rows the picker has left in play. */
  const rows = createMemo(() => {
    const all = currentCatalog() ?? [];
    const pick = picked();
    return pick === "" ? all : all.filter((entry) => entry.collection === pick);
  });

  const results = createMemo(() => searchIcons(rows(), query()));

  const activeGlyph = createMemo(() => chosen() ?? results()[0] ?? null);

  /** The selected step's value, as a length CSS can spend. */
  const box = createMemo(() => {
    const named = steps().find((step) => step.step === size());
    const raw = named
      ? iconSizes.shown(`icon.${named.step}`, named.value)
      : "1.125rem";
    return cssLength(raw);
  });

  /** Whether the library already holds an icon under this name. */
  const kept = createMemo(() =>
    (currentSaved() ?? []).some((icon) => icon.name === activeGlyph()?.name)
  );
  async function copy(entry: IconEntry): Promise<void> {
    const utility = iconUtility(entry);
    try {
      await navigator.clipboard.writeText(utility);
    } catch {
      // A clipboard the page cannot reach is a permission, not a failure to
      // report over a glyph: nothing was copied, so nothing is claimed.
      return;
    }
    setCopied(utility);
    clearTimeout(copiedFor);
    // Typed from the call itself: node's and the DOM's names for this handle
    // differ, and neither has to be guessed at the assignment.
    copiedFor = globalThis.setTimeout(() => setCopied(null), 1200);
  }

  /**
   * Keeps the glyph the author is looking at.
   *
   * The markup is the glyph's own body in an SVG element that carries the
   * box it was drawn in, and the attribution is what the collection says
   * about itself — the author and the licence, taken from where the glyph
   * came from rather than typed in.
   */
  async function keep(entry: IconEntry): Promise<void> {
    const glyph = await loadIconGlyph(entry);
    if (glyph === null) {
      setNotice(`No glyph “${entry.name}” in ${entry.collection}.`);
      return;
    }
    const collection = installed()?.find(
      (candidate) => candidate.prefix === entry.collection,
    );
    const result = await saveSavedIcon(entry.name, iconMarkup(glyph), {
      collection: entry.collection,
      author: collection?.author ?? null,
      license: collection?.license ?? null,
    });
    if (result.error !== null) {
      setNotice(result.error);
      return;
    }
    refetchSaved();
    setNotice(`Kept “${entry.name}” in the library.`);
  }

  /** Takes an icon out of the library. */
  async function unkeep(name: string): Promise<void> {
    const result = await removeSavedIcon(name);
    if (result.error !== null) {
      setNotice(result.error);
      return;
    }
    refetchSaved();
    setNotice(`Removed “${name}” from the library.`);
  }

  const selectSaved = (icon: SavedIcon) => {
    const collection = icon.attribution.collection ?? "lucide";
    const entry: IconEntry = { collection, name: icon.name };
    setChosen(entry);
    void copy(entry);
  };

  return (
    <div
      data-studio-chrome=""
      class="flex min-h-0 min-w-0 flex-1 flex-col bg-surface"
    >
      <header class="stack-sm shrink-0 border-b border-border bg-surface-raised px-4 py-3 sm:px-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="row-sm flex-wrap items-center gap-3">
            <h1>Icons</h1>
            <div
              role="tablist"
              aria-label="Icon view"
              class="row-sm shrink-0 rounded-md border border-border bg-surface-sunken p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab() === "available"}
                class="bare rounded-sm px-3 py-1 text-xs font-semibold transition-colors"
                classList={{
                  "bg-surface shadow-sm": tab() === "available",
                  "text-text-muted": tab() !== "available",
                }}
                onClick={() => setTab("available")}
              >
                Available ({results().length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab() === "library"}
                class="bare rounded-sm px-3 py-1 text-xs font-semibold transition-colors"
                classList={{
                  "bg-surface shadow-sm": tab() === "library",
                  "text-text-muted": tab() !== "library",
                }}
                onClick={() => setTab("library")}
              >
                Library ({(currentSaved() ?? []).length})
              </button>
            </div>
          </div>
          <div class="row-sm min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            <input
              type="search"
              class="min-w-[12rem] max-w-md flex-1"
              placeholder={tab() === "library"
                ? "Search saved project icons…"
                : `Search ${currentCatalog()?.length ?? "…"} glyph names…`}
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
            />
            <div class="row-sm shrink-0" role="group" aria-label="Glyph size">
              <For each={steps()}>
                {(step) => (
                  <button
                    type="button"
                    class="secondary s-sm"
                    aria-pressed={size() === step.step}
                    classList={{
                      "border-primary font-semibold": size() ===
                        step.step,
                      "border-border text-text-muted": size() !== step.step,
                    }}
                    onClick={() => setSize(step.step)}
                  >
                    {step.step}
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
        <Show when={tab() === "available"}>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="secondary s-sm"
              aria-pressed={picked() === ""}
              classList={{
                "border-primary font-semibold": picked() === "",
                "border-border text-text-muted": picked() !== "",
              }}
              onClick={() => setPicked("")}
            >
              All
            </button>
            <For each={collections()}>
              {(collection) => (
                <button
                  type="button"
                  class="secondary s-sm"
                  aria-pressed={picked() === collection}
                  classList={{
                    "border-primary font-semibold": picked() ===
                      collection,
                    "border-border text-text-muted": picked() !== collection,
                  }}
                  onClick={() => setPicked(collection)}
                >
                  {collection}
                </button>
              )}
            </For>
          </div>
        </Show>
      </header>

      <Show
        when={!inDrawer()}
        fallback={
          <div class="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <div class="drawer-flow">
              <BrowserContent
                tab={tab()}
                query={query()}
                picked={picked()}
                results={results()}
                loading={currentCatalog() === undefined}
                errored={catalog.error !== undefined}
                copied={copied()}
                chosen={activeGlyph()}
                box={box()}
                onChoose={(entry) => {
                  setChosen(entry);
                  void copy(entry);
                }}
                saved={currentSaved()}
                onSelectSaved={selectSaved}
                onUnkeep={(name) => void unkeep(name)}
              />
            </div>
            <InspectorAside
              chosen={activeGlyph()}
              steps={steps()}
              box={box()}
              kept={kept()}
              copied={copied()}
              notice={notice()}
              onCopy={(entry) => void copy(entry)}
              onKeep={(entry) => void keep(entry)}
              saved={currentSaved()}
              onUnkeep={(name) => void unkeep(name)}
              onOpenLibrary={() => setTab("library")}
              sizes={iconSizes}
            />
          </div>
        }
      >
        <studio-split-pane class="flex min-h-0 flex-1 p-4 sm:p-6">
          <div slot="primary" class="drawer-scroll h-full min-h-0 overflow-y-auto pr-2">
            <BrowserContent
              tab={tab()}
              query={query()}
              picked={picked()}
              results={results()}
              loading={currentCatalog() === undefined}
              errored={catalog.error !== undefined}
              copied={copied()}
              chosen={activeGlyph()}
              box={box()}
              onChoose={(entry) => {
                setChosen(entry);
                void copy(entry);
              }}
              saved={currentSaved()}
              onSelectSaved={selectSaved}
              onUnkeep={(name) => void unkeep(name)}
            />
          </div>
          <div slot="secondary" class="flex h-full min-h-0 flex-col pl-2">
            <InspectorAside
              chosen={activeGlyph()}
              steps={steps()}
              box={box()}
              kept={kept()}
              copied={copied()}
              notice={notice()}
              onCopy={(entry) => void copy(entry)}
              onKeep={(entry) => void keep(entry)}
              saved={currentSaved()}
              onUnkeep={(name) => void unkeep(name)}
              onOpenLibrary={() => setTab("library")}
              sizes={iconSizes}
            />
          </div>
        </studio-split-pane>
      </Show>
    </div>
  );
}
/**
 * One glyph, drawn.
 *
 * The body is a promise the card follows itself rather than a
 * `createResource` read in render: the app's own `<Suspense>` boundary would
 * catch a resource created here, and every keystroke that re-creates the
 * cards would suspend the whole page for as long as the bodies take to
 * arrive — a blank studio in the middle of a search. A plain signal never
 * suspends anything.
 */
function Glyph(props: { entry: IconEntry; box: string }) {
  const [glyph, setGlyph] = createSignal<IconGlyph | null>(null);
  createEffect(() => {
    const current = props.entry;
    void loadIconGlyph(current).then((loaded) => {
      if (loaded !== null) setGlyph(loaded);
    });
  });
  return (
    <Show
      when={glyph()}
      fallback={<span class="block h-6 w-6" aria-hidden="true" />}
    >
      {(ready) => (
        <svg
          viewBox={`0 0 ${ready().width} ${ready().height}`}
          class="block"
          style={{ width: props.box, height: props.box }}
          aria-hidden="true"
          innerHTML={ready().body}
        />
      )}
    </Show>
  );
}
