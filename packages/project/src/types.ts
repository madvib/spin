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
   * `null` for a shipped starter the project has not forked: the theme comes
   * from `@spin/theme`, and a save writes `spin/<name>.json` to fork it.
   */
  readonly file: string | null;
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
  /**
   * Whether the configuration declares something this could not read.
   *
   * A vocabulary it could not read is one it must not enforce.
   */
  readonly unreadable: boolean;
}

/** What `init` writes. */
export interface InitProjectOptions {
  /** The root to make the project in. */
  readonly root: string;
  /** The name of the first theme — the file stem it is written under. */
  readonly name: string;
  /** The starter to seed the theme from. */
  readonly starter: string;
}
