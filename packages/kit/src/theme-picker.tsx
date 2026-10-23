/**
 * The one theme + appearance control every spin app uses.
 *
 * Trigger: the current theme's name and an appearance icon. The panel: every
 * theme with a live swatch preview of that document's own tokens, and a
 * sun/moon pair for the mode (shown only for two-mode themes). Names carry
 * themes; icons carry appearance.
 *
 * The control reads a {@link ThemeState}. An app that serves the shipped
 * starters uses the default one; an app that serves its own projects' themes
 * passes the state it created, and the control reads the same facts from it.
 */
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { JSX } from "solid-js";
import { themeModes } from "@spin/theme/themes";
import type { ThemeState } from "./theme-state.ts";
import { defaultThemeState } from "./theme-state.ts";

export function Sun(props: { class?: string }): JSX.Element {
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

export function Moon(props: { class?: string }): JSX.Element {
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

/** The platform's face: two panes on a stand. */
function System(props: { class?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

/**
 * The mode toggle: light, dark, and — where the app offers it — the system
 * appearance. One button per mode the active theme serves; the current want
 * reads pressed.
 */
export function ModeToggle(
  props: { state?: ThemeState; system?: boolean; class?: string } = {},
): JSX.Element {
  const state = props.state ?? defaultThemeState;
  const modes = () => modesOf(state.documents[state.theme()]);
  const offerSystem = () => props.system === true;
  const shown = () =>
    (offerSystem()
      ? [...modes(), "system"]
      : [...modes()]) as readonly string[];
  return (
    <div
      class={`flex items-center gap-1 ${props.class ?? ""}`}
      role="group"
      aria-label="appearance"
    >
      <For each={shown()}>
        {(name) => (
          <button
            type="button"
            onClick={() => state.setWant(name)}
            aria-label={name === "system"
              ? "follow the system appearance"
              : `${name} appearance`}
            aria-pressed={state.want() === name}
            class={`rounded-sm border p-1 transition-colors duration-fast ${
              state.want() === name
                ? "border-primary text-primary"
                : "border-border text-text-muted hover:text-text"
            }`}
          >
            {name === "light"
              ? <Sun class="h-4 w-4" />
              : name === "dark"
              ? <Moon class="h-4 w-4" />
              : <System class="h-4 w-4" />}
          </button>
        )}
      </For>
    </div>
  );
}
/** Three chips of a document's own colours: surface, primary, text. */
function Swatches(props: { document: unknown }): JSX.Element {
  const color = (token: string): string => {
    const doc = props.document as
      | { color?: Record<string, { $value?: unknown }> }
      | undefined;
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

/** The modes a document serves, as the picker offers them. */
function modesOf(document: unknown): readonly string[] {
  if (document === undefined) return ["light"];
  const served = themeModes(document as Parameters<typeof themeModes>[0])
    .filter((mode) => mode === "light" || mode === "dark");
  return served.length > 0 ? served : ["light"];
}

export interface ThemePickerProps {
  /** The state to drive. Defaults to the kit's starter state. */
  readonly state?: ThemeState;
  /** Offer the platform's appearance as a third choice. */
  readonly system?: boolean;
  /** Extra classes on the control's wrapper. */
  readonly class?: string;
  /** Extra classes on the trigger. */
  readonly triggerClass?: string;
}

export function ThemePicker(props: ThemePickerProps = {}): JSX.Element {
  const state = props.state ?? defaultThemeState;
  const [open, setOpen] = createSignal(false);
  let panel: HTMLDivElement | undefined;
  let trigger: HTMLButtonElement | undefined;

  const onDocClick = (event: MouseEvent) => {
    if (!open()) return;
    const target = event.target as Node | null;
    if (panel?.contains(target) || trigger?.contains(target)) return;
    setOpen(false);
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

  const modes = () => modesOf(state.documents[state.theme()]);
  const offerSystem = () => props.system === true;

  return (
    <div class={`relative ${props.class ?? ""}`}>
      <button
        ref={(el) => {
          trigger = el;
        }}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open()}
        onClick={(event) => {
          // The document's click listener closes the panel. The trigger's own
          // click is what opened it, so it must not reach that listener in the
          // same tick — which is why the picker used to open and close at once.
          event.stopPropagation();
          setOpen(!open());
        }}
        class={[
          "secondary s-sm flex min-w-0 items-center gap-2",
          props.triggerClass ?? "",
        ].filter(Boolean).join(" ")}
      >
        <span class="min-w-0 flex-1 truncate text-left">{state.theme()}</span>
        <Show
          when={state.want() === "system"}
          fallback={state.mode() === "dark"
            ? <Moon class="h-4 w-4" />
            : <Sun class="h-4 w-4" />}
        >
          <System class="h-4 w-4" />
        </Show>
      </button>
      <Show when={open()}>
        <div
          ref={(el) => {
            panel = el;
          }}
          role="dialog"
          aria-label="theme and appearance"
          class="absolute end-0 top-full z-dropdown mt-2 w-max min-w-32 max-w-[calc(100vw-2rem)] border border-border bg-surface rounded-md shadow-lg p-2"
        >
          <span class="block px-2 py-1 text-xs font-semibold text-text-muted">
            theme
          </span>
          <For each={state.names}>
            {(name) => (
              <button
                type="button"
                onClick={() => state.setTheme(name)}
                aria-pressed={state.theme() === name}
                class={`flex w-full items-center justify-between gap-4 px-2 py-1 text-sm rounded-sm transition-colors duration-fast ${
                  state.theme() === name
                    ? "bg-surface-raised text-text font-semibold"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <span>{name}</span>
                <Swatches document={state.documents[name]} />
              </button>
            )}
          </For>
          <Show when={modes().length > 1 || offerSystem()}>
            <span class="block mt-2 px-2 py-1 text-xs font-semibold text-text-muted">
              appearance
            </span>
            <div class="flex gap-2 px-2 py-1">
              <For
                each={(offerSystem()
                  ? [...modes(), "system"]
                  : [...modes()]) as readonly string[]}
              >
                {(name) => (
                  <button
                    type="button"
                    onClick={() => state.setWant(name)}
                    aria-label={name === "system"
                      ? "follow the system appearance"
                      : `${name} appearance`}
                    aria-pressed={state.want() === name}
                    class={`rounded-sm p-1 border transition-colors duration-fast ${
                      state.want() === name
                        ? "border-primary text-primary"
                        : "border-border text-text-muted hover:text-text"
                    }`}
                  >
                    {name === "light"
                      ? <Sun class="h-4 w-4" />
                      : name === "dark"
                      ? <Moon class="h-4 w-4" />
                      : <System class="h-4 w-4" />}
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
