import { createMemo, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import {
  Link,
  mode,
  modesFor,
  path,
  setMode,
  setTheme,
  starterList,
  theme,
} from "./shell.tsx";
import { Mark } from "./mark.tsx";
import { Home } from "./pages/home.tsx";
import { Guide } from "./pages/guide.tsx";
import { Threads } from "./pages/threads.tsx";
import { ComponentPage, ComponentsIndex } from "./pages/components.tsx";
import { Runtime } from "./pages/runtime.tsx";

const NAV = [
  { href: "/guide", label: "guide" },
  { href: "/threads", label: "threads" },
  { href: "/components", label: "components" },
  { href: "/runtime", label: "runtime" },
];

function NavLink(props: { href: string; label: string }): JSX.Element {
  const active = createMemo(() => path().startsWith(props.href));
  return (
    <Link
      href={props.href}
      class={`px-2 py-1 text-sm rounded-sm transition-colors duration-150 ${
        active() ? "text-text font-semibold" : "text-text-muted hover:text-text"
      }`}
    >
      {props.label}
    </Link>
  );
}

function ThemePicker(): JSX.Element {
  return (
    <label class="flex items-center gap-1.5 text-sm text-text-muted">
      <span class="hidden sm:inline">deck</span>
      <select
        class="border border-border bg-surface-raised text-text text-sm rounded-sm px-1.5 py-1"
        value={theme()}
        onChange={(event) => setTheme(event.currentTarget.value)}
      >
        <For each={starterList}>
          {(name) => <option value={name}>{name}</option>}
        </For>
      </select>
    </label>
  );
}

function ModeToggle(): JSX.Element {
  return (
    <Show when={modesFor(theme()).length > 1}>
      <button
        type="button"
        onClick={() => setMode(mode() === "dark" ? "light" : "dark")}
        class="border border-border bg-surface-raised text-text text-sm rounded-sm px-2 py-1 hover:border-border-strong transition-colors duration-150"
      >
        {mode() === "dark" ? "ink" : "paper"}
      </button>
    </Show>
  );
}

export function App(): JSX.Element {
  const page = createMemo<JSX.Element>(() => {
    const p = path();
    if (p === "/") return <Home />;
    if (p === "/guide") return <Guide />;
    if (p === "/threads") return <Threads />;
    if (p === "/runtime") return <Runtime />;
    if (p === "/components") return <ComponentsIndex />;
    if (p.startsWith("/components/")) {
      return <ComponentPage id={p.slice("/components/".length)} />;
    }
    return (
      <main class="mx-auto max-w-screen-md px-4 py-24 text-center">
        <p class="text-text-muted">
          This page has not been spun.{" "}
          <Link href="/" class="text-primary underline">
            Back to the web.
          </Link>
        </p>
      </main>
    );
  });

  return (
    <div class="min-h-dvh flex flex-col bg-surface text-text font-sans text-md">
      <header class="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
        <div class="mx-auto flex max-w-screen-xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5">
          <Link href="/" class="flex items-center gap-2.5 text-text">
            <Mark class="h-8 w-8" />
            <span class="font-heading text-lg tracking-tighter">spin</span>
          </Link>
          <nav class="ml-3 flex flex-wrap items-center" aria-label="pages">
            <For each={NAV}>{(item) => <NavLink {...item} />}</For>
          </nav>
          <div class="ml-auto flex items-center gap-2">
            <ThemePicker />
            <ModeToggle />
          </div>
        </div>
      </header>
      <div class="flex-1">{page()}</div>
      <footer class="border-t border-border">
        <div class="mx-auto flex max-w-screen-xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-8 text-sm text-text-muted">
          <span class="font-heading tracking-tight">spin</span>
          <span>the styling layer for agent-authored UI</span>
          <span class="ml-auto">v0.1 — authored with itself</span>
        </div>
      </footer>
    </div>
  );
}
