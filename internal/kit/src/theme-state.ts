/**
 * The theme state, once, for every app.
 *
 * Four signal pairs — design language, palette, spacing, and mode — one
 * effect that writes `data-theme`/`data-palette`/`data-spacing`/`data-mode`
 * on the document element, one persistence pair per axis. Apps re-export or
 * import this; they do not reimplement it.
 *
 * The default instance knows the languages and the demo facets. An app that
 * serves more themes — the reference app serves its project's named set
 * beside them — calls `createThemeState` with its own document map, and
 * keeps the same behaviour: the stored name is clamped to one that exists,
 * a mode the theme does not serve falls back to one it does, and the
 * document element is the one place the rendering is declared.
 */
import { createEffect, createRoot, createSignal } from "solid-js";
import type { Accessor } from "solid-js";
import {
  demoSpacings,
  type DesignLanguageName,
  designLanguages,
  isDesignLanguage,
  languageDefaultPaletteLabels,
  languagePalettes,
  themeModes,
} from "@spinjs/theme";
/** A theme document, by name. The shape is the theme package's business. */
export type ThemeDocuments = Readonly<Record<string, unknown>>;

export const languageList: readonly DesignLanguageName[] = (
  Object.keys(designLanguages) as DesignLanguageName[]
).sort();

export const modesFor = (name: string): readonly string[] => {
  const doc = isDesignLanguage(name) ? designLanguages[name] : undefined;
  return doc ? themeModes(doc) : ["light"];
};

export interface PaletteChoice {
  readonly value: string;
  readonly label: string;
}

/**
 * What a state needs to know about the app it lives in.
 *
 * Every field has a default: the languages, the demo facets, the first
 * served name, the kit's storage keys. An app that brings its own themes
 * brings only those; an app that brings its own documents brings no
 * facets unless it names them.
 */
