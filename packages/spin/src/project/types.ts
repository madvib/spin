/**
 * The shapes the project's operations answer with.
 *
 * These are the domain's own shapes, not a wire format: the transport's
 * schema is the daemon's business, and it mirrors these rather than
 * replacing them. A procedure that answers with something else is a
 * procedure that says something the project does not.
 */

/** What a project root looks like. */
export interface ProjectReport {
  /** The root that was examined. */
  readonly root: string;
  /** Whether the `spin/` directory is there — the mark of a spin project. */
  readonly spin: boolean;
  /** Whether an uno config is there, which is where the preset gets wired. */
  readonly uno: boolean;
  /** Whether the uno config names the spin preset. */
  readonly wired: boolean;
  /** The themes `spin/` holds, if it holds any. */
  readonly themes: string[];
}

/**
 * A theme the project holds.
 *
 * The text is what an author edits, so it travels as text: a tree is not
 * JSON-stable across a wire, and the document is the unit.
 */
export interface ProjectTheme {
  /** File stem, and the name written back to disk. */
  readonly name: string;
  /** The raw JSON text, which is what an author edits. */
  readonly text: string;
  /**
   * Path within the project, shown so the author knows what they edit.
   *
   * `null` for a theme the project has not forked: it is served from the
   * brand or from a verbatim `themes:` map, and a save writes
   * `spin/<name>.json` to fork it.
   */
  readonly file: string | null;
  /** Where the theme is served from: a local file, the brand, or a verbatim map. */
  readonly origin: "local" | "brand" | "verbatim";
}

/**
 * Where a saved icon came from.
 *
 * Recordable, not required: an icon the project drew itself has no
 * collection behind it, and an author who knows the author and the licence
 * states them. A member that was not stated is `null` rather than an empty
 * string, so "nobody said" and "somebody said nothing" cannot be confused.
 */
export interface IconAttribution {
  /** The collection the glyph came from, e.g. `lucide`. */
  readonly collection: string | null;
  /** Who made it. */
  readonly author: string | null;
  /** The licence it is under, e.g. `ISC`. */
  readonly license: string | null;
}

/**
 * A saved icon the project holds.
 *
 * The markup is the icon: an inline SVG element, stored as text and read
 * back byte for byte, because it is what a renderer draws and what an
 * author pastes.
 */
export interface ProjectIcon {
  /** File stem, and the name written back to disk. */
  readonly name: string;
  /** The markup that draws it. */
  readonly markup: string;
  /** Where it came from, when that is known. */
  readonly attribution: IconAttribution;
}

/**
 * What a save carries: the markup, and where it came from.
 *
 * The name is the save's own argument — a file stem, like a theme's — so
 * the document on disk does not repeat what its own name already says.
 */
export interface SavedIcon {
  /** The markup that draws the icon. */
  readonly markup: string;
  /** Where it came from, when that is known. */
  readonly attribution: IconAttribution;
}

/**
 * What an operation that writes answers with.
 *
 * `error` is the message a person reads; a refused write is not an
 * exception, because a refusal is an answer the caller can show.
 */
export interface WriteResult {
  /** The reason the write did not happen, or `null` when it did. */
  readonly error: string | null;
}

/**
 * A value the configuration imports: the module it arrives from and the
 * export to read (`"default"` for a default import — the daemon reads
 * that export off the loaded module).
 */
export interface ImportedValue {
  readonly source: string;
  readonly exportName: string;
}

/** A verbatim `themes:` entry: the served name and the import behind it. */
export interface VerbatimThemeRef {
  readonly key: string;
  /** The import the document arrives from; `null` when the value is not a bare imported identifier. */
  readonly value: ImportedValue | null;
}

/**
 * The `extends` value a configuration declares, as the daemon can follow it.
 *
 * `brand` is a bare imported identifier whose `themes` record is the
 * layer; `inline` is `extends: { themes: ... }` in the same shapes a
 * verbatim map takes; `unresolved` is a declared value in none of
 * those shapes — the daemon serves the local disk alone, loudly.
 */
export type ExtendsDeclaration =
  | { readonly kind: "brand"; readonly value: ImportedValue }
  | { readonly kind: "inline"; readonly record: ThemeRecordDeclaration }
  | { readonly kind: "unresolved" };

/**
 * A themes record a configuration declares, as the daemon can load it.
 *
 * `entries` is a per-key map; `record` is one import that IS the
 * record — or `null` when the value is in no loadable shape, which
 * the daemon skips loudly rather than serving quietly.
 */
export type ThemeRecordDeclaration =
  | {
    readonly kind: "entries";
    readonly entries: readonly VerbatimThemeRef[];
  }
  | { readonly kind: "record"; readonly value: ImportedValue | null };

/**
 * The Uno options a project's build configuration declares.
 *
 * Read as text, because a configuration is a module: loading it to answer a
 * question about a class name would run a build.
 */
export interface ProjectConfiguration {
  /**
   * The configuration file the declaration was read from, relative to the
   * project root. `null` when the project declares no configuration.
   */
  readonly file: string | null;
  /** The shortcuts the configuration declares: each name, and the classes it expands to. */
  readonly shortcuts: Readonly<Record<string, readonly string[]>>;
  /** The content globs the configuration declares. */
  readonly content: readonly string[];
  /**
   * The app the configuration mounts, as the configuration names it.
   *
   * The argument of the `mount` option, as written: a path is often
   * computed, and a computed path cannot be read without running the module.
   */
  readonly mount: string | null;
  /** The directory the project's themes live in. */
  readonly themesDir: string;
  /** The directory the project's components live in. */
  readonly componentsDir: string;
  /** The component prefix, or null when unset. */
  readonly prefix: string | null;
  /**
   * The `extends` value the configuration declares, as the daemon can
   * follow it. `null` when no `extends` is declared.
   */
  readonly extends: ExtendsDeclaration | null;
  /**
   * The verbatim `themes:` map the configuration declares, as the daemon
   * can load it.
   *
   * `null` when no `themes:` is declared — the daemon then serves the
   * brand layer forked by the local disk. A declared map replaces the
   * whole stack exactly as the plugin does.
   */
  readonly verbatimThemes: ThemeRecordDeclaration | null;
  /**
   * The directory fields present but not readable as string literals.
   *
   * A `themesDir`, `componentsDir`, or `prefix` the reader could not
   * take — computed, spread, or otherwise not a literal — falls back
   * to its default, and its name lands here so the caller can say so.
   */
  readonly unreadableFields: readonly string[];
  readonly unreadable: boolean;
}
/** The bundler a fresh project builds with. */
export type BundlerKind =
  | "vite"
  | "rspack"
  | "webpack"
  | "rollup"
  | "rolldown"
  | "esbuild"
  | "bun"
  | "unocss";

/** What `init` writes. */
export interface InitProjectOptions {
  /** The root to make the project in. */
  readonly root: string;
  /** The name of the first theme — the file stem it is written under. */
  readonly name: string;
  /** The starter to seed the theme from. */
  readonly starter: string;
  /** The bundler the generated build config wires. Defaults to `"vite"`. */
  readonly bundler?: BundlerKind;
  /** The themes directory. Defaults to `"spin"`. */
  readonly themesDir?: string;
  /** The components directory. Defaults to `"lib/components"`. */
  readonly componentsDir?: string;
  /** The component prefix. */
  readonly prefix?: string;
  /** Vendor the full starter text instead of a sparse `$extends` document. */
  readonly vendor?: boolean;
}
