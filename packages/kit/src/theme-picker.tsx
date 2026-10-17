/**
 * The one theme + appearance control every spin app uses.
 *
 * Trigger: the current starter's name and an appearance icon. The panel:
 * every starter with a live swatch preview of that document's own tokens,
 * and a sun/moon pair for the mode (shown only for two-mode starters).
 * Names carry themes; icons carry appearance.
 */
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { JSX } from "solid-js";
import { starterThemes } from "@spin/theme/themes";
import {
  mode,
  modesFor,
  setMode,
  setTheme,
  starterList,
  theme,
} from "./theme-state.ts";

function Sun(props: { class?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      class={props.class}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function Moon(props: { class?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      class={props.class}
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </svg>
  );
}

/** Three chips of a starter's own document: surface, accent, text. */
function Swatches(props: { name: string }): JSX.Element {
  const color = (token: string): string => {
    const doc = starterThemes[
      props.name as keyof typeof starterThemes
    ] as { color?: Record<string, { $value?: unknown }> } | undefined;
    const value = doc?.color?.[token]?.$value;
    return typeof value === "string" ? value : "";
  };
  return (
    <span class="flex shrink-0 gap-1" aria-hidden="true">
      <For each={["surface", "primary", "text"]}>
        {(token) => (
          <span
            class="h-3 w-3 rounded-sm border border-border"
            style={{ "background-color": color(token) }}
          />
        )}
      </For>
    </span>
  );
}

export function ThemePicker(): JSX.Element {
  const [open, setOpen] = createSignal(false);
  let panel: HTMLDivElement | undefined;

  const onDocClick = (event: MouseEvent) => {
    if (!panel?.contains(event.target as Node)) setOpen(false);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
  };
  onMount(() => {
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    });
  });

  return (
    <div class="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open()}
        onClick={() => setOpen(!open())}
        class="flex items-center gap-2 border border-border bg-surface-raised text-text text-sm rounded-sm px-2 py-1 hover:border-border-strong transition-colors duration-fast"
      >
        <span>{theme()}</span>
        {mode() === "dark" ? <Moon class="h-4 w-4" /> : <Sun class="h-4 w-4" />}
      </button>
      <Show when={open()}>
        <div
          ref={panel}
          role="dialog"
          aria-label="theme and appearance"
          class="absolute right-0 z-50 mt-2 border border-border bg-surface rounded-md shadow-lg p-2"
        >
          <p class="m-0 px-2 py-1 text-xs font-semibold text-text-muted">
            theme
          </p>
          <For each={starterList}>
            {(name) => (
              <button
                type="button"
                onClick={() => setTheme(name)}
                aria-pressed={theme() === name}
                class={`flex w-full items-center justify-between gap-4 px-2 py-1 text-sm rounded-sm transition-colors duration-fast ${
                  theme() === name
                    ? "bg-surface-raised text-text font-semibold"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <span>{name}</span>
                <Swatches name={name} />
              </button>
            )}
          </For>
          <Show when={modesFor(theme()).length > 1}>
            <p class="m-0 mt-2 px-2 py-1 text-xs font-semibold text-text-muted">
              appearance
            </p>
            <div class="flex gap-2 px-2 py-1">
              <For each={["light", "dark"] as const}>
                {(name) => (
                  <button
                    type="button"
                    onClick={() => setMode(name)}
                    aria-label={`${name} appearance`}
                    aria-pressed={mode() === name}
                    class={`rounded-sm p-1 border transition-colors duration-fast ${
                      mode() === name
                        ? "border-primary text-primary"
                        : "border-border text-text-muted hover:text-text"
                    }`}
                  >
                    {name === "light"
                      ? <Sun class="h-4 w-4" />
                      : <Moon class="h-4 w-4" />}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
