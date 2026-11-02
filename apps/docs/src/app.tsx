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
import { createEffect, createMemo, createSignal, For, lazy, onCleanup, Show } from "solid-js";
import { BrandFavicon, Logo, theme, ThemePicker } from "@spinjs/kit";
import { starterThemes } from "@spinjs/spin/theme/themes";
import { aliasTarget, themeModes, validateTheme, valuesInMode } from "@spinjs/spin/theme";
import {
  COMPONENT_GROUPS,
  DOCS_GROUPS,
  TOP_SECTIONS,
} from "./nav.ts";
import { SearchDialog } from "./search.tsx";
// The kit's theme controls are compiled elements: registering the two they
// render, so the tags upgrade wherever the chrome puts them.
import "@spinjs/components/mode-picker/examples/basic.html";
import "@spinjs/components/theme-picker/examples/basic.html";
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
    const defaultChild = dir === "/guide" ? "markup" : children[0].path;
    flat.push({
      ...layout,
      children: [
        { path: "", component: redirect(`${dir}/${defaultChild}`) },
        ...children,
      ],
    });
  }
  flat.push(
    { path: "/why", component: redirect("/start") },
    { path: "/guide/install", component: redirect("/start/install") },
    { path: "/guide/themes", component: redirect("/themes") },
    { path: "/guide/verify", component: redirect("/tooling/lints") },
    { path: "/tokens", component: redirect("/utilities") },
    { path: "/tooling", component: redirect("/tooling/lints") },
  );
  return flat;
}

const ROUTES: RouteDefinition[] = buildRoutes();

