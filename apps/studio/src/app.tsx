/**
 * The studio shell.
 *
 * The studio is a tool pointed at a project, not the project. That distinction
 * is structural here: the chrome renders under its own static theme
 * (`data-theme="studio"`), and only the preview follows the picker. Editing a
 * theme therefore cannot restyle the tool you are editing it with, which is
 * what makes a broken theme recoverable.
 */

import { MetaProvider, Title } from "@solidjs/meta";
import { A, Route, Router } from "@solidjs/router";
import ColorsPage from "./routes/colors.tsx";
import TypePage from "./routes/type.tsx";
import IconsPage from "./routes/icons.tsx";
import MotionPage from "./routes/motion.tsx";
import SpacingPage from "./routes/spacing.tsx";
import StylePage from "./routes/style.tsx";
import ComponentsLayout from "./routes/components.tsx";
import ComponentsIndex from "./routes/components/index.tsx";
import ComponentPage from "./routes/components/[name].tsx";
import OverviewPage from "./routes/index.tsx";
import PreferencesPage from "./routes/preferences.tsx";
import { createResource, createSignal, For, Show, Suspense } from "solid-js";
import type { Component } from "solid-js";
import "uno.css";
import PreviewStyles from "./components/PreviewStyles.tsx";
import {
  CONCERNS,
  FOOT,
  MARK,
  ROUTES,
  type RoutePath,
} from "./lib/routes.ts";

import { listProjectThemes, saveTheme } from "./lib/themes.ts";
import {
  activeMode,
  activeName,
  canRedo,
  canUndo,
  dockSide,
  isDirty,
  markSaved,
  redo,
  themeText,
  undo,
} from "./lib/store.ts";

/**
 * The chrome's own theme. A constant rather than a lookup, so the shell does
 * not depend on discovery having succeeded before it can render.
 */
const STUDIO_THEME = "studio";

/**
 * Whether the studio runs in the host's drawer.
 *
 * The overlay names `mode=` in the iframe URL, so the studio lays itself
 * out for the edge it occupies rather than guessing from its own width: a
 * drawer is narrow because the host made it narrow, and the pages get a
 * different layout there rather than a squeezed one.
 */
const [hostMode, setHostMode] = createSignal<"drawer" | "modal">(
  new URLSearchParams(location.search).get("mode") === "drawer"
    ? "drawer"
    : "modal",
);

// The host shell announces mode switches without reloading the frame: the
// layout re-branches in place, which is the whole reason the toggles feel
// instant instead of rebooting the studio.
if (typeof window !== "undefined") {
  globalThis.addEventListener("message", (event) => {
    if (event.data === "spin:mode-drawer") setHostMode("drawer");
    if (event.data === "spin:mode-modal") setHostMode("modal");
  });
}

/** Whether the studio runs in the host's drawer. Pages lay out for it. */
export function inDrawer(): boolean {
  return hostMode() === "drawer";
}

// The rail reads the route table rather than keeping its own copy of the
// paths: a concern the rail offers and a route the router serves are the
// same fact, stated once. Each glyph is still a whole utility class in
// `routes.ts` rather than a name joined at runtime, because the scanner
// reads source text and `i-lucide-${icon}` styles nothing.

/**
 * The page each route renders.
 *
 * Keyed by the path, exhaustively: a route in the table with no page under
 * it is a missing key and fails the build, and a page under a path the table
 * does not serve is an extra key and fails it too. The paths themselves are
 * not written here at all — `ROUTES` is the only place they live.
 */
const PAGES = {
  "/": OverviewPage,
  "/preferences": PreferencesPage,
  "/icons": IconsPage,
  "/colors": ColorsPage,
  "/type": TypePage,
  "/style": StylePage,
  "/spacing": SpacingPage,
  "/motion": MotionPage,
  "/components": ComponentsLayout,
} satisfies Record<RoutePath, Component>;

type RouteEntry = (typeof ROUTES)[number];

