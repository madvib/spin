/**
 * The studio's own controls: the theme under edit, the mode it is shown in,
 * and the edge the host's drawer takes.
 *
 * All three are studio elements (`apps/studio/src/lib/components/`), each
 * delegating to a `@spinjs/components` machine. The studio binds the
 * project's own facts — names, modes, the seat — and the machine owns
 * open/highlight/select. The preview surface scopes `data-theme`/`data-mode`
 * to `.spin-preview` while the chrome stays in `studio`, so all three bind
 * with document sync off.
 */

import { createEffect, createResource, createSignal } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { modePicker, themePicker, toggleGroup } from "@spinjs/components";
import { starterThemes } from "@spinjs/theme/themes";
import {
  activeBrand,
  activeModes,
  activeName,
  dockSide,
  modeChoice,
  setActiveMode,
  setActiveName,
  setDockSide,
  systemMode,
} from "../lib/store.ts";
import type { ModeChoice } from "../lib/store.ts";
import { analyzeTheme, declaredModes } from "../lib/theme.ts";
import { tokenValue } from "../lib/overview.ts";
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
/** The project themes as picker options: value, label, and served modes. */
export function themeOffered(): readonly { value: string; label: string; modes: string[] }[] {
  const all = projectThemes() ?? [];
  const locals = all.filter(
    (theme) => theme.file !== null || !(theme.name in starterThemes),
  );
  const shown = activeBrand() !== undefined && locals.length > 0 ? locals : all;
  return shown.map((theme) => ({
    value: theme.name,
    label: theme.name,
    modes: [...declaredModes(theme.text)],
  }));
}

/**
 * Paints each offered theme's swatch utilities in its own colours.
 *
 * The TopBar sits in `data-theme="studio"`, outside the preview scope, so
 * the project themes' `[data-theme]` rules do not exist here. Each offered
 * theme's swatch utilities (`bg-surface`, `bg-primary`, `bg-text`) are
 * scoped to the picker's own `data-theme` rows instead — resolved values,
 * so every swatch paints its theme's real colours.
 */
export function paintThemeSwatches(): void {
  const themes = projectThemes() ?? [];
  let style = document.getElementById("studio-theme-swatches");
  if (style === null) {
    style = document.createElement("style");
    style.id = "studio-theme-swatches";
    document.head.appendChild(style);
  }
  const rules: string[] = [];
  for (const theme of themes) {
    const { tree } = analyzeTheme(theme.text);
    if (tree === undefined) continue;
    const mode = declaredModes(theme.text)[0] ?? "light";
    const decl = (path: string, prop: string): string => {
      const value = tokenValue(tree, mode, path);
      return value === undefined ? "" : `${prop}: ${value};`;
    };
    rules.push(
      `[data-swatch-theme="${theme.name}"] { ${decl("color.surface", "--color-surface")} ${decl("color.primary", "--color-primary")} ${decl("color.on-primary", "--color-on-primary")} ${decl("color.text", "--color-text")} ${decl("color.border", "--color-border")} }`,
    );
  }
  style.textContent = rules.join("\n");
}

/**
 * The project theme picker.
 *
 * A swatch in the bar and a panel over the page. The panel lists the themes
 * the project serves — local files beside the unforked brand — not
 * the studio's own chrome. The selected theme drives the preview surface
 * only.
 */
export function ThemePicker() {
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, themePicker);
  createEffect(() => paintThemeSwatches());
  createEffect(() =>
    ctl.bind(
      {
        value: activeName(),
        themes: themeOffered(),
        syncDocument: false,
      },
      {
        "value-change": (event: CustomEvent<{ value: string }>) => {
          setActiveName(event.detail.value);
        },
      },
    )
  );
  return (
    <studio-theme-picker
      ref={(el: HTMLElement) => setElement(el)}
      id="studio-theme-picker"
      prop:value={activeName()}
      prop:themes={themeOffered()}
    />
  );
}

/**
 * The mode control.
 *
 * ONE button, cycling light → dark → system on click. A theme that serves a
 * single mode disables the button rather than letting the press lie.
 */
export function ModePicker() {
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, modePicker);
  createEffect(() =>
    ctl.bind(
      {
        value: modeChoice(),
        modes: [...activeModes()],
        hideWhenSingle: activeModes().length <= 1,
        systemMode: systemMode(),
        syncDocument: false,
      },
      {
        "value-change": (event: CustomEvent<{ value: string }>) => {
          const next = event.detail.value;
          setActiveMode(next === "dark" || next === "system" ? next : "light");
        },
      },
    )
  );
  return (
    <studio-mode-pill
      ref={(el: HTMLElement) => setElement(el)}
      id="studio-mode-picker"
      prop:value={modeChoice()}
      prop:modes={[...activeModes()]}
      prop:hideWhenSingle={activeModes().length <= 1}
    />
  );
}

/**
 * Which edge the host's drawer takes.
 *
 * The studio does not know where the host will put it, so it asks: the host
 * answers with a message and the layout re-branches in place. A handedness
 * choice rather than a session one, so it is remembered.
 */
export function DrawerEdge() {
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, toggleGroup);
  const apply = (side: string): void => {
    if (side !== "left" && side !== "right") return;
    setDockSide(side);
    globalThis.parent.postMessage(`spin:side-${side}`, "*");
  };
  createEffect(() =>
    ctl.bind(
      { value: [dockSide()] },
      {
        "value-change": (event: CustomEvent<{ value: readonly string[] }>) => {
          const next = event.detail.value[0];
          if (next !== undefined) apply(next);
        },
      },
    )
  );
  return (
    <studio-drawer-edge
      ref={(el: HTMLElement) => setElement(el)}
      id="studio-drawer-edge"
      prop:value={[dockSide()]}
    />
  );
}

export type { ModeChoice };
