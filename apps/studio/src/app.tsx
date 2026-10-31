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
 * edge is navigation: the mark that goes home, the concerns the project is
 * filed by, and the studio's own verbs at its foot — where the checks on
 * the document live too, because a check is a verdict and a verdict is
 * something the reader looks for, not something the reader reads. The bar
 * along the top of the work is the controls: the theme picker, the mode
 * control, the verbs that change the document, and — in the middle of the
 * row — the state of what is being edited. The column is the work: the
 * preview of the document being edited.
 *
 * There is no bar along the bottom. There used to be one, and it carried the
 * state and the checks together; a strip of furniture at the foot of the
 * window is a place the eye stops on the way to nothing, and everything it
 * carried has somewhere better to be. The state is a sentence, and a
 * sentence in the middle of the bar of controls is where the reader is
 * already looking. The checks are a count, and a count belongs on the thing
 * it counts.
 */

import { MetaProvider, Title } from "@solidjs/meta";
import { A, Route, Router } from "@solidjs/router";
import { Web } from "@spinjs/kit";
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
import FindingsPage from "./routes/findings.tsx";
import { createEffect, createSignal, For, onMount, Show, Suspense, type Component } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { toast } from "@spinjs/components/toast";
import "uno.css";
import PreviewStyles from "./components/PreviewStyles.tsx";
import Checks from "./components/Checks.tsx";
import StudioError from "./components/StudioError.tsx";
import TopBar from "./components/TopBar.tsx";
import { CONCERNS, FOOT, MARK, type RoutePath, ROUTES } from "./lib/routes.ts";

import {
  activeMode,
  activeName,
  dismissNotice,
  dismissRefusal,
  dockSide,
  lastNotice,
  lastRefusal,
} from "./lib/store.ts";
import { closeStudio, embedded, inDrawer, toggleHostMode } from "./lib/host.ts";
import { hostPath } from "./lib/client.ts";
import { installShortcuts } from "./lib/shortcuts.ts";

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
  "/findings": FindingsPage,
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
 * A row in the rail.
 *
 * The same box for every row: the width of the column and taller than the
 * glyph, so the hit area is generous without the column growing to carry
 * it. The chip the pointer paints is on the row, not on the glyph, so a
 * hovered row reads as a control rather than as a lit icon.
 */
const ROW =
  "peer flex h-10 w-full items-center justify-center rounded-md hover:bg-surface";

/**
 * The ink of a row, by what the row is.
 *
 * The row you are ON is the ACTING colour — the primary, which is what the
 * studio acts with — and every other row is the page's own ink until the
 * pointer arrives, when it takes the accent.
 *
 * The accent and not the primary, and that is the whole reason: the primary
 * is spin's brand red, and the studio's chrome wears the studio's own
 * theme. A rail that turned red under the pointer would be pointing at the
 * wrong thing — and the row you are on would be the same red as the row the
 * pointer is on, which is the one thing the reader must be able to tell
 * apart. The accent is the other family: it says "the pointer is here"
 * without claiming to be the selection.
 */
const INK_CURRENT = "bg-surface-sunken text-primary font-semibold";
const INK_RESTING = "text-text hover:text-accent";

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
      class={`${
        props.top ?? "top-0"
      } ms-2 whitespace-nowrap peer-hover:visible peer-focus-visible:visible ${
        inDrawer() && dockSide() === "right"
          ? "end-full start-auto me-2 ms-0"
          : "start-full"
      }`}
    >
      {props.label}
    </tooltip>
  );
}

/**
 * Refusals and notices as toasts, bottom-left: an error interrupts, so it
 * interrupts there — the banner it replaces stuck to the top of every
 * scroll and read as page content. Each standing message gets one toast;
 * a resolved message takes its toast with it.
 */
function ToastTray() {
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, toast);
  const live = new Set<string>();
  createEffect(() => {
    const refusal = lastRefusal();
    const notice = lastNotice();
    const want = new Map<string, { title: string; description: string }>();
    if (refusal !== undefined) {
      want.set("refusal", { title: "Not applied", description: refusal });
    }
    if (notice !== undefined) {
      want.set("notice", { title: "Studio", description: notice });
    }
    for (const [id, toast] of want) {
      if (live.has(id)) continue;
      live.add(id);
        ctl.commands.create({
        id,
        title: toast.title,
        description: toast.description,
        type: id === "refusal" ? "error" : "info",
        duration: 0,
      });
    }
    for (const id of [...live]) {
      if (want.has(id)) continue;
      live.delete(id);
      ctl.commands.dismiss(id);
    }
  });
  return (
    <studio-toast-tray
      ref={(el: HTMLElement) => setElement(el)}
    />
  );
}

