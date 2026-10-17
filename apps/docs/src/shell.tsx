/**
 * Theme state only now that the router does the routing.
 *
 * Setting `data-theme` on the document element is the product's whole
 * switching story; the site doing it live — the shipped starters, real CSS,
 * no iframe — is the product working on itself.
 */
import { createEffect, createSignal } from "solid-js";
import { starterThemes, themeModes } from "@spin/theme/themes";

type StarterName = keyof typeof starterThemes;

const read = (key: string): string | null =>
  typeof localStorage === "undefined" ? null : localStorage.getItem(key);

const [themeName, setThemeName] = createSignal<string>(
  read("spin-docs-theme") ?? "widow",
);
const [modeName, setModeName] = createSignal<string>(
  read("spin-docs-mode") ?? "light",
);

/** The modes a starter supports, so the switcher never offers a lie. */
export const modesFor = (name: string): readonly string[] => {
  const document_ = starterThemes[name as StarterName];
  return document_ ? themeModes(document_) : ["light"];
};

/** The shipped starters, in a stable order. */
export const starterList: readonly string[] = [
  "default",
  "neobrut",
  "console",
  "widow",
];

createEffect(() => {
  const name = themeName();
  const supported = modesFor(name);
  if (!supported.includes(modeName())) setModeName(supported[0]);
});

createEffect(() => {
  document.documentElement.dataset.theme = themeName();
  document.documentElement.dataset.mode = modeName();
  localStorage.setItem("spin-docs-theme", themeName());
  localStorage.setItem("spin-docs-mode", modeName());
});

export const theme = themeName;
export const setTheme = setThemeName;
export const mode = modeName;
export const setMode = setModeName;
