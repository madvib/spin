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
import { createSignal, For, Show, Suspense } from "solid-js";
import type { Component } from "solid-js";
import "uno.css";
import PreviewStyles from "./components/PreviewStyles.tsx";
import { CONCERNS, FOOT, MARK, type RoutePath, ROUTES } from "./lib/routes.ts";

import {
  activeMode,
  activeName,
  activeTokenCount,
  canRedo,
  canUndo,
  divergedFromDisk,
  dockSide,
  isDirty,
  lastNotice,
  lastRefusal,
  note,
  noteRefusal,
  redo,
  reloadFromDisk,
  revertToSaved,
  saveThemeToDisk,
  undo,
} from "./lib/store.ts";
import { problemText } from "./lib/themes.ts";
import { hostPath } from "./lib/client.ts";
import { stateLabel } from "./lib/theme.ts";

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
 * What a save control says about itself.
 *
 * The file moved under the studio: the save would write over a change the
 * studio never saw, so the control says so before it is pressed. The press
 * itself refuses — the save is the studio's, and the studio knows what the
 * file holds.
 */
function saveTitle(): string {
  if (divergedFromDisk(activeName())) {
    return "The file changed on disk — reload from disk first";
  }
  return isDirty(activeName()) ? "Save to disk" : "Saved";
}

/**
 * The editor's header: what is being edited, and what is true about it.
 *
 * The unsaved-changes state lives here, so the two actions that answer it
 * live here too: a writer who is somewhere other than the overview — on the
 * colours, on the type — can take the file's word for it or drop their own
 * edits without walking back to the card that carries the same two verbs.
 *
 * It is CHROME, and it wears the studio's own theme: the control that saves
 * a theme must not be restyled by the theme it is saving.
 */
