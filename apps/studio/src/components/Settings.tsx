import { createEffect, createResource, For, Show } from "solid-js";
import {
  activeMode,
  activeName,
  dockSide,
  setActiveMode,
  setActiveName,
  setDockSide,
} from "../lib/store.ts";
import { listProjectThemes } from "../lib/themes.ts";

/**
 * The project's themes, fetched once per session. Module scope so the
 * settings section and anywhere else that names a theme share one fetch.
 *
 * The one write that changes this list is the registry's own create/delete,
 * which asks for a refetch — a picker still offering yesterday's names is a
 * picker that edits a theme the project no longer has.
 */
const [projectThemes, { refetch: refetchProjectThemes }] = createResource(
  listProjectThemes,
);

export { refetchProjectThemes };

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
        class="bare row-sm whitespace-nowrap text-text"
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
        class="bare row-sm whitespace-nowrap text-text"
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
 * Lists the themes the project serves — the shipped starters, forked by its
 * own files — not the studio's own chrome. The selected theme drives the
 * preview surface only; a `<label>` names it rather than a bare floating
 * select.
 */
export function ThemePicker(props: { compact?: boolean; full?: boolean }) {
  let select: HTMLSelectElement | undefined;
  // The options arrive after the select does, and the browser answers an
  // option list it just filled by selecting the first one — so the picker
  // read `console` while the editor was editing `silk`. Writing the value
  // once both are settled is the only thing that keeps them honest.
  createEffect(() => {
    if (select !== undefined && projectThemes() !== undefined) {
      select.value = activeName();
    }
  });
  const selectEl = (
    <select
      ref={select}
      id={props.compact ? "theme-picker-compact" : "theme-picker"}
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
  );
  if (props.compact === true) return selectEl;
  return (
    <div class="stack-sm">
      <div class="row-sm">
        <label for="theme-picker">Theme</label>
        {selectEl}
      </div>
      <ModePicker />
      <div class="row-sm" role="group" aria-label="Drawer edge">
        <span>Drawer</span>
        <button
          type="button"
          class="bare row-sm whitespace-nowrap text-text"
          aria-pressed={dockSide() === "left"}
          onClick={() => {
            setDockSide("left");
            globalThis.parent.postMessage("spin:side-left", "*");
          }}
        >
          <span
            class="inline-block icon-md i-lucide-panel-left"
            aria-hidden="true"
          />
          <span>Left</span>
        </button>
        <button
          type="button"
          class="bare row-sm whitespace-nowrap text-text"
          aria-pressed={dockSide() === "right"}
          onClick={() => {
            setDockSide("right");
            globalThis.parent.postMessage("spin:side-right", "*");
          }}
        >
          <span
            class="inline-block icon-md i-lucide-panel-right"
            aria-hidden="true"
          />
          <span>Right</span>
        </button>
      </div>
    </div>
  );
}
