import { A, type RouteDefinition, Router, useLocation } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  Show,
} from "solid-js";
import Index from "./routes/index.tsx";
import { GROUPS, type Specimen, SPECIMENS } from "./specimens.ts";
import {
  type StarterThemeName,
  starterThemes,
  themeModes,
} from "@spin/theme/themes";

/**
 * The spin mark: a spinnaker in full hoist. One filled path for the cloth,
 * one line for the luff that keeps it reading as a sail. At rest it is
 * still; the pointer asking about it is what fills the cloth.
 */
function BrandMark() {
  return (
    <svg
      class="group/mark block h-[1.25rem] w-[1.25rem] shrink-0 text-primary"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        class="fill-current transition-transform duration-slow ease-standard origin-bottom group-hover/mark:-translate-y-px"
        d="M5 4 C 12 4 19 9 20 20 L 5 20 Z"
      />
      <path
        class="stroke-current transition-opacity duration-slow ease-standard opacity-0 group-hover/mark:opacity-100"
        d="M5 4 L5 20"
        stroke-width="1.25"
        stroke-linecap="round"
        fill="none"
      />
    </svg>
  );
}

const NAV_LINK =
  "flex items-center gap-2 rounded-md px-2 py-1 text-sm text-text-muted transition-colors hover:text-text aria-[current]:font-medium aria-[current]:text-text";

const GROUP_LABEL = "px-2 pt-5 pb-1 text-xs font-medium text-text-muted";

const SELECT =
  "w-[7rem] shrink-0 rounded-md border border-solid border-border bg-field px-2 py-1 text-xs text-text";

const ICON_BUTTON =
  "inline-flex min-h-0 shrink-0 items-center justify-center rounded-md border border-solid border-transparent bg-transparent p-1 text-sm text-text-muted shadow-none cursor-pointer hover:border-border-strong hover:text-text";

const FILTER_ROW =
  "mt-2 flex items-center gap-2 border-b border-border px-2 pb-2 text-xs text-text-muted";

/** The theme picker: a real form control, named by the label that wraps it. */
function ThemePicker() {
  const [theme, setTheme] = createSignal<string>(
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("spin-theme")) || "default",
  );
  createEffect(() => {
    document.documentElement.dataset.theme = theme();
    localStorage.setItem("spin-theme", theme());
  });
  return (
    <select
      class={SELECT}
      value={theme()}
      onChange={(e) => setTheme(e.currentTarget.value)}
      aria-label="Theme"
    >
      <For each={Object.keys(starterThemes)}>
        {(name) => <option value={name}>{name}</option>}
      </For>
    </select>
  );
}

/** The mode switch: one button that walks the modes the theme actually serves. */
function ModeSwitch() {
  const modes = (): readonly string[] => [
    ...themeModes(
      starterThemes[
        (document.documentElement.dataset.theme ||
          "default") as StarterThemeName
      ],
    ),
  ];
  const [want, setWant] = createSignal<string>(
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("spin-mode")) || "base",
  );
  const resolved = (requested: string): string => {
    const available = modes();
    if (requested === "system") {
      return available.includes("dark")
        ? matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "base"
        : "base";
    }
    return available.includes(requested) ? requested : "base";
  };
  createEffect(() => {
    document.documentElement.dataset.mode = resolved(want());
    localStorage.setItem("spin-mode", want());
  });
  const next = (): string => {
    const available = modes();
    const order = available.includes("dark")
      ? ["base", "dark", "system"]
      : ["base"];
    const at = order.indexOf(want());
    return order[(at + 1) % order.length]!;
  };
  return (
    <button
      type="button"
      class={ICON_BUTTON}
      title={`Mode: ${want()}`}
      aria-label={`Mode: ${want()}`}
      onClick={() => setWant(next())}
    >
      <i class="i-lucide-sun icon-sm" />
    </button>
  );
}

/** The rail: groups, a filter, and the current component answered by the route. */
function Rail() {
  const [query, setQuery] = createSignal("");
  const location = useLocation();
  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (q.length === 0) return SPECIMENS;
    return SPECIMENS.filter((s) =>
      `${s.title} ${s.blurb} ${s.id}`.toLowerCase().includes(q)
    );
  });
  return (
    <nav class="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[13rem] shrink-0 overflow-y-auto pb-10 md:block">
      <label class={FILTER_ROW}>
        <i class="i-lucide-search icon-sm shrink-0" />
        <span class="sr-only">Filter components</span>
        <input
          class="w-full border-transparent bg-transparent p-0 text-xs text-text"
          placeholder="Filter"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
      </label>
      <Show
        when={filtered().length > 0}
        fallback={
          <p class="px-2 pt-4 text-xs text-text-muted">Nothing matches that.</p>
        }
      >
        <For each={GROUPS}>
          {(group) => (
            <Show when={filtered().some((s) => s.group === group)}>
              <h2 class={GROUP_LABEL}>{group}</h2>
              <div class="flex flex-col">
                <For
                  each={filtered().filter((s) =>
                    s.group === group
                  )}
                >
                  {(s) => (
                    <A
                      href={s.path}
                      class={NAV_LINK}
                      end
                      aria-current={location.pathname === s.path
                        ? "page"
                        : undefined}
                    >
                      {s.title}
                    </A>
                  )}
                </For>
              </div>
            </Show>
          )}
        </For>
      </Show>
    </nav>
  );
}

/** The frame every specimen stands in: a stage, sized to its subject. */
const STAGE = "rounded-lg border border-solid border-border bg-surface p-6";

function Shell(props: { children?: JSX.Element }) {
  const location = useLocation();
  const specimen = (): Specimen | undefined =>
    SPECIMENS.find((s) => s.path === location.pathname);
  return (
    <div class="min-h-dvh bg-surface text-text font-sans">
      <header class="sticky top-0 z-dropdown flex h-14 items-center gap-3 border-b border-border bg-surface px-6">
        <a href="/" class="flex items-center gap-2 font-bold tracking-tight">
          <BrandMark />
          <span>spin · components</span>
        </a>
        <span class="flex-1" />
        <ThemePicker />
        <ModeSwitch />
        <a
          class={ICON_BUTTON}
          href="https://github.com/madvib/spin-runtime"
          target="_blank"
          rel="noreferrer"
          aria-label="Source"
        >
          <i class="i-lucide-github icon-sm" />
        </a>
      </header>
      <div class="mx-auto flex max-w-[72rem] gap-10 px-6">
        <Rail />
        <main class="min-w-0 flex-1 py-10">
          <Show
            when={specimen()}
            fallback={props.children}
          >
            {(s) => (
              <article class="max-w-[45rem]">
                <header class="mb-8 flex flex-col gap-2">
                  <div class="flex items-baseline justify-between gap-4">
                    <h1 class="m-0 text-2xl font-bold tracking-tight">
                      {s().title}
                    </h1>
                    <span class="shrink-0 rounded-full border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted">
                      {s().id}
                    </span>
                  </div>
                  <p class="m-0 max-w-screen-md text-md text-text-muted">
                    {s().blurb}
                  </p>
                </header>
                <div class={STAGE}>{props.children}</div>
              </article>
            )}
          </Show>
        </main>
      </div>
    </div>
  );
}

// One table drives both the routes and the rail: no URL is typed twice.
const ROUTES: RouteDefinition[] = [
  { path: "/", component: Index },
  ...SPECIMENS.map((specimen) => ({
    path: specimen.path,
    component: specimen.component,
  })),
];

export function App() {
  return <Router root={Shell}>{ROUTES}</Router>;
}