export interface ThemeStateOptions {
  /** The theme documents this app serves. Defaults to the languages. */
  readonly documents?: ThemeDocuments;
  /** The palettes this app serves. Defaults to the demo set with the default documents, else none. */
  readonly palettes?: readonly string[];
  /** The spacings this app serves. Defaults to the demo set with the default documents, else none. */
  readonly spacings?: readonly string[];
  /** The palette a first visit starts on. Defaults to the language's own ink. */
  readonly initialPalette?: string;
  /** The spacing a first visit starts on. Defaults to the language's own rhythm. */
  readonly initialSpacing?: string;
  /** The theme a first visit starts on. Defaults to the first served name. */
  readonly initialTheme?: string;
  /** The mode a first visit starts on. Defaults to `system`. */
  readonly initialMode?: string;
  /** Where the choice is remembered. */
  readonly storage?: { readonly theme: string; readonly mode: string; readonly palette?: string; readonly spacing?: string };
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
  /** The palettes served for the active theme. */
  readonly palettes: readonly string[];
  /** Labeled palette choices (including the language's default) for the active theme. */
  readonly paletteOptions: Accessor<readonly PaletteChoice[]>;
  /** The palette in force, or `""` for the language's own ink. */
  readonly palette: Accessor<string>;
  /** Serve another palette. `""` returns to the language's ink; an unknown name is ignored. */
  readonly setPalette: (name: string) => void;
  readonly spacings: readonly string[];
  /** The spacing in force, or `""` for the language's own rhythm. */
  readonly spacing: Accessor<string>;
  /** Serve another spacing. `""` returns to the language's rhythm; an unknown name is ignored. */
  readonly setSpacing: (name: string) => void;
  /** Stamp the document and the storage now; the effect calls this on every move. */
  readonly flush: () => void;
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
  * below is the same function over the languages.
 */
export function createThemeState(
  options: ThemeStateOptions = {},
): ThemeState {
  const documents = options.documents ?? designLanguages;
  const names = Object.keys(documents).sort();
  const storage = options.storage ??
    { theme: "spin:theme", mode: "spin:mode", palette: "spin:palette", spacing: "spin:spacing" };

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

  const usesLanguagePalettes = options.palettes === undefined && options.documents === undefined;
  const palettesFor = (lang: string): readonly string[] => {
    if (options.palettes !== undefined) return options.palettes;
    if (!usesLanguagePalettes || !isDesignLanguage(lang)) return [];
    return languagePalettes[lang].map((entry) => entry.id);
  };
  const paletteOptions = (): readonly PaletteChoice[] => {
    const lang = themeName();
    if (usesLanguagePalettes && isDesignLanguage(lang)) {
      const entries = languagePalettes[lang];
      if (entries.length === 0) return [];
      return [
        { value: "", label: languageDefaultPaletteLabels[lang] },
        ...entries.map((entry) => ({ value: entry.id, label: entry.label })),
      ];
    }
    const list = palettesFor(lang);
    if (list.length === 0) return [];
    return [
      { value: "", label: "Default" },
      ...list.map((id) => ({ value: id, label: id })),
    ];
  };
  const spacings = options.spacings ?? (options.documents === undefined ? Object.keys(demoSpacings).sort() : []);
  const initialAllowedPalettes = palettesFor(initialTheme);
  const storedPalette = storage.palette === undefined ? null : read(storage.palette);
  const [paletteName, setPaletteName] = createSignal(
    storedPalette !== null && initialAllowedPalettes.includes(storedPalette)
      ? storedPalette
      : (options.initialPalette !== undefined && (options.initialPalette === "" || initialAllowedPalettes.includes(options.initialPalette)) ? options.initialPalette : ""),
  );
  const storedSpacing = storage.spacing === undefined ? null : read(storage.spacing);
  const [spacingName, setSpacingName] = createSignal(
    storedSpacing !== null && spacings.includes(storedSpacing)
      ? storedSpacing
      : (options.initialSpacing !== undefined && (options.initialSpacing === "" || spacings.includes(options.initialSpacing)) ? options.initialSpacing : ""),
  );

  const flush = (): void => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = themeName();
      document.documentElement.dataset.mode = mode();
      if (paletteName() === "") {
        delete document.documentElement.dataset.palette;
      } else {
        document.documentElement.dataset.palette = paletteName();
      }
      if (spacingName() === "") {
        delete document.documentElement.dataset.spacing;
      } else {
        document.documentElement.dataset.spacing = spacingName();
      }
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(storage.theme, themeName());
      localStorage.setItem(storage.mode, want());
      if (storage.palette !== undefined && paletteName() !== "") {
        localStorage.setItem(storage.palette, paletteName());
      } else if (storage.palette !== undefined) {
        localStorage.removeItem(storage.palette);
      }
      if (storage.spacing !== undefined && spacingName() !== "") {
        localStorage.setItem(storage.spacing, spacingName());
      } else if (storage.spacing !== undefined) {
        localStorage.removeItem(storage.spacing);
      }
    }
  };

  flush();
  createEffect(() => {
    themeName();
    want();
    mode();
    paletteName();
    spacingName();
    flush();
  });

  const updateWant: ThemeState["setWant"] = (next) => {
    setWant(next);
    flush();
  };

  return {
    theme: themeName,
    setTheme: (name) => {
      if (!(name in documents)) return;
      setThemeName(name);
      const nextAllowed = palettesFor(name);
      if (paletteName() !== "" && !nextAllowed.includes(paletteName())) {
        setPaletteName("");
      }
      flush();
    },
    want,
    setWant: updateWant,
    mode,
    setMode: updateWant,
    get palettes() {
      return palettesFor(themeName());
    },
    paletteOptions,
    palette: paletteName,
    setPalette: (name) => {
      if (name === "" || palettesFor(themeName()).includes(name)) {
        setPaletteName(name);
        flush();
      }
    },
    spacings,
    spacing: spacingName,
    setSpacing: (name) => {
      if (name === "" || spacings.includes(name)) {
        setSpacingName(name);
        flush();
      }
    },
    flush,
    names,
    documents,
    modes,
  };
}

