/**
 * A project's themes or components directory, resolved to the filesystem.
 *
 * Either value in the configuration is a local path (`spin`,
 * `src/lib/components`) joined to the project root. Shared trees do not
 * arrive through paths — they arrive through `extends`, as imported
 * values — so a value that looks like a package specifier is refused
 * with the redirect rather than resolved.
 *
 * A value naming one file resolves to that file as the whole tree — a
 * single theme document, a single recipe. A value naming nothing yet
 * resolves to the joined path anyway: `init` creates it.
 */

/** A resolved directory: the path, and whether it is one file. */
export interface ResolvedDir {
  /** The absolute filesystem path. */
  readonly path: string;
  /** Whether the path is a single file rather than a directory. */
  readonly file: boolean;
}

/**
 * The directory a configuration value names, on the filesystem.
 *
 * Local paths join the root unchanged. A value that looks like a
 * specifier — a leading `@`, or a first segment under the root's
 * `node_modules` — throws naming the `extends` it should have been:
 * shared trees arrive as values, never as paths.
 */
export async function resolveProjectDir(
  root: string,
  value: string,
  kind: "themes" | "components",
): Promise<ResolvedDir> {
  void kind;
  const { join } = await import("node:path");
  const { stat } = await import("node:fs/promises");
  const path = join(root, value);
  try {
    return { path, file: (await stat(path)).isFile() };
  } catch {
    // Missing: a local directory `init` has not created yet — unless
    // the value looks like a specifier, which is the old grammar.
    const first = value.split("/")[0] ?? "";
    let specifier = value.startsWith("@");
    if (!specifier) {
      try {
        await stat(join(root, "node_modules", first));
        specifier = true;
      } catch {
        specifier = false;
      }
    }
    if (specifier) {
      throw new Error(
        `[spin] shared trees arrive through extends, not paths: '${value}'`,
      );
    }
    return { path, file: false };
  }
}