export default function App() {
  // The keyboard's verbs are the tool's, not a page's: installed once with
  // the shell, and taken off only when the shell goes.
  onMount(() => installShortcuts());

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
            // Modal: the shell is exactly one viewport and clips, so the
            // DOCUMENT never scrolls and the sticky rail has no reason to
            // move. Drawer: the shell grows with the page and the host's
            // frame scrolls it, which is the only scroll that works there —
            // a `h-screen` shell would pin the rail to a box the document
            // drags away.
            classList={{
              "h-screen overflow-hidden": !inDrawer(),
              "min-h-full": inDrawer(),
            }}
          >
            {
              /* The studio's own boundary. It sits INSIDE the themed shell,
                so a failure is drawn with the studio's surfaces and ink
                rather than in an unstyled page — and so the chrome around it
                survives: the studio is broken, not gone. A tool that cannot
                show you its own error is a tool you cannot trust. */
            }
            <StudioError>
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
                in the bar along the top of the work, where the controls are;
                the gear, the way out and the edge the studio is shown at are
                chrome verbs, and chrome verbs belong to the chrome, not to
                the document.

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
                  as one filled path on `currentColor`, so it wears whatever
                  surface it lands on.

                  It is the BIGGEST thing in the rail: a mark reads at a glance
                  and an icon does not, so the mark is drawn larger than any
                  glyph beside it and takes the width of the strip rather than
                  a padded box inside it. The space under it is what separates
                  it from the concerns — a rule would say "this ends"; space
                  says "this is a different thing", which is what a mark is.
                  */
                  }
                  <span class="relative mb-2 flex w-full shrink-0 items-center justify-center">
                  <A
                    href={hostPath(MARK.path)}
                    // `end`: the mark is the overview and nothing else. Without it
                    // the root path matches every path, and the mark would read as
                    // current on every page.
                    end
                    class="peer flex h-10 w-full shrink-0 items-center justify-center rounded-md hover:bg-surface"
                    activeClass={INK_CURRENT}
                    inactiveClass={INK_RESTING}
                    aria-label={MARK.label}
                  >
                    <Web size={40} class="h-10 w-10 shrink-0" />
                  </A>
                  <RailTip label={MARK.label} top="top-4" />
                  </span>
                  <ul class="flex w-full shrink-0 flex-col items-center gap-1">
                    <For each={CONCERNS}>
                      {(route) => (
                        <li class="relative m-0 w-full">
                          <A
                            href={hostPath(route.path)}
                            activeClass={INK_CURRENT}
                            inactiveClass={INK_RESTING}
                            class={ROW}
                            aria-label={route.label}
                          >
                            <span
                              class={`inline-block shrink-0 icon-md ${route.icon}`}
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

                  The CHECKS are at the top of it, above the verbs: a check is
                  a verdict on the document, and a verdict is a state rather
                  than a verb — it is what the studio says about the work, and
                  it belongs where the eye already is when the author asks
                  "is anything wrong?".

                  The two host verbs are BUTTONS, and a button is the one
                  control the theme paints: bare is the opt-out, and the
                  hover chip it cannot carry is on the row around it, so the
                  foot's rows read as one family.
                  */
                  }
                  <div class="mt-auto w-full">
                    <hr class="w-full" />
                    <ul class="flex w-full shrink-0 flex-col items-center gap-1">
                      <Checks tip={<RailTip label="Checks" />} />
                      <For each={FOOT}>
                        {(route) => (
                          <li class="relative m-0 w-full">
                            <A
                              href={hostPath(route.path)}
                              activeClass={INK_CURRENT}
                              inactiveClass={INK_RESTING}
                              class={ROW}
                              aria-label={route.label}
                            >
                              <span
                                class={`inline-block shrink-0 icon-md ${route.icon}`}
                                aria-hidden="true"
                              />
                            </A>
                            <RailTip label={route.label} />
                          </li>
                        )}
                      </For>
                      <Show when={embedded()}>
                        <li class="relative m-0 w-full rounded-md hover:bg-surface">
                          <button
                            type="button"
                            class="bare peer flex h-10 w-full items-center justify-center text-text hover:text-accent"
                            aria-label={inDrawer() ? "Modal" : "Drawer"}
                            onClick={toggleHostMode}
                          >
                            <span
                              class="inline-block shrink-0 icon-md i-lucide-panel-right"
                              aria-hidden="true"
                            />
                          </button>
                          <RailTip label={inDrawer() ? "Modal" : "Drawer"} />
                        </li>
                        <li class="relative m-0 w-full rounded-md hover:bg-surface">
                          <button
                            type="button"
                            class="bare peer flex h-10 w-full items-center justify-center text-text hover:text-accent"
                            aria-label="Close"
                            onClick={closeStudio}
                          >
                            <span
                              class="inline-block shrink-0 icon-md i-lucide-x"
                              aria-hidden="true"
                            />
                          </button>
                          <RailTip label="Close" />
                        </li>
                      </Show>
                    </ul>
                  </div>
                </nav>
                {
                  /*
                The work: the preview of the document being edited, under
                the project's own theme. The rail is NOT inside it — the
                navigation is the tool's, and the content is the project's.

                The column carries the bar along the top of it: the bar is
                the work's own, so it spans the work and not the rail. A
                bar that ran over the rail would put a control above the
                navigation, and the navigation is the rail's own.
                */
                }
                <div class="flex min-w-0 flex-1 flex-col">
                  <TopBar />
                  <main
                    class="flex min-w-0 flex-1 flex-col"
                    // Modal: the column may be shorter than the page, and the
                    // page scrolls inside it. Drawer: the column is as tall as
                    // the page, and the document scrolls.
                    classList={{ "min-h-0": !inDrawer() }}
                  >
                    <ToastTray />
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
              </div>
            </StudioError>
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
