/**
 * Filesystem router with nested `_layout.tsx` support:
 * - `pages/index.tsx` is `/`
 * - `pages/docs/_layout.tsx` wraps all `/docs/**` subgroup routes in the 3-column `DocsLayout`
 * - `pages/components/_layout.tsx` wraps `/components` and `/components/:id` in `ComponentsLayout`
 * - `pages/playground.tsx` is `/playground`
 * - `pages/studio.tsx` is `/studio`
 * - `pages/[...all].tsx` is the catch-all 404 route
 */
import { A, Navigate, Router, useLocation, useNavigate } from "@solidjs/router";
import type { RouteDefinition, RouteSectionProps } from "@solidjs/router";
import type { JSX } from "solid-js";
import { createEffect, createSignal, For, lazy, onCleanup, Show } from "solid-js";
import { BrandFavicon, Logo, mode, theme, ThemePicker } from "@spinjs/kit";
import {
  aliasTarget,
  demoPalettes,
  designLanguages,
  isDesignLanguage,
  parseTokens,
  resolveTheme,
  themeModes,
  validateTheme,
  valuesInMode,
} from "@spinjs/theme";
import {
  ComponentsRail,
  type ComponentKindFilter,
} from "./layouts/components-layout.tsx";
import { DocsRail } from "./layouts/docs-layout.tsx";
import {
  LEGACY_DOCS_REDIRECTS,
  TOP_SECTIONS,
} from "./shell/nav.ts";
import { SearchDialog } from "./shell/search.tsx";
import "@spinjs/components/mode-picker/examples/basic.html";
import "@spinjs/components/theme-picker/examples/basic.html";

function segmentToRoute(segment: string): string {
  if (segment.startsWith("[...")) return "*";
  if (segment.startsWith("[")) return ":" + segment.slice(1, -1);
  return segment;
}

const pages = import.meta.glob<{ default: (props: RouteSectionProps) => JSX.Element }>(
  "./pages/**/*.tsx",
);

function buildRoutes(): RouteDefinition[] {
  const redirect = (to: string): () => JSX.Element => () => (
    <Navigate href={to} />
  );

  const layouts = new Map<
    string,
    { component: ReturnType<typeof lazy>; children: RouteDefinition[] }
  >();

  for (const [file, load] of Object.entries(pages)) {
    const rel = file.slice("./pages/".length, -".tsx".length);
    const segments = rel.split("/");
    const base = segments[segments.length - 1] ?? "";
    if (base === "_layout") {
      const dir = "/" + segments.slice(0, -1).join("/");
      layouts.set(dir, { component: lazy(load), children: [] });
    }
  }

  const layoutDirs = [...layouts.keys()].sort((a, b) => b.length - a.length);
  const flat: RouteDefinition[] = [];

  for (const [file, load] of Object.entries(pages)) {
    const rel = file.slice("./pages/".length, -".tsx".length);
    const segments = rel.split("/");
    const base = segments[segments.length - 1] ?? "";
    if (base.startsWith("_")) continue;

    const fullSegments = segments
      .filter((s) => s !== "index")
      .map(segmentToRoute);
    const fullPath =
      fullSegments.join("/") === "*" ? "*" : "/" + fullSegments.join("/");

    const matchedDir = layoutDirs.find(
      (dir) => fullPath === dir || fullPath.startsWith(`${dir}/`),
    );

    if (matchedDir !== undefined) {
      const entry = layouts.get(matchedDir)!;
      const childRel = fullPath === matchedDir
        ? ""
        : fullPath.slice(matchedDir.length + 1);
      entry.children.push({
        path: childRel,
        component: lazy(load),
      });
    } else {
      flat.push({
        path: fullPath,
        component: lazy(load),
      });
    }
  }

  for (const [dir, entry] of layouts) {
    if (dir === "/docs") {
      entry.children.push(
        { path: "", component: redirect("/docs/getting-started/overview") },
        {
          path: "getting-started",
          component: redirect("/docs/getting-started/overview"),
        },
        { path: "themes", component: redirect("/docs/themes/overview") },
        {
          path: "themes/authoring",
          component: redirect("/docs/themes/validation"),
        },
        {
          path: "themes/schema",
          component: redirect("/docs/themes/reference"),
        },
        {
          path: "themes/languages",
          component: redirect("/docs/themes/overview"),
        },
        {
          path: "themes/styles",
          component: redirect("/docs/themes/customization"),
        },
        { path: "styling", component: redirect("/docs/styling/elements") },
        {
          path: "authoring",
          component: redirect("/docs/authoring/components"),
        },
        { path: "tooling", component: redirect("/docs/tooling/lints") },
      );
    }
    flat.push({
      path: dir,
      component: entry.component,
      children: entry.children,
    });
  }

  for (const [from, to] of Object.entries(LEGACY_DOCS_REDIRECTS)) {
    if (from === "/docs" || from.startsWith("/docs/")) continue;
    flat.push({ path: from, component: redirect(to) });
  }

  return flat;
}

