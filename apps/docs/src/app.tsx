/**
 * Routes come from the file system, under conventions worth borrowing:
 * `pages/index.tsx` is `/`, `pages/components/[id].tsx` is
 * `/components/:id`, `pages/[...all].tsx` is the miss-everything page, a
 * `_`-prefixed file is shared code without being a route, and a folder
 * nests: its `index.tsx` is the parent page, its siblings the sections.
 * Adding a page is adding a file — there is no list to maintain.
 *
 * The shell around the routes is the top bar plus a contextual rail: the
 * landing owns the viewport, the components world gets the 32-element
 * taxonomy, and every docs page gets the guide rail.
 */
import { A, Navigate, Router, useLocation, useNavigate } from "@solidjs/router";
import type { RouteDefinition, RouteSectionProps } from "@solidjs/router";
import type { JSX } from "solid-js";
import { createMemo, createSignal, For, lazy, Show } from "solid-js";
import { BrandFavicon, Logo, ModeToggle, theme, ThemePicker } from "@spin/kit";
import { starterThemes } from "@spin/theme/themes";
import { COMPONENT_GROUPS, DOCS_GROUPS, TOP_SECTIONS } from "./nav.ts";
import { SearchDialog } from "./search.tsx";

/** The path a pages file stands for: `index` is nothing, `[id]` is a
 * param, `[...all]` is the catch-all, and a folder joins the segments. */
function routeFromFile(file: string): string {
  const segments = file
    .slice("./pages/".length, -".tsx".length)
    .split("/")
    .filter((segment) => segment !== "index")
    .map((segment) =>
      segment.startsWith("[...")
        ? "*"
        : segment.startsWith("[")
        ? ":" + segment.slice(1, -1)
        : segment
    );
  return segments.join("/") === "*" ? "*" : "/" + segments.join("/");
}

const pages = import.meta.glob<{ default: () => JSX.Element }>(
  "./pages/**/*.tsx",
);

/** One route per page file, lazily imported. A folder's `index.tsx`
 * becomes the parent route and its non-param siblings the children, with
 * `/folder` itself redirecting to the first section. */