/** The primary color of the active starter, for the tab icon. */
function activePrimary(): string {
  const doc = starterThemes[theme() as string] as
    | { color?: { primary?: { $value?: unknown } } }
    | undefined;
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
  const isHome = () => location.pathname === "/";
  return (
    <header
      class={`shrink-0 z-dropdown flex h-[3.5rem] items-center justify-between gap-4 border-b px-4 md:px-6 ${
        isHome()
          ? "border-transparent bg-transparent"
          : "border-border bg-surface"
      }`}
    >
      <div class="flex min-w-0 items-center gap-4">
        <A href="/" end class="shrink-0 no-underline" aria-label="spin home">
          <Logo size="md" class="text-text" />
        </A>
        <nav class="flex items-center gap-1" aria-label="sections">
          <For each={TOP_SECTIONS}>
            {(section) => (
              <A
                href={section.href}
                class={`block rounded-sm px-3 py-1 text-sm no-underline transition-colors duration-fast ${
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
          class="bare inline-flex items-center gap-2 rounded-lg border border-solid border-border bg-surface px-2 py-1 text-sm text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
        >
          <span>Search...</span>
          <kbd>
            ⌘K
          </kbd>
        </button>
        <ThemePicker />
      </div>
    </header>
  );
}

/** The Docs world's rail: the guide groups, with the current page raised. */
function DocsRail(): JSX.Element {
  return (
    <nav
      class="sticky top-0 flex h-full w-[14rem] shrink-0 flex-col gap-5 overflow-y-auto border-e border-border px-4 py-6"
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
 * The Components world's rail: the unified taxonomy, filterable by kind and
 * name, with the current element raised. The groups are the shared table
 * the studio's rail reads, so the rail cannot file an element where another
 * surface files it elsewhere.
 */
export type ComponentKindFilter = "all" | "primitive" | "machine";
function kindOfHref(href: string): "primitive" | "machine" {
  return href.includes("/machine-") ? "machine" : "primitive";
}
function ComponentsRail(props: {
  filter: string;
  kind: ComponentKindFilter;
  onKind: (kind: ComponentKindFilter) => void;
}): JSX.Element {
  const groups = createMemo(() => {
    const query = props.filter.trim().toLowerCase();
    return COMPONENT_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (props.kind === "all" || kindOfHref(item.href) === props.kind) &&
          (query === "" || item.name.toLowerCase().includes(query)),
      ),
    })).filter((group) => group.items.length > 0);
  });
  return (
    <div class="grid gap-1">
      <div role="group" aria-label="Component kind" class="flex gap-1">
        <For each={(["all", "primitive", "machine"] as const)}>
          {(kind) => (
            <button
              type="button"
              aria-pressed={props.kind === kind}
              onClick={() => props.onKind(kind)}
              class="bare rounded-sm px-2 py-1 text-xs text-text-muted hover:text-text aria-[pressed=true]:bg-surface-raised aria-[pressed=true]:text-text aria-[pressed=true]:font-medium"
            >
              {kind === "all" ? "all" : kind === "primitive" ? "elements" : "machines"}
            </button>
          )}
        </For>
      </div>
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
    <div class="flex h-full min-h-0 items-start overflow-y-auto bg-surface text-text font-sans text-md">
      <DocsRail />
      <div class="min-w-0 flex-1">{props.children}</div>
    </div>
  );
}

/** The components world: the taxonomy rail with a filter, the page beside it. */
function ComponentsShell(props: { children: JSX.Element }): JSX.Element {
  const [query, setQuery] = createSignal("");
  const [kind, setKind] = createSignal<ComponentKindFilter>("all");
  return (
    <div class="flex h-full min-h-0 items-start overflow-y-auto bg-surface text-text font-sans text-md">
      <nav
        class="sticky top-0 flex h-full w-56 shrink-0 flex-col gap-4 overflow-y-auto border-e border-border px-4 py-6"
        aria-label="components"
      >
        <input
          type="search"
          placeholder="Filter components..."
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          aria-label="filter components"
          class="s-sm w-full"
        />
        <ComponentsRail filter={query()} kind={kind()} onKind={setKind} />
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

/** Resolved token value for a theme, references followed. */
function tokenValue(tree: unknown, mode: string, path: string): string | undefined {
  const effective = valuesInMode(tree as never, mode);
  const seen = new Set<string>();
  let cursor = path;
  for (;;) {
    if (seen.has(cursor)) return undefined;
    seen.add(cursor);
    const raw = effective.get(cursor);
    if (raw === undefined) return undefined;
    const value =
      typeof raw === "string" || typeof raw === "number"
        ? String(raw)
        : JSON.stringify(raw);
    const target = aliasTarget(value);
    if (target === null) return value;
    cursor = target;
  }
}

function Layout(props: RouteSectionProps): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = createSignal(false);
  createEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });
  createEffect(() => {
    let style = document.getElementById("docs-theme-swatches");
    if (style === null) {
      style = document.createElement("style");
      style.id = "docs-theme-swatches";
      document.head.appendChild(style);
    }
    const rules: string[] = [];
    for (const [name, doc] of Object.entries(starterThemes)) {
      const { tree } = validateTheme(JSON.stringify(doc));
      if (tree === undefined) continue;
      const modes = themeModes(doc as never);
      const mode = modes[0] ?? "light";
      const decl = (path: string, prop: string): string => {
        const value = tokenValue(tree, mode, path);
        return value === undefined ? "" : `${prop}: ${value};`;
      };
      rules.push(
        `[data-swatch-theme="${name}"] { ${decl("color.surface", "--color-surface")} ${decl("color.primary", "--color-primary")} ${decl("color.on-primary", "--color-on-primary")} ${decl("color.text", "--color-text")} ${decl("color.border", "--color-border")} }`,
      );
    }
    style.textContent = rules.join("\n");
  });
  const onNavigate = (href: string) => {
    setSearchOpen(false);
    navigate(href);
  };
  return (
    <div class="flex h-dvh flex-col overflow-hidden bg-surface text-text font-sans text-md">
      <BrandFavicon getPrimary={activePrimary} />
      <SearchDialog
        open={searchOpen()}
        onClose={() => setSearchOpen(false)}
        onNavigate={onNavigate}
      />
      <TopNav onOpenSearch={() => setSearchOpen(true)} />
      <div class="min-h-0 flex-1">
        <Show
          when={location.pathname === "/"}
          fallback={
            <Show
              when={location.pathname.startsWith("/components")}
              fallback={<DocsShell>{props.children}</DocsShell>}
            >
              <ComponentsShell>{props.children}</ComponentsShell>
            </Show>
          }
        >
          <div class="h-full overflow-y-auto">{props.children}</div>
        </Show>
      </div>
    </div>
  );
}

export function App(): JSX.Element {
  // The site serves from the build's base: `/` on its own domain, `/spin/`
  // under project pages. The router strips the base before matching, so
  // every route and link below reads base-free and the deploy moves by
  // changing the build's `--base`, not the site's links.
  const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
  return (
    <Router root={Layout} base={base}>
      {ROUTES}
    </Router>
  );
}