const ROUTES: RouteDefinition[] = buildRoutes();

function activePrimary(): string {
  const name = theme();
  const doc = isDesignLanguage(name) ? designLanguages[name] : designLanguages.editorial;
  const value = resolveTheme(doc, "light").values["color.primary"];
  return typeof value === "string" ? value : "";
}

function TopNav(props: {
  onOpenSearch: () => void;
  mobileNavOpen: boolean;
  onToggleMobileNav: () => void;
}): JSX.Element {
  const location = useLocation();
  const current = (prefixes: readonly string[]): boolean =>
    prefixes.some(
      (prefix) =>
        location.pathname === prefix ||
        location.pathname.startsWith(`${prefix}/`),
    );
  const isHome = () => location.pathname === "/" && !props.mobileNavOpen;
  return (
    <header
      class={`shrink-0 z-dropdown flex h-[3.5rem] items-center justify-between gap-2 border-b px-4 md:gap-4 md:px-6 ${
        isHome()
          ? "border-transparent bg-transparent"
          : "border bg-surface"
      }`}
    >
      <div class="flex min-w-0 items-center gap-4">
        <div class="flex shrink-0 items-center gap-2">
          <A href="/" end class="shrink-0 no-underline" aria-label="spin home">
            <Logo size="md" />
          </A>
          <badge class="s-sm badge-accent-muted">alpha</badge>
        </div>
        <nav class="hidden items-center gap-1 md:flex" aria-label="sections">
          <For each={TOP_SECTIONS}>
            {(section) => (
              <A
                href={section.href}
                class={`block rounded-sm px-3 py-1 type-label no-underline transition-colors duration-fast ${
                  current(section.active)
                    ? "bg-surface-raised text-primary"
                    : "text-muted"
                }`}
              >
                {section.title}
              </A>
            )}
          </For>
        </nav>
      </div>
      <div class="hidden shrink-0 items-center gap-2 md:flex">
        <button
          type="button"
          onClick={props.onOpenSearch}
          aria-label="Search documentation"
          class="bare inline-flex h-8 items-center gap-3 rounded-md border bg-surface px-3 type-label text-muted transition-colors hover:bg-surface-raised"
        >
          <span class="i-lucide-search icon-sm shrink-0" aria-hidden="true" />
          <span>Search</span>
          <kbd>⌘K</kbd>
        </button>
        <ThemePicker />
        <a
          href="https://github.com/madvib/spin"
          target="_blank"
          rel="noreferrer"
          role="button"
          aria-label="Spin on GitHub"
          title="View source on GitHub"
          class="ghost icon s-sm"
        >
          <svg viewBox="0 0 24 24" class="icon-sm" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
        </a>
      </div>
      <button
        type="button"
        onClick={props.onToggleMobileNav}
        aria-expanded={props.mobileNavOpen}
        aria-label="Toggle navigation menu"
        class="bare inline-flex h-8 w-8 items-center justify-center rounded-md border bg-surface p-0 transition-colors hover:bg-surface-raised md:hidden"
      >
        <span
          class={
            props.mobileNavOpen
              ? "i-lucide-x icon-sm"
              : "i-lucide-menu icon-sm"
          }
          aria-hidden="true"
        />
      </button>
    </header>
  );
}

