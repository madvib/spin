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
import OverviewPage from "./routes/index.tsx";
import MotionPage from "./routes/motion.tsx";
import SpacingPage from "./routes/spacing.tsx";
import SpecimenPage from "./routes/specimen.tsx";
import SurfacesPage from "./routes/surfaces.tsx";
import UtilitiesPage from "./routes/utilities.tsx";
import { createEffect, createResource, For, Show, Suspense } from "solid-js";
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
    <div class="row-sm" role="group" aria-label="Color mode">
      <button
        type="button"
        class="bare"
        aria-pressed={activeMode() === "light"}
        onClick={() => setActiveMode("light")}
      >
        <span class="inline-block icon-md i-lucide-sun" aria-hidden="true" />
        Light
      </button>
      <button
        type="button"
        class="bare"
        aria-pressed={activeMode() === "dark"}
        onClick={() => setActiveMode("dark")}
      >
        <span class="inline-block icon-md i-lucide-moon" aria-hidden="true" />
        Dark
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
    <div class="row-sm">
      <label for="theme-picker">Theme</label>
      <select
        ref={select}
        id="theme-picker"
        onChange={(event) => setActiveName(event.currentTarget.value)}
      >
        <Show when={themes()} fallback={<option>loading…</option>}>
          <For each={themes()}>
            {(theme) => <option value={theme.name}>{theme.name}</option>}
          </For>
        </Show>
      </select>
      <ModePicker />
    </div>
  );
}

const CONCERNS = [
  ["specimen", "Specimens"],
  ["colors", "Color"],
  ["type", "Type"],
  ["surfaces", "Surfaces"],
  ["spacing", "Spacing"],
  ["motion", "Motion"],
  ["components", "Components"],
  ["utilities", "Utilities"],
] as const;

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
            data-mode={activeMode()}
            class="stack h-screen bg-surface"
          >
            <nav
              aria-label="Studio"
              class="row shrink-0 bg-surface-raised p-4"
            >
              <A href="/" class="row-sm font-semibold">
                <span
                  class="inline-block icon-lg i-lucide-loader-pinwheel text-text"
                  aria-hidden="true"
                />
                <span>Spin</span>
              </A>
              <ul class="row flex-1 justify-center">
                <For each={CONCERNS}>
                  {([href, label]) => (
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
                      >
                        {label}
                      </A>
                    </li>
                  )}
                </For>
              </ul>
              <ThemePicker />
            </nav>
            <div class="row shrink-0 border-b border-border p-4">
              <span class="flex-1">
                Editing <code>{activeName()}</code> {activePath() ?? "…"}{" "}
                · previewing {activeMode()}
              </span>
              <button
                type="button"
                class="bare"
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
                class="bare"
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
              <Show when={lastRefusal() !== undefined}>
                <alert variant="danger" class="text-sm">
                  Edit refused: {lastRefusal()}
                </alert>
              </Show>
              <button
                type="button"
                onClick={async () => {
                  const name = activeName();
                  const written = await saveTheme(name, themeText());
                  if (written.error === null) markSaved(name);
                }}
                disabled={!isDirty(activeName())}
                title="Save to disk"
              >
                Save
              </button>
              {
                /* The running app is the primary specimen: a theme edit
                  re-themes it live through the overlay, so this opens the
                  app the project actually ships rather than a second copy
                  of the specimen wall. */
              }
              <a
                // Served from the user's dev server the app is `/` on the
                // same origin; standalone studio-dev takes `?app=` instead,
                // because the app is a second server with a floating port.
                href={new URLSearchParams(location.search).get("app") ?? "/"}
                target="_blank"
                rel="noopener"
                aria-label="View in app"
                title="View in app"
                class="button secondary"
              >
                View in app
              </a>
            </div>
            {
              /* The preview carries the project's theme. Everything above is
                chrome and stays on the studio's own. */
            }
            <div
              data-theme={activeName()}
              data-mode={activeMode()}
              class="stack min-h-0 flex-1"
            >
              <PreviewStyles />
              <Suspense>{props.children}</Suspense>
            </div>
          </div>
        </MetaProvider>
      )}
    >
      <Route path="/" component={OverviewPage} />
      <Route path="/specimen" component={SpecimenPage} />
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
