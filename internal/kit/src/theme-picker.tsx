/**
 * The one theme + appearance control every spin app uses.
 *
 * A single cycle button for appearance (light → dark → system, driven by
 * `@spinjs/components/mode-picker`) and a dropdown for the theme (driven
 * by `@spinjs/components/theme-picker`, with live swatches painted by the
 * stylesheet's own cascade). Names carry themes; icons carry appearance.
 *
 * The control reads a {@link ThemeState}. An app that serves the shipped
 * languages uses the default one; an app that serves its own projects' themes
 * passes the state it created, and the control reads the same facts from it.
 *
 * When the state serves palettes or spacings, the theme dropdown is joined
 * by an appearance popover with three grouped axes — Design Language,
 * Palette, Density — so the docs can demonstrate the full composition while
 * project apps keep the single theme control.
 */
import { createEffect, createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { modePicker, themePicker } from "@spinjs/components";
import { attachPopover, type PopoverApi } from "@spinjs/components/popover";
import type { ThemeState } from "./theme-state.ts";
import { defaultThemeState } from "./theme-state.ts";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "mode-picker-basic": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        id?: string;
        class?: string;
        "prop:value"?: string;
        "prop:modes"?: readonly string[];
      };
      "theme-picker-basic": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        id?: string;
        class?: string;
        "prop:value"?: string;
        "prop:themes"?: readonly unknown[];
      };
      popover: {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        id?: string;
        class?: string;
        popover?: string;
        role?: string;
        children?: unknown;
      };
    }
  }
}

/**
 * The mode toggle: a single button cycling light → dark → system on
 * two-mode themes, disabled on single-mode ones.
 */
export function ModeToggle(
  props: { state?: ThemeState; class?: string; id?: string } = {},
): JSX.Element {
  const state = props.state ?? defaultThemeState;
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, modePicker);
  // Props down, events up: the machine owns the cycle order and the
  // single-mode clamp, and the choice it reports seats the state.
  createEffect(() =>
    ctl.bind(
      {
        value: state.want() === "dark" ? "dark" : state.want() === "system" ? "system" : "light",
        modes: [...state.modes()],
        syncDocument: true,
      },
      {
        "value-change": (event: CustomEvent<{ value: string }>) => {
          state.setWant(event.detail.value);
        },
      },
    )
  );
  return (
    <mode-picker-basic
      ref={(el: HTMLElement) => setElement(el)}
      id={props.id ?? "kit-mode-toggle"}
      class={props.class ?? ""}
      prop:value={state.want() === "dark" ? "dark" : state.want() === "system" ? "system" : "light"}
      prop:modes={[...state.modes()]}
    />
  );
}

export interface ThemePickerProps {
  /** The state to drive. Defaults to the kit's shipped-language state. */
  readonly state?: ThemeState;
  /** Extra classes on the control's wrapper. */
  readonly class?: string;
  /** Element id base, so two pickers on one page stay addressable. */
  readonly id?: string;
}

function titleCase(word: string): string {
  return word.length === 0 ? word : `${word[0]!.toUpperCase()}${word.slice(1)}`;
}

