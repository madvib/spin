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
import { UtilitiesPage } from "./utilities.tsx";

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
 * The one affordance an example carries: a quiet toggle that reveals the
 * markup below, with the copy INSIDE what it revealed — the pattern daisy
 * settled on, and the reason the heading stays the anchor: a pair of buttons
 * under every example is a toolbar, and this is a footnote.
 */
const MARKUP_TOGGLE =
  "inline-flex items-center gap-1 rounded-md border border-dashed border-solid border-border bg-transparent px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text";

/** The copy, within the revealed block: it acts on the code beside it. */
const COPY_BUTTON =
  "absolute end-2 top-2 inline-flex items-center gap-1 rounded-md border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text";

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

const RAIL_LINK =
  "flex items-center gap-2 rounded-md bg-transparent px-2 py-1 text-sm font-regular normal-case tracking-normal text-text-muted not-italic shadow-none hover:bg-surface-raised hover:text-text aria-[current]:bg-surface-raised aria-[current]:text-text aria-[current]:font-medium";

/**
 * The utilities/primitives switch. Unselected is a hole — transparent edge,
 * transparent fill, muted ink — so the selected one is the only thing drawn:
 * raised surface, strong edge, full ink and a step of weight. A hover that
 * painted the text token would put text on text in console, where that token
 * is a mint slab rather than ink, so hover moves the edge only.
 */
const SURFACE_LINK =
  "flex-1 justify-center rounded-md border border-solid border-transparent bg-transparent px-2 py-1 font-mono text-xs font-regular normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong aria-[current]:border-border-strong aria-[current]:bg-surface-raised aria-[current]:text-text aria-[current]:font-medium";

/** A family header in the rail: the glyph beside the name it heads. */
const RAIL_FAMILY =
  "mt-3 mb-1 flex items-center gap-1 px-2 text-xs font-semibold uppercase tracking-wide text-text-muted";

/**
 * The glyph beside a page title: the small step in ink, so it supports the
 * heading rather than competing with it. Sized in `em` by the theme, like
 * every other glyph.
 */
const TITLE_ICON = "icon-sm mt-1 shrink-0 text-text-muted";

const RAIL_HEAD = "mb-2 text-xs font-semibold text-text-muted";

function ExampleSection(props: {
  name: string;
  html: string;
  onLoad?: string;
}) {
  let pre!: HTMLPreElement;
  const [open, setOpen] = createSignal(false);
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
  return (
    <section class="mb-8">
      <h3 class="mb-2 text-sm font-semibold text-text">
        {props.name}
      </h3>
      <div class="min-h-16 max-h-screen overflow-auto rounded-md border border-dashed border-solid border-border bg-surface-raised p-4 shadow-sm">
        {
          /* The demo is the markup exactly as a consumer writes it; the panel
            decides the room it gets. The demo area is the md measure — the
            bound the page's own prose reads at — so a row of size variants
            stacks into a column that compares them instead of a ragged wrap.
            The largest spacing step is three steps tall so a demo's own
            fixed-height scroller (`h-16`) has something to scroll, and the
            panel is the scroller for anything taller still. */
        }
        <div
          class="max-w-md [--spacing-16:12rem]"
          innerHTML={props.html}
        />
      </div>
      <div class="mt-4">
        <button
          type="button"
          onClick={() => setOpen(!open())}
          aria-expanded={open()}
          class={MARKUP_TOGGLE}
        >
          <i class="i-lucide-code-xml icon-md" />
          markup
        </button>
      </div>
      <Show when={open()}>
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
      </Show>
    </section>
  );
}

