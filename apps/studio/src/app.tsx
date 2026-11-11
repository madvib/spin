/**
 * The studio shell.
 *
 * The studio is a tool pointed at a project, not the project. That distinction
 * is structural here: the chrome renders under its own static theme
 * (`data-theme="studio"`), and only the preview follows the picker. Editing a
 * theme therefore cannot restyle the tool you are editing it with, which is
 * what makes a broken theme recoverable.
 *
 * The chrome is one bar and the work under it. The bar carries navigation
 * (a menu with sublevels, and the current page named beside it), the theme
 * picker, the mode control, the verbs that change the document, the checks
 * on it, and the overflow with the studio's own verbs — and in the middle
 * of the row, the state of what is being edited. The column is the work:
 * the preview of the document being edited.
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
import { Navigate, Route, Router } from "@solidjs/router";
import { studioBase } from "./lib/mount.ts";
import ColorsPage from "./routes/colors.tsx";
import TypePage from "./routes/type.tsx";
import TypeFacesPage from "./routes/themes/type-faces.tsx";
import TypeStylesPage from "./routes/themes/type-styles.tsx";
import TypeRampsPage from "./routes/themes/type-ramps.tsx";
import IconsPage from "./routes/icons.tsx";
import MotionPage from "./routes/motion.tsx";
import SpacingPage from "./routes/spacing.tsx";
import StylePage from "./routes/style.tsx";
import ThemesLayout from "./routes/themes.tsx";
import ComponentsLayout from "./routes/components.tsx";
import ComponentsIndex from "./routes/components/index.tsx";
import ComponentPage from "./routes/components/[name].tsx";
import OverviewPage from "./routes/index.tsx";
import BrandPage from "./routes/brand.tsx";
import InitPage from "./routes/init.tsx";
import PreferencesPage from "./routes/preferences.tsx";
import FindingsPage from "./routes/findings.tsx";
import { createEffect, createSignal, For, onMount, Suspense, type Component } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { toast } from "@spinjs/components/toast";
import "uno.css";
import PreviewStyles from "./components/PreviewStyles.tsx";
import StudioError from "./components/StudioError.tsx";
import TopBar from "./components/TopBar.tsx";
import { REDIRECTS, type RoutePath, ROUTES } from "./lib/routes.ts";

import {
  activeMode,
  activeName,
  lastNotice,
  lastRefusal,
} from "./lib/store.ts";
import { inDrawer } from "./lib/host.ts";
import { installShortcuts } from "./lib/shortcuts.ts";

/**
 * The chrome's own theme. A constant rather than a lookup, so the shell does
 * not depend on discovery having succeeded before it can render.
 */
const STUDIO_THEME = "studio";

// The nav reads the route table rather than keeping its own copy of the
// paths: a destination the nav offers and a route the router serves are the
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
  "/brand": BrandPage,
  "/init": InitPage,
  "/preferences": PreferencesPage,
  "/tokens": ThemesLayout,
  "/components": ComponentsLayout,
  "/diagnostics": FindingsPage,
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
  "/tokens": ColorsPage,
  "/tokens/colors": ColorsPage,
  "/tokens/type": TypePage,
  "/tokens/type/faces": TypeFacesPage,
  "/tokens/type/styles": TypeStylesPage,
  "/tokens/type/ramps": TypeRampsPage,
  "/tokens/icons": IconsPage,
  "/tokens/motion": MotionPage,
  "/tokens/spacing": SpacingPage,
  "/tokens/style": StylePage,
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
      // The bundle serves under the plugin's `/__spin/studio/` and the
      // standalone daemon's `/studio/`; the router follows the page's mount.
      base={studioBase(location.pathname)}
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
            class="flex flex-col bg-surface"
            // Modal: the shell is exactly one viewport and clips, so the
            // DOCUMENT never scrolls. Drawer: the shell grows with the page
            // and the host's frame scrolls it, which is the only scroll that
            // works there.
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
                class="flex min-w-0 flex-1 flex-col"
                classList={{ "min-h-0": !inDrawer() }}
              >
                <TopBar />
                <main
                  class="flex min-w-0 flex-1 flex-col"
                  classList={{ "min-h-0": !inDrawer() }}
                >
                  <ToastTray />
                  <div
                    data-theme={activeName()}
                    data-mode={activeMode()}
                    class="spin-preview flex min-w-0 flex-1 flex-col bg-surface"
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
            </StudioError>
          </div>
        </MetaProvider>
      )}
    >
      {
        /* The router renders the same table the nav and the links read, so
          a route cannot exist without the nav being able to name it, and a
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
      {
        /* The folded group paths redirect to their sub-views: a bookmark
          written against the old shape lands on the same page, and the
          address bar tells the truth about where it is. */
      }
      <For each={Object.entries(REDIRECTS)}>
        {([from, to]) => (
          <Route path={from} component={() => <Navigate href={to} />} />
        )}
      </For>
    </Router>
  );
}
