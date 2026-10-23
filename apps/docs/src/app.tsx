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
import { BrandFavicon, Logo, ModeToggle, ThemePicker } from "@spin/kit";
import { NAV_TRACKS } from "./nav.ts";
import { starterDoc } from "./bits.tsx";
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
    const defaultChild = dir === "/guide" ? "install" : children[0].path;
    flat.push({
      ...layout,
      children: [
        { path: "", component: redirect(`${dir}/${defaultChild}`) },
        ...children,
      ],
    });
  }
  flat.push(
    { path: "/guide/themes", component: redirect("/themes") },
    { path: "/guide/verify", component: redirect("/tooling/lints") },
    { path: "/tokens", component: redirect("/utilities") },
    { path: "/tooling", component: redirect("/tooling/lints") },
  );
  return flat;
}

const ROUTES: RouteDefinition[] = buildRoutes();

function RailLayout(props: { children: JSX.Element }): JSX.Element {
  return (
    <div class="flex min-h-dvh bg-surface text-text font-sans text-md">
      <nav
        class="sticky top-0 flex h-screen w-32 shrink-0 flex-col gap-5 overflow-y-auto border-e border-border px-4 py-6"
        aria-label="site"
      >
        <A href="/" end class="no-underline" aria-label="spin home">
          <Logo size="md" class="text-primary" />
        </A>
        <div class="grid gap-4">
          <For each={NAV_TRACKS}>
            {(track) => (
              <div class="grid gap-1">
                <p class="overline">{track.label}</p>
                <For each={track.items}>
                  {(item) => (
                    <A
                      href={item.href}
                      end={item.href === "/" || item.href === "/themes"}
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
        </div>

        <div class="mt-auto grid gap-2 pt-4">
          <hr />
          <ModeToggle />
          <ThemePicker class="min-w-0" triggerClass="w-full justify-between" />
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
    <>
      <BrandFavicon getPrimary={activePrimary} />
      <Show
        when={location.pathname === "/"}
        fallback={<RailLayout>{props.children}</RailLayout>}
      >
        <div class="min-h-dvh bg-surface text-text font-sans text-md">
          {props.children}
        </div>
      </Show>
    </>
  );
}

export function App(): JSX.Element {
  return <Router root={Layout}>{ROUTES}</Router>;
}

/** The active starter's primary, read reactively so the tab icon follows. */
function activePrimary(): string {
  const doc = starterDoc() as unknown as Record<string, unknown>;
  const color = doc["color"] as Record<string, unknown> | undefined;
  const primary = color?.["primary"] as Record<string, unknown> | undefined;
  return typeof primary?.["$value"] === "string"
    ? (primary["$value"] as string)
    : "";
}
