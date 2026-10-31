/**
 * The one theme + appearance control every spin app uses.
 *
 * A single cycle button for appearance (light → dark → system, driven by
 * `@spinjs/components/mode-picker`) and a dropdown for the theme (driven
 * by `@spinjs/components/theme-picker`, with live swatches painted by the
 * stylesheet's own cascade). Names carry themes; icons carry appearance.
 *
 * The control reads a {@link ThemeState}. An app that serves the shipped
 * starters uses the default one; an app that serves its own projects' themes
 * passes the state it created, and the control reads the same facts from it.
 */
import { createEffect, createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { modePicker, themePicker } from "@spinjs/components";
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
  /** The state to drive. Defaults to the kit's starter state. */
  readonly state?: ThemeState;
  /** Extra classes on the control's wrapper. */
  readonly class?: string;
  /** Element id base, so two pickers on one page stay addressable. */
  readonly id?: string;
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
  return (
    <div class={`flex items-center gap-1 ${props.class ?? ""}`}>
      <theme-picker-basic
        ref={(el: HTMLElement) => setElement(el)}
        id={props.id ?? "kit-theme-picker"}
        prop:value={state.theme()}
        prop:themes={[...state.names]}
      />
      <ModeToggle
        state={state}
        id={props.id === undefined ? undefined : `${props.id}-mode`}
      />
    </div>
  );
}
