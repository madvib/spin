import { createEffect, createResource, For, Show } from "solid-js";
import {
  activeMode,
  activeName,
  setActiveMode,
  setActiveName,
} from "../lib/store.ts";
import { listProjectThemes } from "../lib/themes.ts";

/**
 * The project's themes, fetched once per session. Module scope so the
 * settings section and anywhere else that names a theme share one fetch.
 */
const [projectThemes] = createResource(listProjectThemes);

/**
 * The mode control.
 *
 * A two-button group with pressed state rather than a cycling icon: the
 * current mode is a choice with two answers, and pressing the one you are
 * not on is the affordance a tool needs. One control drives both the
 * chrome and the preview — working in dark means the whole studio is
 * dark, and the preview still declares the edited theme's own dark values.
 */
export function ModePicker() {
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
        <span>Light</span>
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
        <span>Dark</span>
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
export function ThemePicker() {
  let select: HTMLSelectElement | undefined;
  // The options arrive after the select does, and the browser answers an
  // option list it just filled by selecting the first one — so the picker
  // read `console` while the editor was editing `default`. Writing the value
  // once both are settled is the only thing that keeps them honest.
  createEffect(() => {
    if (select !== undefined && projectThemes() !== undefined) {
      select.value = activeName();
    }
  });
  return (
    <div class="stack-sm">
      <div class="row-sm">
        <label for="theme-picker">
          Theme
        </label>
        <select
          ref={select}
          id="theme-picker"
          class="min-w-0 flex-1"
          aria-label="Theme"
          onChange={(event) => setActiveName(event.currentTarget.value)}
        >
          <Show when={projectThemes()} fallback={<option>loading…</option>}>
            <For each={projectThemes()}>
              {(theme) => <option value={theme.name}>{theme.name}</option>}
            </For>
          </Show>
        </select>
      </div>
      <ModePicker />
    </div>
  );
}