function EditorHeader() {
  /** The theme being edited. */
  const theme = () => activeName();
  /** Whether the editor holds edits the file does not. */
  const dirty = () => isDirty(theme());
  /** Whether the file moved under the studio. */
  const diverged = () => divergedFromDisk(theme());

  /**
   * What is true about the file, in the studio's words.
   *
   * Two facts can hold at once: the editor holds edits the file does not
   * ("unsaved changes"), and the file holds something the studio did not
   * write ("changed on disk"). The second is the one that bites — the save
   * that would overwrite it is refused — so it is said even when the first
   * is true as well.
   */
  function state(): string {
    const parts: string[] = [];
    if (dirty()) parts.push(stateLabel("unsaved"));
    if (diverged()) parts.push(stateLabel("changed"));
    if (parts.length === 0) parts.push(stateLabel("saved"));
    return parts.join(" · ");
  }

  /**
   * Takes the file's word for it.
   *
   * The same verb the card carries, on the theme being edited: the file's
   * text moves into the editor, and the edits that were never written go
   * with it.
   */
  async function reload(): Promise<void> {
    const name = theme();
    try {
      const found = await reloadFromDisk(name);
      note(
        found === "changed"
          ? `${name} changed on disk — the studio now shows the file.`
          : `${name} reloaded from disk.`,
      );
    } catch (err) {
      noteRefusal(problemText(err));
    }
  }

  /** Drops the edits that have not been written. */
  function discard(): void {
    const name = theme();
    revertToSaved(name);
    note(`${name} — the unsaved edits were dropped.`);
  }

  return (
    <header
      aria-label="Theme editor"
      class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface px-3 py-2"
    >
      <p class="min-w-0 text-sm text-text-muted">
        Editing <strong class="text-text">{theme()}</strong>
        {" · "}
        {activeMode()}
        {" · "}
        {activeTokenCount()} tokens
        {" · "}
        {state()}
      </p>
      <Show when={lastNotice()}>
        {(message) => (
          <p class="text-sm text-text-muted" role="status">
            {message()}
          </p>
        )}
      </Show>
      <span class="flex-1" />
      <button
        type="button"
        class="bare shrink-0 text-sm text-text-muted"
        title="Re-read this theme from disk"
        onClick={() => {
          void reload();
        }}
      >
        Reload from disk
      </button>
      <button
        type="button"
        class="bare shrink-0 text-sm text-text-muted disabled:opacity-50"
        title={dirty()
          ? "Drop the edits that have not been saved"
          : "There are no unsaved edits to drop"}
        disabled={!dirty()}
        onClick={discard}
      >
        Discard changes
      </button>
      <button
        type="button"
        class="bare shrink-0 text-sm text-text-muted disabled:opacity-50"
        title={saveTitle()}
        disabled={!dirty()}
        onClick={() => {
          void saveThemeToDisk(theme());
        }}
      >
        Save to disk
      </button>
    </header>
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
            class="flex bg-surface text-text"
            // A row, not a stack: the rail takes an edge and the preview
            // takes the rest. In the drawer the rail mirrors to the outer
            // edge — the host's drawer is right-anchored, so a left rail
            // traps the content between chrome and the viewport edge.
            classList={{
              // Modal: the shell is exactly one viewport and clips, so the
              // DOCUMENT never scrolls and the sticky rail has no reason to
              // move. Drawer: the shell grows with the page and the host's
              // frame scrolls it, which is the only scroll that works
              // there — a `h-screen` shell would pin the rail to a box the
              // document drags away.
              "h-screen overflow-hidden": !inDrawer(),
              "min-h-full": inDrawer(),
              "flex-row-reverse": inDrawer() && dockSide() === "right",
            }}
          >
            {
              /*
              The rail is the reference app's rail: the mark at the top, the
              concerns in bands, the foot that carries the tool's own verbs.
              It wears the studio's own theme, so editing a theme cannot
              restyle the tool you are editing it with.
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
                href={hostPath(MARK.path)}
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
                        href={hostPath(route.path)}
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
                    void saveThemeToDisk(name);
                  }}
                  disabled={!isDirty(activeName())}
                  aria-label="Save to disk"
                  title={saveTitle()}
                >
                  <span
                    class="inline-block icon-md i-lucide-save"
                    aria-hidden="true"
                  />
                </button>
                <A
                  href={hostPath(FOOT.path)}
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
              /* The editor's header and the column under it. The header is
                chrome — the studio's own theme, above the project's — and it
                heads the editing area: the state of the file, the save, and
                the two actions that answer a file that moved. */
            }
            <div class="flex min-h-0 min-w-0 flex-1 flex-col">
              <EditorHeader />
              {
                /* What the studio refused, said where the state is: the
                  refusal is the tool's own word about the author's own
                  document, so it belongs with the header rather than inside
                  the project it is talking about. */
              }
              <Show when={lastRefusal()}>
                {(message) => (
                  <div
                    role="status"
                    class="shrink-0 border-b border-border bg-surface px-3 py-2 text-sm text-semantic-error"
                  >
                    <span
                      class="i-lucide-shield-alert mr-2 inline-block align-middle"
                      aria-hidden="true"
                    />
                    {message()}
                  </div>
                )}
              </Show>
              {
                /* The preview carries the project's theme. Everything above is
                  chrome and stays on the studio's own. `spin-preview` is the
                  sheet's scope: the theme's rules apply inside the pane — a
                  page that never spells a control still styles one — and
                  never to the chrome. */
              }
              <div
                data-theme={activeName()}
                data-mode={activeMode()}
                // Same debt as the chrome's: <html> is stamped light, so a
                // label that only inherits keeps that ink on a dark surface.
                // `spin-preview` is the sheet's scope: the theme's rules
                // apply inside the pane — a page that never spells a control
                // still styles one — and never to the chrome.
                class="spin-preview flex min-h-0 min-w-0 flex-1 flex-col bg-surface text-text"
                // Modal, this column is the scroller: a page that brings its
                // own rail fills it exactly and never triggers this, and a
                // page that does not scrolls HERE rather than dragging the
                // document — and with it the rail. The drawer's pages do not
                // scroll here at all: the host's frame scrolls them, so the
                // page's own region grows with its content instead.
                classList={{ "overflow-y-auto": !inDrawer() }}
              >
                <Show
                  when={new URLSearchParams(location.search).get("app") !==
                    null}
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
                      onClick={() =>
                        globalThis.parent.postMessage("spin:close", "*")}
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
