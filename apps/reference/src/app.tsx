import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { SECTIONS, utilitiesFor } from "@spin/preset/organization.ts";
import { describeCatalog } from "@spin/preset";
import { parseTokens } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";
import { PRIMITIVES } from "./primitives.ts";
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

const GHOST_BUTTON =
  "bare inline-flex items-center gap-1 rounded-md border-0 bg-transparent p-0 font-mono text-xs font-medium normal-case tracking-normal text-text-muted not-italic shadow-none hover:text-text";

const CHIP =
  "inline-flex items-center gap-1 rounded-full border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal whitespace-nowrap text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text disabled:cursor-not-allowed disabled:opacity-40 aria-[current]:border-text aria-[current]:bg-text aria-[current]:text-surface";

const RAIL_LINK =
  "flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm text-text-muted no-underline hover:bg-surface-raised hover:text-text aria-[current]:bg-surface-raised aria-[current]:text-text aria-[current]:font-medium";

const SURFACE_LINK =
  "flex-1 justify-center rounded-md border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted no-underline hover:border-border-strong hover:text-text aria-[current]:border-text aria-[current]:bg-text aria-[current]:text-surface";

const RAIL_HEAD =
  "mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted";

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
      <h3 class="mb-2 mt-8 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {props.name}
      </h3>
      <div
        class="rounded-md border border-dashed border-solid border-border bg-surface-raised p-4"
        innerHTML={props.html}
      />
      <div class="mt-4 flex flex-wrap items-start gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open())}
          class={GHOST_BUTTON}
        >
          markup <span>{open() ? "▾" : "▸"}</span>
        </button>
        <button type="button" onClick={copy} class={GHOST_BUTTON}>
          {copied() ? "copied" : "copy"}
        </button>
      </div>
      <Show when={open()}>
        <pre
          ref={pre}
          class="mt-4 max-w-full overflow-x-auto rounded-md border border-solid border-border bg-surface-raised px-2 py-2 font-mono text-xs text-text-muted"
        >
          {props.html.trim()}
        </pre>
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
            <div>
              <h2 class="m-0 text-2xl font-bold tracking-tight">{f().title}</h2>
              <div class="font-mono text-xs text-text-muted">{f().kind}</div>
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

export default function App() {
  const { theme, setTheme, mode, setMode } = useTheme();
  const [route, setRoute] = createSignal(location.hash.slice(1) || "/components");
  createEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || "/components");
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  });
  const catalog = createMemo(() => describeCatalog(themeTreeOrParse()));
  return (
    <div class="flex min-h-screen">
      <nav class="sticky top-0 flex max-h-screen w-1/4 shrink-0 flex-col gap-1 self-start overflow-y-auto border-e border-solid border-border p-4">
        <h1 class="m-0 text-2xl font-bold tracking-tight">spin</h1>
        <div class="mb-4 flex flex-wrap items-center gap-1 rounded-md border border-solid border-border p-1">
          <For each={THEMES}>
            {(t) => (
              <button
                type="button"
                onClick={() => setTheme(t)}
                aria-current={theme() === t || undefined}
                class={CHIP}
              >
                {t}
              </button>
            )}
          </For>
          <button
            type="button"
            onClick={() => setMode("base")}
            aria-current={mode() === "base" || undefined}
            class={CHIP}
          >
            base
          </button>
          <button
            type="button"
            onClick={() => setMode("dark")}
            aria-current={mode() === "dark" || undefined}
            class={CHIP}
          >
            dark
          </button>
        </div>
        <div class="mb-2 flex gap-1 border-b border-solid border-border pb-2 text-sm">
          <a
            href="#/utilities"
            aria-current={route().startsWith("/utilities") || undefined}
            class={SURFACE_LINK}
          >
            utilities
          </a>
          <a
            href="#/components"
            aria-current={route().startsWith("/components") || undefined}
            class={SURFACE_LINK}
          >
            primitives
          </a>
        </div>
        <div class={RAIL_HEAD}>
          {route().startsWith("/utilities") ? "sections" : "components"}
        </div>
        <Show
          when={route().startsWith("/utilities")}
          fallback={
            <For each={PRIMITIVES}>
              {(r) => (
                <a
                  href={`#/components/${r.id}`}
                  aria-current={route() === `/components/${r.id}` || undefined}
                  class={RAIL_LINK}
                >
                  {r.title}
                </a>
              )}
            </For>
          }
        >
          <For each={SECTIONS}>
            {(sec) => (
              <a
                href={`#/utilities/${sec.id}`}
                aria-current={route() === `/utilities/${sec.id}` || undefined}
                class={RAIL_LINK}
              >
                <span>{sec.title}</span>
                <span class="shrink-0 font-mono text-xs text-text-muted">
                  {utilitiesFor(sec, catalog()).length}
                </span>
              </a>
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
              fallback={
                <For each={PRIMITIVES}>
                  {(r) => <a href={`#/components/${r.id}`}>{r.title}</a>}
                </For>
              }
            >
              <UtilitiesPage group={route().split("/")[2] ?? ""} />
            </Show>
          }
        >
          <PrimitivePage id={route().split("/")[2] ?? ""} />
        </Show>
      </main>
    </div>
  );
}
