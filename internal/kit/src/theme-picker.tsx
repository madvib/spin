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

/** One axis of the appearance composer: its heading, options, and the choice in force. */
function AxisGroup(props: {
  heading: string;
  options: readonly { value: string; label: string }[];
  current: string;
  onPick: (value: string) => void;
}): JSX.Element {
  const optionClass = (active: boolean): string =>
    `bare flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-left type-body ${
      active ? "bg-selected text-on-selected" : "hover:bg-surface-raised"
    }`;
  return (
    <div class="flex min-w-0 flex-col gap-1">
      <span class="px-2 type-caption-emphasized text-muted">{props.heading}</span>
      <div role="listbox" aria-label={props.heading} class="flex min-w-0 flex-col gap-0">
        <For each={props.options}>
          {(option) => {
            const active = () => props.current === option.value;
            return (
              <button
                type="button"
                role="option"
                aria-selected={active()}
                class={optionClass(active())}
                onClick={() => props.onPick(option.value)}
              >
                <span>{option.label}</span>
                <Show when={active()}>
                  <span class="i-lucide-check icon-sm" aria-hidden="true" />
                </Show>
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
}

export function ThemePicker(props: ThemePickerProps = {}): JSX.Element {
  const state = props.state ?? defaultThemeState;
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, themePicker);
  // The machine owns open/highlight/select; the names it offers are the
  // state's, and the pick it reports seats the theme.
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
  const summary = (): string => {
    const parts = [state.theme()];
    if (state.palette() !== "") parts.push(state.palette());
    if (state.spacing() !== "") parts.push(state.spacing());
    return parts.join(" · ");
  };
  return (
    <div class={`flex items-center gap-1 ${props.class ?? ""}`}>
      <Show
        when={state.palettes.length > 0 || state.spacings.length > 0}
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
            class="bare flex w-64 items-center gap-2 truncate rounded-lg border bg-surface px-2 py-1 type-body"
          >
            <span class="min-w-0 flex-1 truncate">{summary()}</span>
            <span class="i-lucide-chevron-down icon-sm shrink-0 text-muted" aria-hidden="true" />
          </button>
          <popover
            {...contentProps()}
            class="m-0 w-64 rounded-lg border bg-surface-raised p-2 shadow-md position-area-bottom-span-right"
          >
            <div class="flex flex-col gap-3">
              <AxisGroup
                heading="Design Language"
                options={state.names.map((name) => ({ value: name, label: name }))}
                current={state.theme()}
                onPick={(value) => state.setTheme(value)}
              />
              <Show when={state.palettes.length > 0}>
                <AxisGroup
                  heading="Palette"
                  options={[{ value: "", label: "Default" }, ...state.palettes.map((name) => ({ value: name, label: name }))]}
                  current={state.palette()}
                  onPick={(value) => state.setPalette(value)}
                />
              </Show>
              <Show when={state.spacings.length > 0}>
                <AxisGroup
                  heading="Density"
                  options={[{ value: "", label: "Default" }, ...state.spacings.map((name) => ({ value: name, label: name }))]}
                  current={state.spacing()}
                  onPick={(value) => state.setSpacing(value)}
                />
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
