/**
 * The theme state, once, for every app.
 *
 * One signal pair (which theme, which mode), one effect that writes
 * `data-theme`/`data-mode` on the document element, one persistence pair.
 * Apps re-export or import this; they do not reimplement it.
 *
 * The default instance knows the starters. An app that serves more themes —
 * the reference app serves its project's named set beside them —
 * calls `createThemeState` with its own document map, and keeps the same
 * behaviour: the stored name is clamped to one that exists, a mode the theme
 * does not serve falls back to one it does, and the document element is the
 * one place the rendering is declared.
 */
import { createEffect, createSignal } from "solid-js";
import type { Accessor } from "solid-js";
import { starterThemes, themeModes } from "../theme/themes/index.ts";

export type StarterName = keyof typeof starterThemes;

/** A theme document, by name. The shape is the theme package's business. */
export type ThemeDocuments = Readonly<Record<string, unknown>>;

/** The starters, derived from the package — no list anyone maintains. */
export const starterList: readonly string[] = Object.keys(starterThemes).sort();

/** The modes a starter supports, so the control never offers a lie. */
export const modesFor = (name: string): readonly string[] => {
  const doc = starterThemes[name as StarterName];
  return doc ? themeModes(doc) : ["light"];
};

/**
 * What a state needs to know about the app it lives in.
 *
 * Every field has a default: the starters, the first served name,
 * the kit's storage keys. An app that brings its own themes brings only those.
 */
export interface ThemeStateOptions {
  /** The theme documents this app serves. Defaults to the starters. */
  readonly documents?: ThemeDocuments;
  /** The theme a first visit starts on. Defaults to the first served name. */
  readonly initialTheme?: string;
  /** The mode a first visit starts on. Defaults to `system`. */
  readonly initialMode?: string;
  /** Where the choice is remembered. */
  readonly storage?: { readonly theme: string; readonly mode: string };
  /** Whether the reader may ask for the platform's mode. */
  readonly followSystem?: boolean;
}

/** The state every theme control reads. */
export interface ThemeState {
  /** The theme being served. */
  readonly theme: Accessor<string>;
  /** Serve another theme. A name the app does not hold is ignored. */
  readonly setTheme: (name: string) => void;
  /**
   * The appearance the reader asked for: `light`, `dark`, or `system`.
   *
   * This is what a control labels itself from — "use dark mode" is a request,
   * not a statement about the rendering.
   */
  readonly want: Accessor<string>;
  /** Ask for an appearance. */
  readonly setWant: (mode: string) => void;
  /** The appearance actually applied: `light` or `dark`. */
  readonly mode: Accessor<string>;
  /** Ask for an appearance; the same verb as {@link setWant}. */
  readonly setMode: (mode: string) => void;
  /** The themes this app serves, in name order. */
  readonly names: readonly string[];
  /** The documents this app serves, for a swatch or a mode lookup. */
  readonly documents: ThemeDocuments;
  /** The modes the current theme serves. */
  readonly modes: Accessor<readonly string[]>;
}

const read = (key: string): string | null =>
  typeof localStorage === "undefined" ? null : localStorage.getItem(key);

