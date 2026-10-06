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
import { listProjectThemes } from "./lib/themes.ts";
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
      aria-label={`Switch to ${
        activeMode() === "light" ? "dark" : "light"
      } mode`}
      onClick={cycle}
    >
      <span
        class={`inline-block ${
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
                      <A href={`/${href}`}>{label}</A>
                    </li>
                  )}
                </For>
              </ul>
              <ThemePicker />
            </nav>
            <div class="flex items-center gap-4 p-4 shrink-0 border-b border-border">
              <span>
                Editing <code>{activeName()}</code>{" "}
                in packages/theme/src/themes · previewing {activeMode()}
              </span>
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