function buildRoutes(): RouteDefinition[] {
  const redirect = (to: string): () => JSX.Element => () => (
    <Navigate
      href={to}
    />
  );

  const flat: RouteDefinition[] = [];
  const folders = new Map<
    string,
    { layout?: RouteDefinition; children: RouteDefinition[] }
  >();

  for (const [file, load] of Object.entries(pages)) {
    if (file.replace(/^.*\//, "").startsWith("_")) continue;
    const segments = file.slice("./pages/".length, -".tsx".length).split("/");
    const param = segments.some((segment) => segment.startsWith("["));
    if (param || segments.length === 1) {
      flat.push({ path: routeFromFile(file), component: lazy(load) });
      continue;
    }
    const [folder, name] = segments;
    const dir = `/${folder}`;
    const entry = folders.get(dir) ?? { children: [] };
    const route: RouteDefinition = name === "index"
      ? { path: dir, component: lazy(load) }
      : { path: name, component: lazy(load) };
    if (name === "index") entry.layout = route;
    else entry.children.push(route);
    folders.set(dir, entry);
  }

  for (const [dir, { layout, children }] of folders) {
    children.sort((a, b) => (a.path ?? "").localeCompare(b.path ?? ""));
    if (!layout) {
      // A folder without an index page can't nest — its files route flat.
      flat.push(...children.map((child) => ({
        path: `${dir}/${child.path}`,
        component: child.component,
      })));
      continue;
    }
    if (children.length === 0) {
      // Nothing nests under it (only param files, which route flat).
      flat.push(layout);
      continue;
    }
    flat.push({
      ...layout,
      children: [
        { path: "", component: redirect(`${dir}/${children[0].path}`) },
        ...children,
      ],
    });
  }
  return flat;
}

const ROUTES: RouteDefinition[] = buildRoutes();

/** The primary color of the active starter, for the tab icon. */
function activePrimary(): string {
  const doc = (starterThemes as Readonly<Record<string, unknown>>)[
    theme() as string
  ] as { color?: { primary?: { $value?: unknown } } } | undefined;
  const value = doc?.color?.primary?.$value;
  return typeof value === "string" ? value : "#c8102e";
}

/**
 * The sticky top bar: the brand and the world switch on the left, the
 * search trigger, mode, and theme on the right.
 */
function TopNav(props: { onOpenSearch: () => void }): JSX.Element {
  const location = useLocation();
  const current = (prefixes: readonly string[]): boolean =>
    prefixes.some((prefix) =>
      location.pathname === prefix ||
      location.pathname.startsWith(`${prefix}/`)
    );
  return (
    <header class="sticky top-0 flex h-[3.5rem] items-center justify-between gap-4 border-b border-border bg-surface px-4 md:px-6">
      <div class="flex min-w-0 items-center gap-4">
        <A href="/" end class="no-underline" aria-label="spin home">
          <Logo size="sm" class="text-primary" />
        </A>
        <nav class="flex items-center gap-1" aria-label="sections">
          <For each={TOP_SECTIONS}>
            {(section) => (
              <A
                href={section.href}
                class={`block rounded-sm px-3 py-1.5 text-sm no-underline transition-colors duration-fast ${
                  current(section.active)
                    ? "bg-surface-raised text-text font-semibold"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {section.title}
              </A>
            )}
          </For>
        </nav>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={props.onOpenSearch}
          class="secondary s-sm items-center gap-3 text-xs text-text-muted"
        >
          <span>Search...</span>
          <kbd>
            ⌘K
          </kbd>
        </button>
        <ModeToggle />
        <ThemePicker />
      </div>
    </header>
  );
}

/** The Docs world's rail: the guide groups, with the current page raised. */
function DocsRail(): JSX.Element {
  return (
    <nav
      class="sticky top-0 flex h-screen w-[14rem] shrink-0 flex-col gap-5 overflow-y-auto border-e border-border px-4 py-6"
      aria-label="docs"
    >
      <For each={DOCS_GROUPS}>
        {(group) => (
          <div class="grid gap-1">
            <p class="text-xs font-semibold text-text-muted">{group.label}</p>
            <For each={group.items}>
              {(item) => (
                <A
                  href={item.href}
                  class="block rounded-sm px-2 py-1 text-sm no-underline transition-colors duration-fast"
                  activeClass="bg-surface-raised text-text font-semibold"
                  inactiveClass="text-text-muted hover:text-text"
                >
                  {item.title}
                </A>
              )}
            </For>
          </div>
        )}
      </For>
    </nav>
  );
}

/**
 * The Components world's rail: the taxonomy, filterable, with the
 * current element raised. The groups come from the preset, so the rail
 * cannot file an element where another surface files it elsewhere.
 */
function ComponentsRail(props: { filter: string }): JSX.Element {
  const groups = createMemo(() => {
    const query = props.filter.trim().toLowerCase();
    if (query === "") return COMPONENT_GROUPS;
    return COMPONENT_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.name.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.items.length > 0);
  });
  return (
    <div class="grid gap-1">
      <A
        href="/components"
        end
        class="block rounded-sm px-2 py-1 text-sm no-underline transition-colors duration-fast"
        activeClass="bg-surface-raised text-text font-semibold"
        inactiveClass="text-text-muted hover:text-text"
      >
        Overview
      </A>
      <For each={groups()}>
        {(group) => (
          <>
            <p class="text-xs font-semibold text-text-muted">
              {group.label}
            </p>
            <For each={group.items}>
              {(item) => (
                <A
                  href={item.href}
                  class="flex items-center gap-2 rounded-sm px-2 py-1 text-sm no-underline transition-colors duration-fast"
                  activeClass="bg-surface-raised text-text font-semibold"
                  inactiveClass="text-text-muted hover:text-text"
                >
                  <span
                    class={`${item.icon} icon-sm shrink-0`}
                    aria-hidden="true"
                  />
                  <span class="min-w-0 truncate">{item.name}</span>
                </A>
              )}
            </For>
          </>
        )}
      </For>
    </div>
  );
}

/** Every docs page: the rail on the left, the page on the right. */
function DocsShell(props: { children: JSX.Element }): JSX.Element {
  return (
    <div class="flex min-h-[calc(100dvh-3.5rem)] items-start bg-surface text-text font-sans text-md">
      <DocsRail />
      <div class="min-w-0 flex-1">{props.children}</div>
    </div>
  );
}

/** The components world: the taxonomy rail with a filter, the page beside it. */
function ComponentsShell(props: { children: JSX.Element }): JSX.Element {
  const [query, setQuery] = createSignal("");
  return (
    <div class="flex min-h-[calc(100dvh-3.5rem)] items-start bg-surface text-text font-sans text-md">
      <nav
        class="sticky top-0 flex h-screen w-[16rem] shrink-0 flex-col gap-4 overflow-y-auto border-e border-border px-4 py-6"
        aria-label="components"
      >
        <label class="flex min-w-0 items-center gap-2 rounded-md border border-solid border-border bg-field px-2 py-1 text-xs">
          <span
            class="i-lucide-search icon-sm shrink-0 text-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Filter components..."
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            aria-label="filter components"
            class="w-full border-transparent bg-transparent"
          />
        </label>
        <ComponentsRail filter={query()} />
      </nav>
      <div class="min-w-0 flex-1">{props.children}</div>
    </div>
  );
}

/**
 * The landing owns the viewport; the components world gets the taxonomy
 * rail; every other page gets the guide rail. Reactive on the pathname —
 * navigating back to `/` swaps the shell.
 */
function Layout(props: RouteSectionProps): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = createSignal(false);
  const onNavigate = (href: string) => {
    setSearchOpen(false);
    navigate(href);
  };
  return (
    <div class="min-h-dvh bg-surface text-text font-sans text-md">
      <BrandFavicon getPrimary={activePrimary} />
      <SearchDialog
        open={searchOpen()}
        onClose={() => setSearchOpen(false)}
        onNavigate={onNavigate}
      />
      <Show
        when={location.pathname === "/"}
        fallback={
          <>
            <TopNav onOpenSearch={() => setSearchOpen(true)} />
            <Show
              when={location.pathname.startsWith("/components")}
              fallback={<DocsShell>{props.children}</DocsShell>}
            >
              <ComponentsShell>{props.children}</ComponentsShell>
            </Show>
          </>
        }
      >
        {props.children}
      </Show>
    </div>
  );
}

export function App(): JSX.Element {
  return <Router root={Layout}>{ROUTES}</Router>;
}