export function ThemePicker(props: ThemePickerProps = {}): JSX.Element {
  const state = props.state ?? defaultThemeState;
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, themePicker);
  createEffect(() =>
    ctl.bind(
      {
        value: state.theme(),
        themes: [...state.names],
        syncDocument: true,
      },
      {
        "value-change": (event: CustomEvent<{ value: string }>) => {
          state.setTheme(event.detail.value);
        },
      },
    )
  );
  const [panel, setPanel] = createSignal<HTMLElement>();
  const [appearance, setAppearance] = createSignal<PopoverApi | undefined>(undefined);
  createEffect(() => {
    const host = panel();
    if (host === undefined) return;
    setAppearance(attachPopover(host));
  });
  const triggerProps = (): Record<string, unknown> => appearance()?.getTriggerProps() ?? {};
  const contentProps = (): Record<string, unknown> => appearance()?.getContentProps() ?? {};
  const id = () => props.id ?? "kit-theme-picker";
  const activePaletteLabel = (): string | null => {
    const current = state.palette();
    if (current === "") return null;
    return state.paletteOptions().find((opt) => opt.value === current)?.label ?? titleCase(current);
  };
  const hasFacets = (): boolean =>
    state.paletteOptions().length > 0 || state.spacings.length > 0;

  return (
    <div class={`flex items-center gap-2 ${props.class ?? ""}`}>
      <Show
        when={hasFacets()}
        fallback={
          <theme-picker-basic
            ref={(el: HTMLElement) => setElement(el)}
            id={id()}
            prop:value={state.theme()}
            prop:themes={[...state.names]}
          />
        }
      >
        <span ref={(el: HTMLElement) => setPanel(el)} class="contents">
          <button
            type="button"
            {...triggerProps()}
            aria-label="Appearance settings"
            class="bare inline-flex h-8 items-center gap-2 rounded-md border bg-surface px-3 type-label transition-colors hover:bg-surface-raised"
          >
            <span class="inline-flex items-center gap-1" aria-hidden="true">
              <span class="h-2 w-2 shrink-0 rounded-full border bg-surface" />
              <span class="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span class="h-2 w-2 shrink-0 rounded-full bg-accent" />
            </span>
            <span>{titleCase(state.theme())}</span>
            <Show when={activePaletteLabel()}>
              {(palLabel) => (
                <span class="hidden type-caption text-muted sm:inline">· {palLabel()}</span>
              )}
            </Show>
            <span class="i-lucide-chevron-down icon-sm shrink-0 text-muted" aria-hidden="true" />
          </button>
          <popover
            {...contentProps()}
            class="m-0 min-w-[21rem] rounded-lg border bg-surface-raised p-3 shadow-lg position-area-bottom-span-left"
          >
            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-1">
                <span class="type-caption-emphasized text-muted">Design language</span>
                <div role="listbox" aria-label="Design Language" class="grid grid-cols-2 gap-1">
                  <For each={state.names}>
                    {(name) => {
                      const active = () => state.theme() === name;
                      return (
                        <button
                          type="button"
                          role="option"
                          aria-selected={active()}
                          onClick={() => state.setTheme(name)}
                          class={`bare flex h-8 items-center gap-2 rounded-md border px-2 text-left type-label transition-colors ${
                            active()
                              ? "border-primary bg-surface text-primary"
                              : "border bg-surface/60 hover:border-strong hover:bg-surface"
                          }`}
                        >
                          <span
                            data-swatch-theme={name}
                            class="inline-flex shrink-0 items-center gap-1"
                            aria-hidden="true"
                          >
                            <span class="h-2 w-2 rounded-full border bg-surface" />
                            <span class="h-2 w-2 rounded-full bg-primary" />
                          </span>
                          <span class="min-w-0 flex-1 truncate">{titleCase(name)}</span>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </div>

              <Show when={state.paletteOptions().length > 0}>
                <div class="flex flex-col gap-1">
                  <span class="type-caption-emphasized text-muted">Palette</span>
                  <div role="listbox" aria-label="Palette" class="grid grid-cols-3 gap-1">
                    <For each={state.paletteOptions()}>
                      {(option) => {
                        const active = () => state.palette() === option.value;
                        return (
                          <button
                            type="button"
                            role="option"
                            aria-selected={active()}
                            onClick={() => state.setPalette(option.value)}
                            class={`bare flex h-7 items-center justify-center gap-1 rounded-md border px-2 type-caption-emphasized transition-colors ${
                              active()
                                ? "border-primary bg-surface text-primary"
                                : "border bg-surface/60 text-muted hover:border-strong hover:bg-surface"
                            }`}
                          >
                            <span
                              data-swatch-theme={option.value === "" ? state.theme() : undefined}
                              data-swatch-palette={option.value === "" ? undefined : option.value}
                              class="inline-flex shrink-0 items-center"
                              aria-hidden="true"
                            >
                              <span class="h-2 w-2 rounded-full bg-primary" />
                            </span>
                            <span class="truncate">{option.label}</span>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </Show>

              <Show when={state.spacings.length > 0}>
                <div class="flex flex-col gap-1">
                  <span class="type-caption-emphasized text-muted">Density</span>
                  <div
                    role="listbox"
                    aria-label="Density"
                    class="grid grid-cols-3 gap-1 rounded-md border bg-surface p-1"
                  >
                    <For
                      each={[
                        { value: "compact", label: "Compact" },
                        { value: "", label: "Default" },
                        { value: "spacious", label: "Spacious" },
                      ].filter((opt) => opt.value === "" || state.spacings.includes(opt.value))}
                    >
                      {(option) => {
                        const active = () => state.spacing() === option.value;
                        return (
                          <button
                            type="button"
                            role="option"
                            aria-selected={active()}
                            onClick={() => state.setSpacing(option.value)}
                            class={`bare flex h-6 items-center justify-center rounded-sm px-2 type-caption transition-colors ${
                              active()
                                ? "bg-primary text-on-primary"
                                : "text-muted hover:bg-surface-raised"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </Show>
            </div>
          </popover>
        </span>
      </Show>
      <ModeToggle
        state={state}
        id={props.id === undefined ? undefined : `${props.id}-mode`}
      />
    </div>
  );
}
