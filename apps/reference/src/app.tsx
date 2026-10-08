import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { SECTIONS, utilitiesFor } from "@spin/preset/organization.ts";
import { describeCatalog } from "@spin/preset";
import { parseTokens } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";
import { PRIMITIVES } from "./primitives.ts";
import { utilityGroupPage } from "./lib/family.ts";

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
    <section>
      <h3>{props.name}</h3>
      <div innerHTML={props.html} />
      <button type="button" onClick={() => setOpen(!open())}>
        markup <span>{open() ? "▾" : "▸"}</span>
      </button>
      <button type="button" onClick={copy}>
        {copied() ? "copied" : "copy"}
      </button>
      <Show when={open()}>
        <pre ref={pre}>{props.html.trim()}</pre>
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
          <header>
            <h2>{f().title}</h2>
            <div>{f().kind}</div>
            <p>{f().note}</p>
          </header>
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

function UtilitiesPage(props: { group: string }) {
  // String-rendered utility specimens until JSX replacements land.
  const html = createMemo(() => utilityGroupPage(props.group, themeTreeOrParse()));
  return <div innerHTML={html()} />;
}

export default function App() {
  const { theme, setTheme, mode: _mode, setMode } = useTheme();
  const [route, setRoute] = createSignal(location.hash.slice(1) || "/components");
  createEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || "/components");
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  });
  const catalog = createMemo(() => describeCatalog(themeTreeOrParse()));
  return (
    <div>
      <nav>
        <h1>spin</h1>
        <div>
          <For each={THEMES}>
            {(t) => (
              <button type="button" onClick={() => setTheme(t)}>
                {t}
              </button>
            )}
          </For>
          <button type="button" onClick={() => setMode("base")}>
            base
          </button>
          <button type="button" onClick={() => setMode("dark")}>
            dark
          </button>
        </div>
        <div>
          <a href="#/utilities">utilities</a>
          <a href="#/components">primitives</a>
        </div>
        <Show
          when={route().startsWith("/utilities")}
          fallback={
            <For each={PRIMITIVES}>
              {(r) => <a href={`#/components/${r.id}`}>{r.title}</a>}
            </For>
          }
        >
          <For each={SECTIONS}>
            {(sec) => (
              <a href={`#/utilities/${sec.id}`}>
                <span>{sec.title}</span>
                <span>{utilitiesFor(sec, catalog()).length}</span>
              </a>
            )}
          </For>
        </Show>
      </nav>
      <main>
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
