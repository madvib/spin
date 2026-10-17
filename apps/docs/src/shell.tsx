/**
 * The router and the theme state, hand-rolled.
 *
 * Two reasons a library is not pulled in: the routes are five, and the theme
 * state is the demo. Setting `data-theme` on the document element is the
 * product's whole switching story, and the docs site doing it live — four
 * starters, real CSS, no iframe — is the pitch working on itself.
 */
import { createEffect, createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { starterThemes, themeModes } from "@spin/theme/themes";

const [path, setPath] = createSignal(
  typeof location === "undefined" ? "/" : location.pathname,
);

addEventListener("popstate", () => setPath(location.pathname));

/** Route to an internal path. All links go through here. */
export function navigate(to: string): void {
  if (to === path()) return;
  history.pushState(null, "", to);
  setPath(to);
  scrollTo({ top: 0 });
}

export { path };

/** An internal link that routes instead of reloading. */
export function Link(
  props: { href: string; class?: string; children: JSX.Element },
): JSX.Element {
  return (
    <a
      href={props.href}
      class={props.class}
      onClick={(event) => {
        if (
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
        ) {
          return;
        }
        event.preventDefault();
        navigate(props.href);
      }}
    >
      {props.children}
    </a>
  );
}

/* ------------------------------------------------------------------ *
 * Theme state: the starter the site wears, and the mode of it.
 * ------------------------------------------------------------------ */

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

/** The starters, in a stable order that reads: product, poster, terminal, widow. */
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
