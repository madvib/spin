/**
 * Routes come from the file system, under conventions worth borrowing:
 * `pages/index.tsx` is `/`, `pages/components/[id].tsx` is
 * `/components/:id`, `pages/[...all].tsx` is the miss-everything page, and
 * a `_`-prefixed file is shared code without being a route. Adding a page
 * is adding a file — there is no list to maintain.
 */
import { A, Router, useLocation } from "@solidjs/router";
import type { RouteDefinition, RouteSectionProps } from "@solidjs/router";
import type { JSX } from "solid-js";
import { createMemo, For, lazy } from "solid-js";
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

/** One route per page file, lazily imported. */
const ROUTES: RouteDefinition[] = Object.entries(pages)
  .filter(([file]) => !file.replace(/^.*\//, "").startsWith("_"))
  .map(([file, load]) => ({
    path: routeFromFile(file),
    component: lazy(load),
  }));

/** The rail's links are the real routes: every page, root first. */
const LINKS: readonly string[] = ROUTES
  .map((route) => route.path)
  .filter((path) =>
    path !== undefined && path !== "/" && path !== "*" && !path.includes(":")
  )
  .sort();

const labelFor = (path: string): string =>
  path === "/" ? "home" : path.slice(1);

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
          <For each={LINKS}>
            {(path) => (
              <A
                href={path}
                class="block py-1 px-2 text-sm rounded-sm no-underline transition-colors duration-fast"
                activeClass="bg-surface-raised text-text font-semibold"
                inactiveClass="text-text-muted hover:text-text"
              >
                {labelFor(path)}
              </A>
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
