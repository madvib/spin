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
import { A, Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createResource, For, Show, Suspense } from "solid-js";
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

function ModePicker() {
  const cycle = () =>
    setActiveMode(activeMode() === "light" ? "dark" : "light");
  return (
    <button
      type="button"
      // A control with no styling is a control that does not exist: no
      // padding, no hover, and an icon at its inherited `1em` — which on the
      // studio's dark chrome resolved to black-on-black.
      class="hover:bg-surface rounded-md p-2 text-text"
      aria-label={`Switch to ${
        activeMode() === "light" ? "dark" : "light"
      } mode`}
      title={`Switch to ${activeMode() === "light" ? "dark" : "light"} mode`}
      onClick={cycle}
    >
      <span
        class={`inline-block icon-md ${
          activeMode() === "light" ? "i-lucide-moon" : "i-lucide-sun"
        }`}
        aria-hidden="true"
      />
    </button>
  );
}

/**
 * The project theme picker.
 *
 * Lists what is on disk in the project's themes directory — not what the studio
 * shipped with. The selected theme drives the preview surface only.
 */
function ThemePicker() {
  const [themes] = createResource(listProjectThemes);
  return (
    <div class="flex items-center gap-4">
      <label for="theme-picker">Theme</label>
      <select
        id="theme-picker"
        value={activeName()}
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
  ["colors", "Color"],
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
      root={(props) => (
        <MetaProvider>
          <Title>spin theme studio</Title>
          {
            /* The chrome is themed by the studio, never by the project, so a
              broken project theme cannot break the tool. */
          }
          <div
            data-theme={STUDIO_THEME}
            class="flex flex-col h-screen bg-surface"
          >
            <nav
              aria-label="Studio"
              class="flex items-center gap-4 p-4 bg-surface-raised shrink-0"
            >
              <A href="/">
                <span class="flex items-center gap-4">
                  <span
                    class="inline-block i-lucide-loader-pinwheel"
                    aria-hidden="true"
                  />
                  <span>Spin</span>
                </span>
              </A>
              <ul class="flex flex-1 items-center justify-center gap-4">
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
            <div class="flex items-center gap-4 p-4 shrink-0 border-b border-border">
              <span>
                Editing <code>{activeName()}</code> {
                  /* The daemon reports the path relative to its project, so
                     nothing here carries the machine it ran on. */
                }
                {activePath() ?? "…"} · previewing {activeMode()}
              </span>
              <button
                type="button"
                onClick={() => undo()}
                disabled={!canUndo()}
                aria-label="Undo"
                title="Undo"
                class="hover:bg-surface rounded-md p-2 disabled:opacity-40"
              >
                <i class="i-lucide-undo-2 icon-md" />
              </button>
              <button
                type="button"
                onClick={() => redo()}
                disabled={!canRedo()}
                aria-label="Redo"
                title="Redo"
                class="hover:bg-surface rounded-md p-2 disabled:opacity-40"
              >
                <i class="i-lucide-redo-2 icon-md" />
              </button>
              <p
                class="text-red-600 text-sm"
                hidden={lastRefusal() === undefined}
              >
                Edit refused: {lastRefusal() ?? ""}
              </p>
              <button
                type="button"
                onClick={async () => {
                  const name = activeName();
                  const written = await saveTheme(name, themeText());
                  if (written.error === null) markSaved(name);
                }}
                disabled={!isDirty(activeName())}
                aria-label="Save to disk"
                title="Save to disk"
                class="bg-surface-raised border-border rounded-md border p-2 disabled:opacity-40"
              >
                Save
              </button>
            </div>
            {
              /* The preview carries the project's theme. Everything above is
                chrome and stays on the studio's own. */
            }
            <div
              data-theme={activeName()}
              data-mode={activeMode()}
              class="flex flex-col flex-1 min-h-0"
            >
              <PreviewStyles />
              <Suspense>{props.children}</Suspense>
            </div>
          </div>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
