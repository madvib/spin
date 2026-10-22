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
import { For, lazy, Show } from "solid-js";
import { ThemePicker } from "@spin/kit";
import { Logo } from "@spin/kit";

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

/** One entry in the rail: a path, and the pages nested under it. */
interface NavEntry {
  readonly path: string;
  /** The word the rail shows: the last segment of the path. */
  readonly label: string;
  readonly children: NavEntry[];
}

/**
 * The rail's tree, derived from the routes.
 *
 * A path's segments are its nesting, so a section and the pages under it
 * read as one group whether the router nested them (a folder with an index
 * page) or routed them flat (a folder without one). The routes are the only
 * list; the rail is a reading of it.
 */
function navTree(paths: readonly string[]): NavEntry[] {
  const roots: NavEntry[] = [];
  const index = new Map<string, NavEntry>();
  for (const path of paths) {
    const segments = path.split("/").filter((segment) => segment !== "");
    let parent: NavEntry | undefined;
    let walked = "";
    for (const segment of segments) {
      walked += "/" + segment;
      let entry = index.get(walked);
      if (entry === undefined) {
        entry = { path: walked, label: segment, children: [] };
        index.set(walked, entry);
        if (parent === undefined) roots.push(entry);
        else (parent.children as NavEntry[]).push(entry);
      }
      parent = entry;
    }
  }
  return roots;
}

/** The rail's links are the real routes, nested the way their paths nest. */
const NAV: readonly NavEntry[] = navTree(
  ROUTES
    .map((route) => route.path)
    .filter((path): path is string =>
      path !== undefined && path !== "/" && path !== "*" &&
      !path.includes(":")
    )
    .sort(),
);

function RailLayout(props: { children: JSX.Element }): JSX.Element {
  return (
    <div class="flex min-h-dvh bg-surface text-text font-sans text-md">
      <nav
        class="sticky top-0 flex h-screen shrink-0 flex-col gap-6 border-e border-border px-4 py-6"
        aria-label="site"
      >
        <A href="/" end class="flex items-center gap-3 text-text no-underline">
          <Logo size="md" />
        </A>

        <div class="grid gap-1">
          <p class="m-0 text-xs font-semibold text-text-muted">pages</p>
          <For each={NAV}>
            {(entry) => (
              <>
                <A
                  href={entry.path}
                  class="block py-1 px-2 text-sm rounded-sm no-underline transition-colors duration-fast"
                  activeClass="bg-surface-raised text-text font-semibold"
                  inactiveClass="text-text-muted hover:text-text"
                >
                  {entry.label}
                </A>
                <Show when={entry.children.length > 0}>
                  <div class="grid gap-1 pl-4">
                    <For each={entry.children}>
                      {(child) => (
                        <A
                          href={child.path}
                          class="block py-1 px-2 text-xs rounded-sm no-underline transition-colors duration-fast"
                          activeClass="bg-surface-raised text-text font-semibold"
                          inactiveClass="text-text-muted hover:text-text"
                        >
                          {child.label}
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

        {
          /*
          The credit the mark's licence asks for: the web is Lorc's, from the
          Game Icons set, under CC BY 3.0. It is a link, because the licence
          is a promise about where the drawing came from, and the answer is
          one click away.
        */
        }
        <div class="mt-auto grid gap-1">
          <p class="m-0 text-xs text-text-muted">v0.1</p>
          <p class="m-0 text-xs text-text-muted">
            <a
              href="https://game-icons.net/1x1/lorc/spider-web.html"
              target="_blank"
              rel="noreferrer"
              class="no-underline hover:text-text"
            >
              Icons made by Lorc (CC BY 3.0)
            </a>
          </p>
        </div>
      </nav>

      {
        /* `min-w-0`: a flex item's width is its content's minimum unless it
          is told otherwise, so the column beside the rail could not shrink
          and every page scrolled sideways on a narrow screen. */
      }
      <div class="min-w-0 flex-1">{props.children}</div>
    </div>
  );
}

/**
 * The landing owns the whole viewport; every other page is the rail's.
 * Reactive on the pathname — navigating back to `/` swaps the shell.
 */
function Layout(props: RouteSectionProps): JSX.Element {
  const location = useLocation();
  return (
    <Show
      when={location.pathname === "/"}
      fallback={<RailLayout>{props.children}</RailLayout>}
    >
      <div class="min-h-dvh bg-surface text-text font-sans text-md">
        {props.children}
      </div>
    </Show>
  );
}

export function App(): JSX.Element {
  return <Router root={Layout}>{ROUTES}</Router>;
}