function PrimitivePage(props: { id: string; onLoad?: string }) {
  const fixture = createMemo(() => PRIMITIVES.find((r) => r.id === props.id));
  return (
    <Show when={fixture()} fallback={<p>Not found</p>}>
      {(f) => (
        <>
          <header class="mb-8 flex items-start justify-between gap-4">
            <div class="flex items-start gap-2">
              <i
                class={`${PRIMITIVE_ICONS[f().id]} ${TITLE_ICON}`}
              />
              <div>
                <h2 class="m-0 text-2xl font-bold tracking-tight">
                  {f().title}
                </h2>
                <div class="font-mono text-xs text-text-muted">{f().kind}</div>
              </div>
            </div>
            <span class="shrink-0 rounded-full border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted">
              {f().examples.length} examples
            </span>
          </header>
          <p class="mb-8 max-w-screen-md text-md text-text-muted">{f().note}</p>
          <For each={[...f().examples]}>
            {(e) => (
              <ExampleSection
                name={e.name}
                html={e.html}
                onLoad={f().onLoad ?? props.onLoad}
              />
            )}
          </For>
        </>
      )}
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

function LandingPage() {
  return (
    <>
      <header class="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 class="m-0 text-2xl font-bold tracking-tight">Primitives</h2>
          <div class="font-mono text-xs text-text-muted">spin reference</div>
        </div>
        <span class="shrink-0 rounded-full border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted">
          {PRIMITIVES.length} components
        </span>
      </header>
      <p class="mb-8 max-w-screen-md text-md text-text-muted">
        Every primitive, exercised. Bare tags carry the base; variant="" is the
        API.
      </p>
      <For each={FAMILIES}>
        {(family) => (
          <section class="mb-8">
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {family.title}
            </h3>
            <p class="mb-4 max-w-screen-md text-sm text-text-muted">
              {family.blurb}
            </p>
            <ul class="flex list-none flex-col gap-2 p-0">
              <For each={family.members}>
                {(member) => {
                  const page = PAGE_BY_ID[member.id];
                  return (
                    <li>
                      <button
                        type="button"
                        onClick={() => (location.hash =
                          `#/components/${member.id}`)}
                        class="flex w-full items-center gap-4 rounded-md border border-solid border-border bg-surface-raised px-4 py-2 text-left shadow-sm hover:border-border-strong"
                      >
                        <span class="w-32 shrink-0 text-sm text-text">
                          {page.title}
                        </span>
                        <span class="min-w-0 flex-1 text-xs text-text-muted">
                          {member.note}
                        </span>
                        <span class="shrink-0 font-mono text-xs text-text-muted">
                          {page.examples.length} examples
                        </span>
                      </button>
                    </li>
                  );
                }}
              </For>
            </ul>
          </section>
        )}
      </For>
    </>
  );
}

export default function App() {
  const { theme, setTheme, mode, setMode } = useTheme();
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
  const section = createMemo(() => {
    const parts = route().split("/");
    if (parts[1] !== "utilities") return "";
    return parts[2] || SECTIONS[0]?.id || "";
  });
  return (
    <div class="flex min-h-screen bg-surface">
      <nav class="sticky top-0 flex max-h-screen w-1/4 shrink-0 flex-col gap-1 self-start overflow-y-auto border-e border-solid border-border p-4">
        <h1 class="m-0 text-2xl font-bold tracking-tight">spin</h1>
        <div class="mb-4 flex flex-wrap items-center gap-1 rounded-md border border-solid border-border p-1">
          <For each={THEMES}>
            {(t) => (
              <Chip
                label={t}
                active={theme() === t}
                onPick={() => setTheme(t)}
              />
            )}
          </For>
          <Chip
            label="base"
            active={mode() === "base"}
            onPick={() => setMode("base")}
          />
          <Chip
            label="dark"
            active={mode() === "dark"}
            onPick={() => setMode("dark")}
          />
        </div>
        <div class="mb-2 flex gap-1 border-b border-solid border-border pb-2 text-sm">
          <button
            type="button"
            onClick={() => (location.hash = "#/utilities")}
            aria-current={route().startsWith("/utilities") || undefined}
            class={SURFACE_LINK}
          >
            utilities
          </button>
          <button
            type="button"
            onClick={() => (location.hash = "#/components")}
            aria-current={route().startsWith("/components") || undefined}
            class={SURFACE_LINK}
          >
            primitives
          </button>
        </div>
        <div class={RAIL_HEAD}>
          {route().startsWith("/utilities") ? "sections" : "components"}
        </div>
        <Show
          when={route().startsWith("/utilities")}
          fallback={
            <For each={FAMILIES}>
              {(family) => (
                <div>
                  <div class={RAIL_FAMILY}>
                    <i class={`${FAMILY_ICONS[family.title]} icon-md`} />
                    {family.title}
                  </div>
                  <For each={membersOf(family)}>
                    {(member) => (
                      <button
                        type="button"
                        onClick={() => (location.hash =
                          `#/components/${member.id}`)}
                        aria-current={route() === `/components/${member.id}` ||
                          undefined}
                        class={RAIL_LINK}
                      >
                        <i class={`${PRIMITIVE_ICONS[member.id]} icon-md`} />
                        {PAGE_BY_ID[member.id].title}
                      </button>
                    )}
                  </For>
                </div>
              )}
            </For>
          }
        >
          <For each={SECTIONS}>
            {(sec) => (
              <button
                type="button"
                onClick={() => (location.hash = `#/utilities/${sec.id}`)}
                aria-current={section() === sec.id || undefined}
                class={RAIL_LINK}
              >
                <span>{sec.title}</span>
                <span class="shrink-0 font-mono text-xs text-text-muted">
                  {utilitiesFor(sec, catalog()).length}
                </span>
              </button>
            )}
          </For>
        </Show>
      </nav>
      <main class="min-w-0 flex-1 p-8 pb-16">
        <Show
          when={route().startsWith("/components/")}
          fallback={
            <Show
              when={route().startsWith("/utilities")}
              fallback={<LandingPage />}
            >
              <UtilitiesPage group={section()} />
            </Show>
          }
        >
          <PrimitivePage id={route().split("/")[2] ?? ""} />
        </Show>
      </main>
    </div>
  );
}
