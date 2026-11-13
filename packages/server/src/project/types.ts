/**
 * The shapes the project's operations read and answer with, never validated.
 *
 * These stay here because they never cross the wire: configuration
 * declarations read from text, consumed in-process. Everything a
 * procedure takes or answers lives in `./schema.ts` as the valibot
 * schema that IS the shape — the contract composes, never re-declares.
 */







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

