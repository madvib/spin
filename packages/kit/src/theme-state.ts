/**
 * The theme state, once, for every app.
 *
 * One signal pair (which starter, which mode), one effect that writes
 * `data-theme`/`data-mode` on the document element, one persistence pair.
 * Apps re-export or import this; they do not reimplement it.
 */
import { createEffect, createSignal } from "solid-js";
import { starterThemes, themeModes } from "@spin/theme/themes";

export type StarterName = keyof typeof starterThemes;

/** The starters, derived from the package — no list anyone maintains. */
export const starterList: readonly string[] = Object.keys(starterThemes).sort();

/** The modes a starter supports, so the control never offers a lie. */
export const modesFor = (name: string): readonly string[] => {
  const doc = starterThemes[name as StarterName];
  return doc ? themeModes(doc) : ["light"];
};

const read = (key: string): string | null =>
  typeof localStorage === "undefined" ? null : localStorage.getItem(key);

const [themeName, setThemeName] = createSignal<string>(
  read("spin:theme") ?? "spin",
);
const [modeName, setModeName] = createSignal<string>(
  read("spin:mode") ?? "light",
);

// A stored choice that no longer exists falls back cleanly, and a starter
// that loses a mode drops to one it has.
createEffect(() => {
  if (!(themeName() in starterThemes)) setThemeName("spin");
  const supported = modesFor(themeName());
  if (!supported.includes(modeName())) setModeName(supported[0]);
});

createEffect(() => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = themeName();
  document.documentElement.dataset.mode = modeName();
  localStorage.setItem("spin:theme", themeName());
  localStorage.setItem("spin:mode", modeName());
});

export const theme = themeName;
export const setTheme = setThemeName;
export const mode = modeName;
export const setMode = setModeName;