/**
  * The default state: the languages, remembered under the kit's keys.
  *
  * Built on first use, not at import: creating it stamps the document and
  * the storage, so a page with its own state (which imports this module for
  * the controls) must not get a second state stamping over it. The docs and
  * any small app serve exactly the languages and have one document; they
 * reach it through these bindings, which build it when first read. An app
 * with its own theme map calls `createThemeState` instead and hands the
 * result to the controls.
 */
let defaultState: ThemeState | undefined;
function defaultStateOf(): ThemeState {
  if (defaultState === undefined) {
    defaultState = createRoot(() => createThemeState());
  }
  return defaultState;
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
export const theme: ThemeState["theme"] = () => defaultStateOf().theme();
export const setTheme: ThemeState["setTheme"] = (name) => defaultStateOf().setTheme(name);
export const want: ThemeState["want"] = () => defaultStateOf().want();
export const setWant: ThemeState["setWant"] = (m) => defaultStateOf().setWant(m);
export const mode: ThemeState["mode"] = () => defaultStateOf().mode();
export const setMode: ThemeState["setMode"] = (m) => defaultStateOf().setMode(m);
export const palettes: ThemeState["palettes"] = new Proxy([] as unknown as ThemeState["palettes"], {
  get: (_target, key) => {
    const value = Reflect.get(defaultStateOf().palettes, key as never);
    return typeof value === "function" ? (value as (...args: never[]) => unknown).bind(defaultStateOf().palettes) : value;
  },
  has: (_target, key) => Reflect.has(defaultStateOf().palettes, key as never),
  ownKeys: () => Reflect.ownKeys(defaultStateOf().palettes),
  getOwnPropertyDescriptor: (_target, key) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(defaultStateOf().palettes, key as never);
    if (descriptor === undefined) return undefined;
    return { ...descriptor, configurable: true };
  },
});
export const palette: ThemeState["palette"] = () => defaultStateOf().palette();
export const setPalette: ThemeState["setPalette"] = (name) => defaultStateOf().setPalette(name);
export const paletteOptions: ThemeState["paletteOptions"] = () => defaultStateOf().paletteOptions();
export const spacings: ThemeState["spacings"] = new Proxy([] as unknown as ThemeState["spacings"], {
  get: (_target, key) => {
    const value = Reflect.get(defaultStateOf().spacings, key as never);
    return typeof value === "function" ? (value as (...args: never[]) => unknown).bind(defaultStateOf().spacings) : value;
  },
  has: (_target, key) => Reflect.has(defaultStateOf().spacings, key as never),
  ownKeys: () => Reflect.ownKeys(defaultStateOf().spacings),
  getOwnPropertyDescriptor: (_target, key) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(defaultStateOf().spacings, key as never);
    if (descriptor === undefined) return undefined;
    return { ...descriptor, configurable: true };
  },
});
export const spacing: ThemeState["spacing"] = () => defaultStateOf().spacing();
export const setSpacing: ThemeState["setSpacing"] = (name) => defaultStateOf().setSpacing(name);
export const flushThemeState: ThemeState["flush"] = () => defaultStateOf().flush();
export const languageDocuments: ThemeState["documents"] = new Proxy({} as ThemeState["documents"], {
  get: (_target, key) => Reflect.get(defaultStateOf().documents, key as string),
  has: (_target, key) => Reflect.has(defaultStateOf().documents, key as string),
  ownKeys: () => Reflect.ownKeys(defaultStateOf().documents),
  getOwnPropertyDescriptor: (_target, key) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(defaultStateOf().documents, key as string);
    if (descriptor === undefined) return undefined;
    return { ...descriptor, configurable: true };
  },
});
