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
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  Show,
  Switch,
} from "solid-js";
import TokenGroupEditor from "../components/demos/TokenGroupEditor.tsx";
import LinkToggle from "../components/demos/LinkToggle.tsx";
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
  saveSavedIcon,
  searchIcons,
} from "../lib/icons.ts";
import { createLockstep } from "../lib/lockstep.ts";
import { activeMode, themeText } from "../lib/store.ts";
import { inDrawer } from "../lib/host.ts";
import { analyzeTheme } from "../lib/theme.ts";
import { groupTokens } from "../lib/tokens.ts";

/** One size step the theme states, with the value it is worth right now. */
interface Step {
  readonly step: string;
  readonly value: string;
}

export default function IconsPage() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  // The `icon` group, resolved live: the grid draws at what these rows say,
  // and editing one of them is what the rows are for. Linked, the sizes are
  // one scale — one row's track resizes the whole grid.
  const iconSizes = createLockstep(() => {
    const current = tree();
    return current ? groupTokens(current, [["icon"]], activeMode()) : [];
  }, "icon");
  const steps = createMemo<readonly Step[]>(() =>
    iconSizes.rows().map((row) => ({
      step: row.path.slice("icon.".length),
      value: row.value,
    }))
  );

  const [catalog] = createResource(loadIconCatalog);
  const [installed] = createResource(loadIconCollections);
  const [saved, { refetch: refetchSaved }] = createResource(loadSavedIcons);
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
  const collections = createMemo(() => collectionsIn(catalog() ?? []));

  /** The rows the picker has left in play. */
  const rows = createMemo(() => {
    const all = catalog() ?? [];
    const pick = picked();
    return pick === "" ? all : all.filter((entry) => entry.collection === pick);
  });

  const results = createMemo(() => searchIcons(rows(), query()));

  /** The selected step's value, as a length CSS can spend. */
  const box = createMemo(() => {
    const named = steps().find((step) => step.step === size());
    const value = named?.value ?? "1.125rem";
    // A bare number is a CSS syntax error for a length; a theme that states
    // `1.125rem` or `1.5em` has already said the unit, and `em` reads
    // against whatever element the grid sits in.
    return /^\d*\.?\d+$/.test(value) ? `${value}px` : value;
  });

  /** Whether the library already holds an icon under this name. */
  const kept = createMemo(() =>
    (saved() ?? []).some((icon) => icon.name === chosen()?.name)
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

  return (
    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <div class="shrink-0 p-4 stack-sm">
        <h1>Icons</h1>
        <p class="max-w-screen-md text-text-muted">
          Every glyph in the five installed collections. Click one to copy its
          utility; the grid draws at the selected step of the theme's icon
          scale, so an edit below changes what you see. The library beside it is
          the project's own — the glyphs this project has kept.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="secondary s-sm"
            aria-pressed={picked() === ""}
            classList={{
              "border-primary font-semibold text-text": picked() === "",
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
                  "border-primary font-semibold text-text": picked() ===
                    collection,
                  "border-border text-text-muted": picked() !== collection,
                }}
                onClick={() => setPicked(collection)}
              >
                {collection}
              </button>
            )}
          </For>
          <input
            type="search"
            class="min-w-[12rem] flex-1"
            placeholder={`Search ${catalog()?.length ?? "…"} glyph names…`}
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
          <div class="row-sm" role="group" aria-label="Glyph size">
            <For each={steps()}>
              {(step) => (
                <button
                  type="button"
                  class="secondary s-sm"
                  aria-pressed={size() === step.step}
                  title={step.value}
                  classList={{
                    "border-primary font-semibold text-text": size() ===
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

        {
          /*
        The glyph in hand. The grid is a catalogue — 44k names — and the
        library is a choice, so the choice needs something to be made about:
        the one glyph the author looked at, named, with what it would cost
        to keep and what it would cost to copy.
        */
        }
        <Show when={chosen()}>
          {(entry) => (
            <div class="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-raised p-2">
              <Glyph entry={entry()} box={box()} />
              <div class="stack-sm min-w-[10rem] flex-1">
                <p class="truncate text-sm font-semibold text-text">
                  {entry().collection} · {entry().name}
                </p>
                <code class="truncate">
                  {iconUtility(entry())}
                </code>
              </div>
              <button
                type="button"
                class="secondary s-sm"
                onClick={() => copy(entry())}
              >
                Copy utility
              </button>
              <button
                type="button"
                class="s-sm"
                onClick={() => keep(entry())}
              >
                {kept() ? "Replace in library" : "Keep in library"}
              </button>
            </div>
          )}
        </Show>

        <Show when={copied() !== null}>
          <p class="text-xs text-text-muted" role="status">
            copied{" "}
            <code>
              {copied()}
            </code>
          </p>
        </Show>
        <Show when={notice() !== null}>
          <p class="text-xs text-text-muted" role="status">
            {notice()}
          </p>
        </Show>
      </div>

      <div
        class="flex min-h-0 flex-1"
        classList={{ "flex-col": inDrawer(), "flex-row": !inDrawer() }}
      >
        <div
          class={inDrawer()
            ? "drawer-flow p-4"
            : "drawer-scroll overflow-y-auto p-4"}
        >
          <Switch
            fallback={
              <div class="flex flex-wrap gap-2">
                <For each={results()}>
                  {(entry) => (
                    <button
                      type="button"
                      class="secondary s-sm stack-sm items-center w-24 text-text-muted hover:border-primary hover:text-text"
                      classList={{
                        "border-primary text-text": copied() ===
                            iconUtility(entry) ||
                          (chosen()?.collection === entry.collection &&
                            chosen()?.name === entry.name),
                      }}
                      aria-label={`Copy ${iconUtility(entry)}`}
                      onClick={() => {
                        setChosen(entry);
                        void copy(entry);
                      }}
                    >
                      <Glyph entry={entry} box={box()} />
                      <span class="w-full truncate text-center text-xs">
                        {picked() === "" ? entry.collection : ""} {entry.name}
                      </span>
                    </button>
                  )}
                </For>
              </div>
            }
          >
            <Match when={catalog() === undefined}>
              <p class="text-sm text-text-muted">loading catalogue…</p>
            </Match>
            <Match when={catalog.error !== undefined}>
              <p class="text-sm text-text-muted">
                No glyphs. Is the API running?
              </p>
            </Match>
            <Match when={results().length === 0}>
              <p class="text-sm text-text-muted">
                {query().trim() === ""
                  ? "This collection is empty."
                  : `No glyph name contains “${query().trim()}”.`}
              </p>
            </Match>
          </Switch>
        </div>

        {
          /*
        In the drawer the sizes stack below the grid: an 18rem aside beside
        a 300px grid crushes both into slivers, which is the breakage the
        drawer screenshot showed. The measure is the page's own bound —
        no spacing token reaches 18rem.
        */
        }
        <aside
          class="stack-sm shrink-0 overflow-y-auto bg-surface-raised p-4"
          classList={{
            "w-full border-t border-border": inDrawer(),
            "w-[18rem]": !inDrawer(),
          }}
        >
          {
            /*
          The library: the icons this project keeps, each with where it came
          from. It is the project's data, so the daemon holds the files and
          the page asks for them; what it shows is what the project saved.
          */
          }
          <section class="stack-sm">
            <div class="row-sm justify-between gap-2">
              <h2>Saved icons</h2>
              <span class="text-xs text-text-muted">
                {saved()?.length ?? 0}
              </span>
            </div>
            <p class="text-sm text-text-muted">
              The project's own library — the glyphs it keeps, with where each
              came from.
            </p>
            <Switch
              fallback={
                <ul class="stack-sm">
                  <For each={saved() ?? []}>
                    {(icon) => (
                      <li class="row-sm items-start gap-2">
                        <span
                          class="block h-6 w-6 shrink-0 text-text"
                          aria-hidden="true"
                          innerHTML={icon.markup}
                        />
                        <span class="stack-sm min-w-0 flex-1">
                          <span class="block truncate text-sm text-text">
                            {icon.name}
                          </span>
                          {
                            /*
                          The attribution wraps rather than truncates: it is
                          the credit the icon carries, and a credit cut off
                          at the column's edge is no credit at all.
                          */
                          }
                          <span class="block break-words text-xs text-text-muted">
                            {attributionText(icon.attribution)}
                          </span>
                        </span>
                        <button
                          type="button"
                          class="bare shrink-0 text-text-muted hover:text-text"
                          title={`Remove ${icon.name} from the library`}
                          aria-label={`Remove ${icon.name} from the library`}
                          onClick={() => unkeep(icon.name)}
                        >
                          Remove
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              }
            >
              <Match when={saved() === undefined}>
                <p class="text-sm text-text-muted">reading the library…</p>
              </Match>
              <Match when={(saved() ?? []).length === 0}>
                <p class="text-sm text-text-muted">
                  Nothing kept yet. Look at a glyph above and keep it.
                </p>
              </Match>
            </Switch>
          </section>

          <section class="stack-sm">
            <div class="row-sm justify-between gap-2">
              <h2>Glyph sizes</h2>
              <LinkToggle group="icon" ratio={iconSizes.activeRatio()} />
            </div>
            <p class="text-sm text-text-muted">
              The theme's <code>icon</code>{" "}
              group. The grid draws at the selected step; editing a step redraws
              it.
            </p>
            <TokenGroupEditor
              tokens={iconSizes.rows()}
              onEdit={(path, value) => iconSizes.commit(path.join("."), value)}
              onPreview={(path, value) => iconSizes.preview(path, value)}
              onCancel={iconSizes.abandon}
              shown={iconSizes.shown}
            />
          </section>
        </aside>
      </div>
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
  void loadIconGlyph(props.entry).then((loaded) => {
    if (loaded !== null) setGlyph(loaded);
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
