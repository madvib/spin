/**
 * Routes come from the file system, under conventions worth borrowing:
 * `pages/index.tsx` is `/`, `pages/components/[id].tsx` is
 * `/components/:id`, `pages/[...all].tsx` is the miss-everything page, a
 * `_`-prefixed file is shared code without being a route, and a folder
 * nests: its `index.tsx` is the parent page, its siblings the sections.
 * Adding a page is adding a file — there is no list to maintain.
 */
import { A, Navigate, Router, useLocation } from "@solidjs/router";
import type { RouteDefinition, RouteSectionProps } from "@solidjs/router";
import type { JSX } from "solid-js";
import { createMemo, For, lazy, Show } from "solid-js";
import { ThemePicker } from "@spin/kit";
import { Mark } from "./mark.tsx";

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

/** The rail's links are the real routes: every top-level page, sections
 * nesting under their folder. */
const NAV: readonly RouteDefinition[] = [...ROUTES]
  .filter((route) =>
    route.path !== undefined && route.path !== "/" && route.path !== "*" &&
    !route.path.includes(":")
  )
  .sort((a, b) => (a.path ?? "").localeCompare(b.path ?? ""));

function Layout(props: RouteSectionProps): JSX.Element {
  const location = useLocation();
  const landing = createMemo(() => location.pathname === "/");

  // The landing owns the whole viewport; every other page is the rail's.
  if (landing()) {
    return (
      <div class="min-h-dvh bg-surface text-text font-sans text-md">
        {props.children}
      </div>
    );
  }

  return (
    <div class="flex min-h-dvh bg-surface text-text font-sans text-md">
      <nav
        class="sticky top-0 flex h-screen shrink-0 flex-col gap-6 border-e border-border px-4 py-6"
        aria-label="site"
      >
        <A href="/" end class="flex items-center gap-3 text-text no-underline">
          <Mark class="h-8 w-8" />
          <span class="font-heading text-lg tracking-tighter">spin</span>
        </A>

        <div class="grid gap-1">
          <p class="m-0 text-xs font-semibold text-text-muted">pages</p>
          <For each={NAV}>
            {(route) => (
              <>
                <A
                  href={route.path as string}
                  class="block py-1 px-2 text-sm rounded-sm no-underline transition-colors duration-fast"
                  activeClass="bg-surface-raised text-text font-semibold"
                  inactiveClass="text-text-muted hover:text-text"
                >
                  {route.path?.slice(1)}
                </A>
                <Show
                  when={Array.isArray(route.children) &&
                    route.children.length > 0}
                >
                  <div class="grid gap-1 pl-4">
                    <For
                      each={(route.children as RouteDefinition[]).filter(
                        (child) => child.path && child.path !== "",
                      )}
                    >
                      {(child) => (
                        <A
                          href={`${route.path}/${child.path}`}
                          class="block py-1 px-2 text-xs rounded-sm no-underline transition-colors duration-fast"
                          activeClass="bg-surface-raised text-text font-semibold"
                          inactiveClass="text-text-muted hover:text-text"
                        >
                          {child.path}
                        </A>
                      )}
                    </For>
                  </div>
                </Show>
              </>
            )}
          </For>
        </div>

        <div class="grid gap-2">
          <p class="m-0 text-xs font-semibold text-text-muted">theme</p>
          <ThemePicker />
        </div>

        <p class="m-0 mt-auto text-xs text-text-muted">v0.1</p>
      </nav>

      <div class="flex-1">{props.children}</div>
    </div>
  );
}

export function App(): JSX.Element {
  return <Router root={Layout}>{ROUTES}</Router>;
}