/**
 * The paths a route's children become, as types.
 *
 * Derived from the table rather than spelled out: `""` under `/components`
 * is `/components`, `/:name` under it is `/components/:name`, and the pages
 * both need are enforced by the record below instead of by someone
 * remembering which child is which. Distributed over the union, so one
 * route's children cannot leak into another's paths.
 */
type ChildPath = RouteEntry extends {
  children: readonly (infer Child)[];
} ? `${RouteEntry["path"]}${Child & string}` : never;

/** The page each child pattern renders, keyed by the path it becomes. */
const CHILDREN = {
  "/components": ComponentsIndex,
  "/components/:name": ComponentPage,
} satisfies Record<ChildPath, Component>;

/**
 * A child's page, read by the path it becomes under its parent.
 *
 * The key is the whole path — `/components/:name`, not `:name` — so two
 * routes could each carry a `:id` without them sharing a page. The cast is
 * safe in the direction it covers: the record's keys are exactly the
 * composite paths this table declares, so a child with no page under it is a
 * missing key at build time and a lookup that misses cannot be reached.
 */
function childPage(path: string, child: string): Component {
  return CHILDREN[`${path}${child}` as ChildPath];
}

export default function App() {
  // The path is the daemon's answer, project-relative: it states the layout
  // of a project rather than of the machine the studio happens to run on.
  const [themes] = createResource(listProjectThemes);
  const activePath = () =>
    themes()?.find((theme) => theme.name === activeName())?.file;

  return (
    <Router
      // The bundle is served under `/__spin/studio/`; dev serves at `/`.
      // Vite injects the build's base here, so one line covers both.
      base={import.meta.env.BASE_URL.replace(/\/$/, "")}
      root={(props) => (
        <MetaProvider>
          <Title>spin theme studio</Title>
          {
            /* The chrome is themed by the studio, never by the project, so a
              broken project theme cannot break the tool. */
          }
          <div
            data-theme={STUDIO_THEME}
            // The studio's theme, never the project's, but the picker's mode:
            // a chrome that stayed light around a dark pane split every label
            // from its paper.
            data-mode={activeMode()}
            // Declared, not inherited: <html> is stamped light in index.html
            // and never changes, so a themed host that stays quiet inherits
            // the document root's ink instead of its own.
            class="flex bg-surface text-text"
            // A row, not a stack: the rail takes an edge and the preview
            // takes the rest. In the drawer the rail mirrors to the outer
            // edge — the host's drawer is right-anchored, so a left rail
            // traps the content between chrome and the viewport edge.
            classList={{
              "h-screen": !inDrawer(),
              "min-h-full": inDrawer(),
              "flex-row-reverse": inDrawer() && dockSide() === "right",
              "drawer-flow": inDrawer(),
            }}
          >
            {
              /*
              The rail is an icon strip: concerns above, editing below. No
              labels, no pickers, no header bar — the strip is a margin, and
              a button with a name on it is a panel competing with the page.
              Save, undo and redo are glyphs like everything else here; the
              theme picker and the mode control live on the home page, where
              choosing what to edit is the job.
            */
            }
            <nav
              aria-label="Studio"
              class="sticky top-0 flex h-screen w-12 shrink-0 flex-col items-center gap-1 overflow-hidden border-border bg-surface-raised py-2"
              classList={{
                "border-r": !inDrawer() || dockSide() === "left",
                "border-l": inDrawer() && dockSide() === "right",
              }}
            >
              <A
                href={MARK.path}
                class="row-sm mb-2 shrink-0 justify-center font-semibold"
                title={MARK.label}
              >
                <span
                  class={`inline-block icon-md shrink-0 ${MARK.icon} text-text`}
                  aria-hidden="true"
                />
              </A>
              <ul class="flow-list stack-sm shrink-0 items-center">
                <For each={CONCERNS}>
                  {(route) => (
                    <li>
                      <A
                        href={route.path}
                        activeClass="text-text font-semibold underline"
                        inactiveClass="text-text"
                        class="row-sm justify-center"
                        title={route.label}
                      >
                        <span
                          class={`inline-block shrink-0 icon-md ${route.icon}`}
                          aria-hidden="true"
                        />
                      </A>
                    </li>
                  )}
                </For>
              </ul>
              <div class="stack-sm mt-auto shrink-0 items-center border-t border-border pt-2">
                <button
                  type="button"
                  class="bare shrink-0 text-text"
                  onClick={() => undo()}
                  disabled={!canUndo()}
                  aria-label="Undo"
                  title="Undo"
                >
                  <span
                    class="inline-block icon-md i-lucide-undo-2"
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  class="bare shrink-0 text-text"
                  onClick={() => redo()}
                  disabled={!canRedo()}
                  aria-label="Redo"
                  title="Redo"
                >
                  <span
                    class="inline-block icon-md i-lucide-redo-2"
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  class="bare shrink-0 text-text"
                  onClick={async () => {
                    const name = activeName();
                    const written = await saveTheme(name, themeText());
                    if (written.error === null) markSaved(name);
                  }}
                  disabled={!isDirty(activeName())}
                  aria-label="Save to disk"
                  title={isDirty(activeName()) ? "Save to disk" : "Saved"}
                >
                  <span
                    class="inline-block icon-md i-lucide-save"
                    aria-hidden="true"
                  />
                </button>
                <A
                  href={FOOT.path}
                  activeClass="text-text font-semibold underline"
                  inactiveClass="text-text"
                  class="row-sm justify-center"
                  title={FOOT.label}
                >
                  <span
                    class={`inline-block icon-md ${FOOT.icon}`}
                    aria-hidden="true"
                  />
                </A>
              </div>
            </nav>
            {
              /* The preview carries the project's theme. Everything above is
                chrome and stays on the studio's own. */
            }
            <div
              data-theme={activeName()}
              data-mode={activeMode()}
              // Same debt as the chrome's: <html> is stamped light, so a
              // label that only inherits keeps that ink on a dark surface.
              class="flex min-h-0 min-w-0 flex-1 flex-col text-text"
            >
              <Show
                when={new URLSearchParams(location.search).get("app") !== null}
              >
                <div class="flex shrink-0 items-center justify-end gap-1 border-b border-border bg-surface px-2 py-1">
                  <button
                    type="button"
                    class="bare shrink-0 text-text"
                    aria-label={inDrawer() ? "Modal" : "Drawer"}
                    title={inDrawer() ? "Modal" : "Drawer"}
                    onClick={() => {
                      const next = inDrawer() ? "modal" : "drawer";
                      setHostMode(next);
                      globalThis.parent.postMessage(
                        next === "modal" ? "spin:modal" : "spin:drawer",
                        "*",
                      );
                    }}
                  >
                    <span
                      class="inline-block icon-md i-lucide-panel-right"
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    class="bare shrink-0 text-text"
                    aria-label="Close"
                    title="Close"
                    onClick={() => globalThis.parent.postMessage("spin:close", "*")}
                  >
                    <span
                      class="inline-block icon-md i-lucide-x"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </Show>
              <PreviewStyles />
              <Suspense>{props.children}</Suspense>
            </div>
          </div>
        </MetaProvider>
      )}
    >
      {
        /* The router renders the same table the rail and the links read, so
          a route cannot exist without the rail being able to name it, and a
          path cannot be written here that the table has not declared. A
          route's children come from its entry: the index (`""`) and the
          detail pattern (`/:name`) are both children, and both are pages the
          record above must have. */
      }
      <For each={ROUTES}>
        {(route) => (
          <Route path={route.path} component={PAGES[route.path]}>
            {("children" in route ? route.children : []).map((child) => (
              <Route
                path={child}
                component={childPage(route.path, child)}
              />
            ))}
          </Route>
        )}
      </For>
    </Router>
  );
}
