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
import ComponentsLayout from "./routes/components.tsx";
import ComponentPage from "./routes/components/[name].tsx";
import IconsPage from "./routes/icons.tsx";
import OverviewPage from "./routes/index.tsx";
import MotionPage from "./routes/motion.tsx";
import SpacingPage from "./routes/spacing.tsx";
import SurfacesPage from "./routes/surfaces.tsx";
import UtilitiesPage from "./routes/utilities.tsx";
import {
  createEffect,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from "solid-js";
import "uno.css";
import PreviewStyles from "./components/PreviewStyles.tsx";

import { listProjectThemes, saveTheme } from "./lib/themes.ts";
import {
  canRedo,
  canUndo,
  isDirty,
  lastRefusal,
  markSaved,
  redo,
  themeText,
  undo,
} from "./lib/store.ts";
import {
  activeMode,
  activeName,
  setActiveMode,
  setActiveName,
} from "./lib/store.ts";

/**
 * The chrome's own theme. A constant rather than a lookup, so the shell does
 * not depend on discovery having succeeded before it can render.
 */
const STUDIO_THEME = "studio";

/**
 * Whether the viewport is at drawer width.
 *
 * Module scope because the rail's chrome — not just the shell — reads it to
 * fold its own labels away, and a signal defined inside `App` would put the
 * pickers' interesting half behind the shell.
 */
const [narrow, setNarrow] = createSignal(false);

/**
 * The mode control.
 *
 * A two-button group with pressed state rather than a cycling icon: the
 * current mode is a choice with two answers, and pressing the one you are
 * not on is the affordance a tool needs. One control drives both the
 * chrome and the preview — working in dark means the whole studio is
 * dark, and the preview still declares the edited theme's own dark values.
 */
function ModePicker() {
  return (
    <div
      class="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Color mode"
    >
      <button
        type="button"
        class="bare row-sm whitespace-nowrap"
        aria-pressed={activeMode() === "light"}
        aria-label="Light"
        onClick={() => setActiveMode("light")}
      >
        <span
          class="inline-block icon-md i-lucide-sun shrink-0"
          aria-hidden="true"
        />
        <span classList={{ hidden: narrow() }}>Light</span>
      </button>
      <button
        type="button"
        class="bare row-sm whitespace-nowrap"
        aria-pressed={activeMode() === "dark"}
        aria-label="Dark"
        onClick={() => setActiveMode("dark")}
      >
        <span
          class="inline-block icon-md i-lucide-moon shrink-0"
          aria-hidden="true"
        />
        <span classList={{ hidden: narrow() }}>Dark</span>
      </button>
    </div>
  );
}

/**
 * The project theme picker.
 *
 * Lists what is on disk in the project's themes directory — not what the
 * studio shipped with. The selected theme drives the preview surface only;
 * a `<label>` names it rather than a bare floating select.
 */
function ThemePicker() {
  const [themes] = createResource(listProjectThemes);
  let select: HTMLSelectElement | undefined;
  // The options arrive after the select does, and the browser answers an
  // option list it just filled by selecting the first one — so the picker
  // read `console` while the editor was editing `default`. Writing the value
  // once both are settled is the only thing that keeps them honest.
  createEffect(() => {
    if (select !== undefined && themes() !== undefined) {
      select.value = activeName();
    }
  });
  return (
    <div class="stack-sm">
      <div class="row-sm">
        <label for="theme-picker" classList={{ hidden: narrow }}>
          Theme
        </label>
        <select
          ref={select}
          id="theme-picker"
          class="min-w-0 flex-1"
          aria-label="Theme"
          onChange={(event) => setActiveName(event.currentTarget.value)}
        >
          <Show when={themes()} fallback={<option>loading…</option>}>
            <For each={themes()}>
              {(theme) => <option value={theme.name}>{theme.name}</option>}
            </For>
          </Show>
        </select>
      </div>
      <ModePicker />
    </div>
  );
}

// Each concern's glyph is a whole utility class rather than an icon name
// joined at runtime: the scanner reads source text, so the literal has to
// appear in the file to be emitted. `i-lucide-${icon}` styles nothing.
const CONCERNS = [
  ["colors", "Color", "i-lucide-palette"],
  ["type", "Type", "i-lucide-type"],
  ["surfaces", "Surfaces", "i-lucide-layers"],
  ["spacing", "Spacing", "i-lucide-ruler"],
  ["motion", "Motion", "i-lucide-zap"],
  ["components", "Components", "i-lucide-blocks"],
  ["utilities", "Utilities", "i-lucide-wrench"],
  ["icons", "Icons", "i-lucide-shapes"],
] as const;

export default function App() {
  // The rail is the concern list at every width: on a narrow viewport the
  // labels fold away and the rail keeps the glyphs, so a concern is still
  // one tap and the page beside the rail keeps its own width. The overlay
  // the drawer used to open is gone — a rail that narrows beats a drawer
  // that covers the thing it navigates.
  //
  // A `matchMedia` rather than `md:` variants: `.hidden` and `.md:flex` are
  // the same specificity, so which one wins is a property of the sheet's
  // emission order rather than of the markup. It resolved wrong, and left
  // the nav empty at full width.
  onMount(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    onCleanup(() => query.removeEventListener("change", sync));
  });

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
            data-mode={activeMode()}
            // A row, not a stack: the rail takes the left edge and the
            // preview takes the rest, which is the whole change.
            class="flex h-screen bg-surface"
          >
            <nav
              aria-label="Studio"
              class="flex min-h-0 shrink-0 flex-col gap-4 overflow-y-auto bg-surface-raised p-3"
              classList={{ "w-[17rem]": !narrow(), "w-20": narrow() }}
            >
              <A
                href="/"
                class="row-sm shrink-0 font-semibold"
                classList={{ "justify-center": narrow() }}
              >
                <span
                  class="inline-block icon-lg shrink-0 i-lucide-loader-pinwheel text-text"
                  aria-hidden="true"
                />
                <span
                  class="whitespace-nowrap"
                  classList={{ hidden: narrow() }}
                >
                  Spin
                </span>
              </A>
              <ul class="flow-list stack-sm shrink-0">
                <For each={CONCERNS}>
                  {([href, label, icon]) => (
                    <li>
                      {
                        /* `activeClass` is the router's own answer to "where am
                          I", which is the one thing a nav must say and this
                          one said nothing: every entry looked identical. */
                      }
                      <A
                        href={`/${href}`}
                        activeClass="text-text font-semibold underline"
                        inactiveClass="text-text-muted"
                        class="row-sm"
                        classList={{ "justify-center": narrow() }}
                        title={label}
                      >
                        <span
                          class={`inline-block shrink-0 icon-md ${icon}`}
                          aria-hidden="true"
                        />
                        <span
                          class="whitespace-nowrap"
                          classList={{ hidden: narrow() }}
                        >
                          {label}
                        </span>
                      </A>
                    </li>
                  )}
                </For>
              </ul>
              {
                /* The rail's bottom: the pickers and the edit controls stay
                  reachable at any rail width, pinned so a short concern list
                  never lets them float mid-rail. */
              }
              <div class="stack-sm mt-auto shrink-0">
                <ThemePicker />
                {
                  /* Undo, redo and save are editing controls, not a status
                    bar: they belong beside the pickers in the rail, and the
                    row wraps when the rail is narrow rather than growing
                    past it. */
                }
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    class="bare shrink-0"
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
                    class="bare shrink-0"
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
                    onClick={async () => {
                      const name = activeName();
                      const written = await saveTheme(name, themeText());
                      if (written.error === null) markSaved(name);
                    }}
                    disabled={!isDirty(activeName())}
                    title="Save to disk"
                    class="shrink-0"
                  >
                    <span
                      class="inline-block icon-md i-lucide-save"
                      aria-hidden="true"
                    />
                    <span classList={{ hidden: narrow() }}>Save</span>
                  </button>
                  {
                    /* The running app is the primary specimen: a theme edit
                      re-themes it live through the overlay, so this opens the
                      app the project actually ships. */
                  }
                  <a
                    // Same origin from the user's dev server; standalone
                    // studio-dev takes `?app=`, because the app is a second
                    // server with a floating port.
                    href={new URLSearchParams(location.search).get("app") ??
                      "/"}
                    target="_blank"
                    rel="noopener"
                    aria-label="View in app"
                    title="View in app"
                    class="button secondary whitespace-nowrap shrink-0"
                  >
                    <span
                      class="inline-block icon-md i-lucide-external-link"
                      aria-hidden="true"
                    />
                    <span classList={{ hidden: narrow() }}>View in app</span>
                  </a>
                </div>
                {
                  /* A refused edit says why, next to the button that would
                    have applied it, rather than in a row of its own. */
                }
                <Show when={lastRefusal() !== undefined}>
                  <alert variant="danger" class="text-xs">
                    {lastRefusal()}
                  </alert>
                </Show>
              </div>
            </nav>
            {
              /* The preview carries the project's theme. Everything above is
                chrome and stays on the studio's own. */
            }
            <div
              data-theme={activeName()}
              data-mode={activeMode()}
              class="stack min-h-0 min-w-0 flex-1"
            >
              <PreviewStyles />
              <Suspense>{props.children}</Suspense>
            </div>
          </div>
        </MetaProvider>
      )}
    >
      <Route path="/" component={OverviewPage} />
      <Route path="/icons" component={IconsPage} />
      <Route path="/colors" component={ColorsPage} />
      <Route path="/type" component={TypePage} />
      <Route path="/surfaces" component={SurfacesPage} />
      <Route path="/spacing" component={SpacingPage} />
      <Route path="/motion" component={MotionPage} />
      <Route path="/components" component={ComponentsLayout}>
        <Route path="/:name" component={ComponentPage} />
      </Route>
      <Route path="/utilities" component={UtilitiesPage} />
    </Router>
  );
}