/** The platform's preference, and a getter for an engine without the query. */
function systemPreference(): "light" | "dark" {
  if (typeof globalThis.matchMedia !== "function") return "light";
  return globalThis.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** The modes a document serves, as renderings; a theme with none serves one. */
function servedModes(
  documents: ThemeDocuments,
  name: string,
): readonly string[] {
  const doc = documents[name];
  if (doc === undefined) return ["light"];
  const modes = themeModes(doc as Parameters<typeof themeModes>[0]);
  const served = modes.filter((mode) => mode === "light" || mode === "dark");
  return served.length > 0 ? served : ["light"];
}

/**
 * A theme state over the documents an app serves.
 *
 * Created at the app's root: the signals belong to that app, and the effect
 * writes the document element the app is rendered into. The default instance
 * below is the same function over the starters.
 */
export function createThemeState(
  options: ThemeStateOptions = {},
): ThemeState {
  const documents = options.documents ?? starterThemes;
  const names = Object.keys(documents).sort();
  const storage = options.storage ??
    { theme: "spin:theme", mode: "spin:mode" };

  const storedTheme = read(storage.theme);
  const fallbackTheme = names[0] ?? "";
  const initialTheme = storedTheme !== null && storedTheme in documents
    ? storedTheme
    : (options.initialTheme ?? fallbackTheme);
  const [themeName, setThemeName] = createSignal(initialTheme);

  const [system, setSystem] = createSignal<"light" | "dark">(
    systemPreference(),
  );
  const [want, setWant] = createSignal(
    read(storage.mode) ?? options.initialMode ?? "system",
  );

  // The platform preference is live: a reader on `system` whose OS flips must
  // see the page follow without touching the control again.
  if (
    options.followSystem !== false &&
    typeof globalThis.matchMedia === "function"
  ) {
    const query = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystem(query.matches ? "dark" : "light");
    sync();
    query.addEventListener("change", sync);
  }

  const modes = (): readonly string[] => servedModes(documents, themeName());

  /**
   * The rendering the document wears.
   *
   * A request the theme cannot serve is clamped to the first one it can: a
   * single-mode theme never renders as a mode it does not have, and a reader
   * arriving from a dark theme with "dark" wanted lands on the base instead
   * of a mode that renders nothing different.
   *
   * A function rather than a memo: the state is created by an app's root and
   * also by a test with no root, and a function tracks the signals where it
   * is read in both.
   */
  const mode = (): string => {
    const requested = want();
    const served = modes();
    if (requested === "system") {
      return served.includes(system()) ? system() : served[0] ?? "light";
    }
    if (served.includes(requested)) return requested;
    return served[0] ?? "light";
  };

  createEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = themeName();
    document.documentElement.dataset.mode = mode();
    localStorage.setItem(storage.theme, themeName());
    localStorage.setItem(storage.mode, want());
  });

  return {
    theme: themeName,
    setTheme: (name) => {
      if (name in documents) setThemeName(name);
    },
    want,
    setWant,
    mode,
    setMode: setWant,
    names,
    documents,
    modes,
  };
}

/**
 * The default state: the starters, remembered under the kit's keys.
 *
 * Built on first use, not at import: creating it stamps the document and
 * the storage, so a page with its own state (which imports this module for
 * the controls) must not get a second state stamping over it. The docs and
 * any small app serve exactly the starters and have one document; they
 * reach it through these bindings, which build it when first read. An app
 * with its own theme map calls `createThemeState` instead and hands the
 * result to the controls.
 */
let defaultState: ThemeState | undefined;
function defaultStateOf(): ThemeState {
  return (defaultState ??= createThemeState());
}

export const defaultThemeState: ThemeState = new Proxy({} as ThemeState, {
  get: (_target, key) => Reflect.get(defaultStateOf(), key as string),
  set: (_target, key, value) => Reflect.set(defaultStateOf(), key as string, value),
  has: (_target, key) => Reflect.has(defaultStateOf(), key as string),
  ownKeys: () => Reflect.ownKeys(defaultStateOf()),
  getOwnPropertyDescriptor: (_target, key) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(defaultStateOf(), key as string);
    if (descriptor === undefined) return undefined;
    return { ...descriptor, configurable: true };
  },
});
export const theme: ThemeState["theme"] = (...args: []) => defaultStateOf().theme();
export const setTheme: ThemeState["setTheme"] = (name) => defaultStateOf().setTheme(name);
export const want: ThemeState["want"] = () => defaultStateOf().want();
export const setWant: ThemeState["setWant"] = (m) => defaultStateOf().setWant(m);
export const mode: ThemeState["mode"] = () => defaultStateOf().mode();
export const setMode: ThemeState["setMode"] = (m) => defaultStateOf().setMode(m);
export const starterDocuments: ThemeState["documents"] = new Proxy({} as ThemeState["documents"], {
  get: (_target, key) => Reflect.get(defaultStateOf().documents, key as string),
  has: (_target, key) => Reflect.has(defaultStateOf().documents, key as string),
  ownKeys: () => Reflect.ownKeys(defaultStateOf().documents),
  getOwnPropertyDescriptor: (_target, key) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(defaultStateOf().documents, key as string);
    if (descriptor === undefined) return undefined;
    return { ...descriptor, configurable: true };
  },
});