function tokenValue(
  tree: unknown,
  mode: string,
  path: string,
): string | undefined {
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
  const [mobileNavOpen, setMobileNavOpen] = createSignal(false);
  const [mobileCompQuery, setMobileCompQuery] = createSignal("");
  const [mobileCompKind, setMobileCompKind] =
    createSignal<ComponentKindFilter>("all");

  createEffect(() => {
    void location.pathname;
    setMobileNavOpen(false);
  });

  createEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (event.key === "Escape" && mobileNavOpen()) {
        setMobileNavOpen(false);
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
    const activeMode = mode() === "dark" ? "dark" : "light";
    const rules: string[] = [];
    for (const [name, doc] of Object.entries(designLanguages)) {
      const { tree } = validateTheme(JSON.stringify(doc));
      if (tree === undefined) continue;
      const modes = themeModes(doc as never);
      const swatchMode = modes.includes(activeMode) ? activeMode : (modes[0] ?? "light");
      const decl = (path: string, prop: string): string => {
        const value = tokenValue(tree, swatchMode, path);
        return value === undefined ? "" : `${prop}: ${value};`;
      };
      rules.push(
        `[data-swatch-theme="${name}"] { ${decl("color.surface", "--color-surface")} ${decl("color.primary", "--color-primary")} ${decl("color.accent", "--color-accent")} ${decl("color.on-primary", "--color-on-primary")} ${decl("color.text", "--color-text")} ${decl("color.border", "--color-border")} }`,
      );
    }
    for (const [name, doc] of Object.entries(demoPalettes)) {
      const parsed = parseTokens(doc);
      if (!parsed.ok) continue;
      const modes = themeModes(doc as never);
      const swatchMode = modes.includes(activeMode) ? activeMode : (modes[0] ?? "light");
      const decl = (path: string, prop: string): string => {
        const value = tokenValue(parsed.tree, swatchMode, path);
        return value === undefined ? "" : `${prop}: ${value};`;
      };
      rules.push(
        `[data-swatch-palette="${name}"] { ${decl("color.surface", "--color-surface")} ${decl("color.primary", "--color-primary")} ${decl("color.accent", "--color-accent")} }`,
      );
    }
    style.textContent = rules.join("\n");
  });

  const onNavigate = (href: string) => {
    setSearchOpen(false);
    setMobileNavOpen(false);
    navigate(href);
  };

  return (
    <div class="flex h-dvh flex-col overflow-hidden bg-surface">
      <BrandFavicon getPrimary={activePrimary} />
      <SearchDialog
        open={searchOpen()}
        onClose={() => setSearchOpen(false)}
        onNavigate={onNavigate}
      />
      <TopNav
        onOpenSearch={() => setSearchOpen(true)}
        mobileNavOpen={mobileNavOpen()}
        onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
      />
      <div class="relative min-h-0 flex-1">
        <Show when={mobileNavOpen()}>
          <nav
            aria-label="Mobile navigation"
            class="absolute inset-0 z-modal flex flex-col gap-4 overflow-y-auto bg-surface px-4 py-4 md:hidden"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  setSearchOpen(true);
                }}
                 class="bare inline-flex flex-1 items-center gap-2 rounded-lg border bg-surface px-3 py-1 type-code text-muted transition-colors hover:bg-surface-raised"
              >
                <span class="i-lucide-search icon-sm" aria-hidden="true" />
                <span>Search...</span>
              </button>
              <ThemePicker />
              <a
                href="https://github.com/madvib/spin"
                target="_blank"
                rel="noreferrer"
                role="button"
                aria-label="Spin on GitHub"
                class="ghost icon s-sm"
              >
                <svg viewBox="0 0 24 24" class="icon-sm" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
                </svg>
              </a>
            </div>
            <div class="flex flex-wrap gap-1 border-b pb-3">
              <For each={TOP_SECTIONS}>
                {(section) => (
                  <A
                    href={section.href}
                    onClick={() => setMobileNavOpen(false)}
                    class={`block rounded-sm px-3 py-1 type-label no-underline transition-colors duration-fast ${
                      section.active.some(
                        (prefix) =>
                          location.pathname === prefix ||
                          location.pathname.startsWith(`${prefix}/`),
                      )
                        ? "bg-surface-raised text-primary"
                        : "text-muted"
                    }`}
                  >
                    {section.title}
                  </A>
                )}
              </For>
            </div>
            <Show
              when={location.pathname.startsWith("/components")}
              fallback={<DocsRail onSelect={() => setMobileNavOpen(false)} />}
            >
              <div class="flex flex-col gap-3">
                <input
                  type="search"
                  placeholder="Filter components..."
                  value={mobileCompQuery()}
                  onInput={(event) =>
                    setMobileCompQuery(event.currentTarget.value)
                  }
                  aria-label="filter components"
                  class="s-sm w-full"
                />
                <ComponentsRail
                  filter={mobileCompQuery()}
                  kind={mobileCompKind()}
                  onKind={setMobileCompKind}
                  onSelect={() => setMobileNavOpen(false)}
                />
              </div>
            </Show>
          </nav>
        </Show>

        <div class="h-full overflow-y-auto">{props.children}</div>
      </div>
    </div>
  );
}

export function App(): JSX.Element {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
  return (
    <Router root={Layout} base={base}>
      {ROUTES}
    </Router>
  );
}
