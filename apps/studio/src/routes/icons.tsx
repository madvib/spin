/**
 * Icons — the glyphs a theme can spend, at the sizes the theme spends them.
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
import { editToken } from "../lib/editing.ts";
import {
  collectionsIn,
  type IconEntry,
  type IconGlyph,
  iconUtility,
  loadIconCatalog,
  loadIconGlyph,
  searchIcons,
} from "../lib/icons.ts";
import { activeMode, themeText } from "../lib/store.ts";
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
  // and editing one of them is what the rows are for.
  const iconTokens = createMemo(() => {
    const current = tree();
    return current ? groupTokens(current, [["icon"]], activeMode()) : [];
  });
  const steps = createMemo<readonly Step[]>(() =>
    iconTokens().map((row) => ({
      step: row.path.slice("icon.".length),
      value: row.value,
    }))
  );

  const [catalog] = createResource(loadIconCatalog);
  const [picked, setPicked] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [size, setSize] = createSignal("md");
  const [copied, setCopied] = createSignal<string | null>(null);
  let copiedFor: number | undefined;

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
    // The window's own: the DOM lib types its return as a number, and the
    // peer's `Timeout` is Deno's — a studio file has one dom lib to answer to.
    copiedFor = window.setTimeout(() => setCopied(null), 1200);
  }

  return (
    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <div class="shrink-0 p-4 stack-sm">
        <h1 class="text-2xl">Icons</h1>
        <p class="max-w-screen-md text-text-muted">
          Every glyph in the five installed collections. Click one to copy its
          utility; the grid draws at the selected step of the theme's icon
          scale, so an edit below changes what you see.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-md border bg-surface-raised px-3 py-1 text-sm"
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
                class="rounded-md border bg-surface-raised px-3 py-1 text-sm"
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
            class="min-w-48 flex-1"
            placeholder={`Search ${catalog()?.length ?? "…"} glyph names…`}
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
          <div class="row-sm" role="group" aria-label="Glyph size">
            <For each={steps()}>
              {(step) => (
                <button
                  type="button"
                  class="rounded-md border bg-surface-raised px-3 py-1 text-sm"
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
        <Show when={copied() !== null}>
          <p class="text-xs text-text-muted" role="status">
            copied{" "}
            <code class="font-mono text-text">
              {copied()}
            </code>
          </p>
        </Show>
      </div>

      <div class="flex min-h-0 flex-1">
        <div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          <Switch
            fallback={
              <div class="flex flex-wrap gap-2">
                <For each={results()}>
                  {(entry) => (
                    <button
                      type="button"
                      class="stack-sm items-center rounded-lg border border-border bg-surface-raised p-2 w-24 text-text-muted hover:border-primary hover:text-text"
                      classList={{
                        "border-primary text-text": copied() ===
                          iconUtility(entry),
                      }}
                      aria-label={`Copy ${iconUtility(entry)}`}
                      onClick={() => copy(entry)}
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

        <aside class="stack-sm w-72 shrink-0 overflow-y-auto bg-surface-raised p-4">
          <h2 class="text-sm font-semibold">Glyph sizes</h2>
          <p class="text-sm text-text-muted">
            The theme's <code>icon</code>{" "}
            group. The grid draws at the selected step; editing a step redraws
            it.
          </p>
          <TokenGroupEditor tokens={iconTokens()} onEdit={editToken} />
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
