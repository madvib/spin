/**
 * The studio shell.
 *
 * The studio is a tool pointed at a project, not the project. That distinction
 * is structural here: the chrome renders under its own static theme
 * (`data-theme="studio"`), and only the preview follows the picker. Editing a
 * theme therefore cannot restyle the tool you are editing it with, which is
 * what makes a broken theme recoverable.
 *
 * The chrome is three pieces and each of them has one job. The rail on the
 * edge is navigation: the mark that goes home, the concerns the project
 * is filed by, and the studio's own verbs at its foot. The column is the
 * work: the preview of the document being edited. The bar along the bottom
 * is the state: what is being edited, what is true about the file, and the
 * verbs that change it.
 */

import { MetaProvider, Title } from "@solidjs/meta";
import { A, Route, Router } from "@solidjs/router";
import { Web } from "@spin/kit";
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
import { For, Show, Suspense } from "solid-js";
import type { Component } from "solid-js";
import "uno.css";
import PreviewStyles from "./components/PreviewStyles.tsx";
import StatusBar from "./components/StatusBar.tsx";
import { CONCERNS, FOOT, MARK, type RoutePath, ROUTES } from "./lib/routes.ts";

import {
  activeMode,
  activeName,
  dockSide,
  lastNotice,
  lastRefusal,
} from "./lib/store.ts";
import { closeStudio, embedded, inDrawer, toggleHostMode } from "./lib/host.ts";
import { hostPath } from "./lib/client.ts";

/**
 * The chrome's own theme. A constant rather than a lookup, so the shell does
 * not depend on discovery having succeeded before it can render.
 */
const STUDIO_THEME = "studio";

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
} ? `${RouteEntry["path"]}${Child & string}`
  : never;

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

/**
 * The name of a rail row, as a tip that opens BESIDE the row.
 *
 * A native `title` is what every icon control in the studio carries, and it
 * is what the pointer reads. It cannot serve the keyboard: no browser shows a
 * `title` on focus, so a reader who tabs the rail would have to remember
 * every glyph it passes. This is the system's own tooltip primitive — the
 * same element spin uses everywhere — set beside the row rather than under
 * it, because the rail hugs the edge of the viewport and a tip that hung off
 * the outer edge would fall off the screen. In the drawer the rail mirrors to
 * the right edge, so the tip opens to the left there.
 *
 * It keeps out of the pointer's way: the row's own `title` is the pointer's
 * tip, and two tips for one hover is one tip too many.
 */
function RailTip(props: { label: string; top?: string }) {
  return (
    <tooltip
      class={`absolute ${
        props.top ?? "top-0"
      } translate-none peer-hover:invisible ${
        inDrawer() && dockSide() === "right"
          ? "end-full start-auto"
          : "start-full"
      }`}
    >
      {props.label}
    </tooltip>
  );
}

export default function App() {
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
            class="flex flex-col bg-surface text-text"
            // A column, not a row: the bar along the bottom is the width of
            // the window, so the rail and the work sit above it in a row of
            // their own. Modal: the shell is exactly one viewport and clips,
            // so the DOCUMENT never scrolls and the sticky rail has no
            // reason to move. Drawer: the shell grows with the page and the
            // host's frame scrolls it, which is the only scroll that works
            // there — a `h-screen` shell would pin the rail to a box the
            // document drags away.
            classList={{
              "h-screen overflow-hidden": !inDrawer(),
              "min-h-full": inDrawer(),
            }}
          >
            <div
              // The row the rail and the work share. In the drawer the rail
              // mirrors to the outer edge — the host's drawer is
              // right-anchored, so a left rail traps the content between
              // chrome and the viewport edge.
              class="flex flex-1 flex-row"
              classList={{
                // Modal: the row takes what the bar leaves, and may be
                // shorter than its content — the page scrolls INSIDE it.
                // Drawer: the row is as tall as the page, and the document
                // scrolls.
                "min-h-0": !inDrawer(),
                "flex-row-reverse": inDrawer() && dockSide() === "right",
              }}
            >
              {
                /*
                The rail is navigation and nothing else: the mark at the top,
                the concerns below it, and the studio's own verbs at its foot.
                The verbs that change the document — undo, redo, save — live
                in the bar along the bottom, where the state they answer is
                written down; the gear, the way out and the edge the studio is
                shown at are chrome verbs, and chrome verbs belong to the
                chrome, not to the document.

                It wears the studio's own theme, so editing a theme cannot
                restyle the tool you are editing it with.

                It is a STRIP, not a menu: a column of glyphs, and every row
                is nothing but its glyph. So every row carries its name
                twice — a `title` for the pointer, and an `aria-label` for
                the reader and for the keyboard, where the row takes focus
                and has to announce itself.

                The strip is TIGHT: the column is the glyph and a small inset
                around it. The rows are BOXES rather than glyphs: a row that
                is only as wide as its icon gives the pointer a target the
                size of a stamp and paints its resting state as a chip the
                width of a letter — so the rail reads as a column of marks
                pressed against its edge. A row with room around it reads as
                a control, and the air it carries is what the theme's own
                spacing step says a control is worth. The box is as wide as
                the column and taller than the glyph, so the hit area is
                generous without the column growing to carry it.
                */
              }
              <nav
                aria-label="Studio"
                class="sticky top-0 flex w-10 shrink-0 flex-col items-center gap-1 border-border bg-surface-raised py-2"
                classList={{
                  "border-r": !inDrawer() || dockSide() === "left",
                  "border-l": inDrawer() && dockSide() === "right",
                  // Modal: the row is the height of the window less the
                  // bar, and the rail fills it. Drawer: the row is as tall
                  // as the page, so the rail is a window's worth and
                  // stays put while the document scrolls under it.
                  "h-screen": inDrawer(),
                }}
              >
                {
                  /*
                  The mark: the web, in the studio's own ink. The kit draws it
                  in strokes on `currentColor`, so it wears whatever surface it
                  lands on.

                  It is the BIGGEST thing in the rail: a mark reads at a glance
                  and an icon does not, so the mark is drawn larger than any
                  glyph beside it and takes the width of the strip rather than
                  a padded box inside it. The space under it is what separates
                  it from the concerns — a rule would say "this ends"; space
                  says "this is a different thing", which is what a mark is.
                  */
                }
                <A
                  href={hostPath(MARK.path)}
                  // `end`: the mark is the overview and nothing else. Without it
                  // the root path matches every path, and the mark would read as
                  // current on every page.
                  end
                  class="peer mb-2 flex h-10 w-full shrink-0 items-center justify-center rounded-md text-text hover:bg-surface"
                  title={MARK.label}
                  aria-label={MARK.label}
                >
                  <Web size={40} class="h-10 w-10 shrink-0" />
                </A>
                <RailTip label={MARK.label} top="top-4" />
                <ul class="flow-list m-0 flex w-full shrink-0 flex-col items-center gap-1">
                  <For each={CONCERNS}>
                    {(route) => (
                      <li class="m-0 w-full">
                        <A
                          href={hostPath(route.path)}
                          activeClass="bg-surface-sunken text-text font-semibold"
                          inactiveClass="text-text"
                          class="peer flex h-10 w-full items-center justify-center rounded-md hover:bg-surface"
                          title={route.label}
                          aria-label={route.label}
                        >
                          <span
                            class={`inline-block shrink-0 text-xl ${route.icon}`}
                            aria-hidden="true"
                          />
                        </A>
                        <RailTip label={route.label} />
                      </li>
                    )}
                  </For>
                </ul>
                {
                  /*
                  The foot: the studio's own verbs, in the same language as
                  the concerns above them — the same box, the same glyph size,
                  the same hover. The rule above them says "these are the
                  studio's, not the project's", and the space the rule leaves
                  keeps the foot apart from the concerns when the window is
                  short and the two would otherwise touch.

                  `mt-auto` puts the foot at the bottom of the strip: the
                  studio's own verbs belong at the edge of the tool, away from
                  the document's navigation.

                  The two host verbs are BUTTONS, and a button is the one
                  control the theme paints: bare is the opt-out, and the
                  hover chip it cannot carry is on the row around it, so the
                  foot's three rows read as one family.
                  */
                }
                <ul class="flow-list m-0 mt-auto flex w-full shrink-0 flex-col items-center gap-1 border-t border-border pt-2">
                  <For each={FOOT}>
                    {(route) => (
                      <li class="m-0 w-full">
                        <A
                          href={hostPath(route.path)}
                          activeClass="bg-surface-sunken text-text font-semibold"
                          inactiveClass="text-text"
                          class="peer flex h-10 w-full items-center justify-center rounded-md hover:bg-surface"
                          title={route.label}
                          aria-label={route.label}
                        >
                          <span
                            class={`inline-block shrink-0 text-xl ${route.icon}`}
                            aria-hidden="true"
                          />
                        </A>
                        <RailTip label={route.label} />
                      </li>
                    )}
                  </For>
                  <Show when={embedded()}>
                    <li class="m-0 w-full rounded-md hover:bg-surface">
                      <button
                        type="button"
                        class="bare peer flex h-10 w-full items-center justify-center rounded-md text-text hover:text-text"
                        aria-label={inDrawer() ? "Modal" : "Drawer"}
                        title={inDrawer() ? "Modal" : "Drawer"}
                        onClick={toggleHostMode}
                      >
                        <span
                          class="inline-block shrink-0 text-xl i-lucide-panel-right"
                          aria-hidden="true"
                        />
                      </button>
                      <RailTip label={inDrawer() ? "Modal" : "Drawer"} />
                    </li>
                    <li class="m-0 w-full rounded-md hover:bg-surface">
                      <button
                        type="button"
                        class="bare peer flex h-10 w-full items-center justify-center rounded-md text-text hover:text-text"
                        aria-label="Close"
                        title="Close"
                        onClick={closeStudio}
                      >
                        <span
                          class="inline-block shrink-0 text-xl i-lucide-x"
                          aria-hidden="true"
                        />
                      </button>
                      <RailTip label="Close" />
                    </li>
                  </Show>
                </ul>
              </nav>
              {
                /*
                The work: the preview of the document being edited, under
                the project's own theme. The rail is NOT inside it — the
                navigation is the tool's, and the content is the project's.
                */
              }
              <main
                class="flex min-w-0 flex-1 flex-col"
                // Modal: the column may be shorter than the page, and the
                // page scrolls inside it. Drawer: the column is as tall as
                // the page, and the document scrolls.
                classList={{ "min-h-0": !inDrawer() }}
              >
                {
                  /* What the studio refused, and what it did about the
                    file: said where the state is. Both are the tool's own
                    words about the author's own document, so they belong
                    with the chrome rather than inside the project they are
                    talking about. */
                }
                <Show
                  when={lastRefusal() !== undefined ||
                    lastNotice() !== undefined}
                >
                  <div
                    role="status"
                    class="shrink-0 border-b border-border bg-surface px-3 py-2 text-sm"
                  >
                    <Show when={lastRefusal()}>
                      {(message) => (
                        <p class="text-semantic-error">
                          <span
                            class="i-lucide-shield-alert mr-2 inline-block align-middle"
                            aria-hidden="true"
                          />
                          {message()}
                        </p>
                      )}
                    </Show>
                    <Show when={lastNotice()}>
                      {(message) => <p class="text-text-muted">{message()}</p>}
                    </Show>
                  </div>
                </Show>
                {
                  /* The preview carries the project's theme. Everything
                    around it is chrome and stays on the studio's own.
                    `spin-preview` is the sheet's scope: the theme's rules
                    apply inside the pane — a page that never spells a
                    control still styles one — and never to the chrome. */
                }
                <div
                  data-theme={activeName()}
                  data-mode={activeMode()}
                  // Same debt as the chrome's: <html> is stamped light, so a
                  // label that only inherits keeps that ink on a dark surface.
                  // `spin-preview` is the sheet's scope: the theme's rules
                  // apply inside the pane — a page that never spells a control
                  // still styles one — and never to the chrome.
                  class="spin-preview flex min-w-0 flex-1 flex-col bg-surface text-text"
                  // Modal, this column is the scroller: a page that brings its
                  // own rail fills it exactly and never triggers this, and a
                  // page that does not scrolls HERE rather than dragging the
                  // document — and with it the rail. The drawer's pages do not
                  // scroll here at all: the host's frame scrolls them, so the
                  // page's own region grows with its content instead.
                  classList={{
                    "min-h-0": !inDrawer(),
                    "overflow-y-auto": !inDrawer(),
                  }}
                >
                  <PreviewStyles />
                  <Suspense>{props.children}</Suspense>
                </div>
              </main>
            </div>
            {
              /* The bar along the bottom: the state of the document being
                edited and the verbs that change it. It is chrome, so it
                wears the studio's own theme — the control that saves a
                theme must not be restyled by the theme it is saving. */
            }
            <StatusBar />
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
