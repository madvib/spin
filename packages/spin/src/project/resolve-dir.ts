/**
 * A project's themes or components directory, resolved to the filesystem.
 *
 * Either value in the configuration is a local path (`spin`,
 * `lib/components`) or a package specifier (`@acme/tokens`,
 * `@acme/kit/components`) naming a shared package's tree. A specifier
 * resolves from the project root the way a bundler resolves an import,
 * so a monorepo keeps one copy of both trees instead of one per app.
 *
 * A specifier naming a directory reads that directory as the local one
 * is read (`*.json` by stem, `*.html` recipes by path). One naming a
 * file reads that file as the whole tree — a single theme document, a
 * single recipe.
 *
 * The grammar is one rule: a leading `@scope/` or a first segment with
 * no local directory of that name is a specifier; anything with a
 * leading `.` or `/`, or an existing local directory, is a path. Never
 * a URL, never `~`.
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
 * Local paths join the root unchanged. Specifiers resolve through the
 * root's own `package.json`, so the tree belongs to the project that
 * names it rather than to whatever process reads it. An unresolvable
 * specifier throws naming kind, value, and root: a missing shared
 * package breaks the build loudly, never renders the starters in its
 * place.
 */
export async function resolveProjectDir(
  root: string,
  value: string,
  kind: "themes" | "components",
): Promise<ResolvedDir> {
  const { join } = await import("node:path");
  const { stat } = await import("node:fs/promises");
  // A value is a specifier only when it names a package that is there:
  // an `@scope/` prefix, or a first segment under the root's
  // `node_modules`. Everything else is a local path — including a
  // directory that does not exist yet, which `init` creates.
  const first = value.split("/")[0] ?? "";
  let specifier = value.startsWith("@");
  if (!specifier && !value.startsWith(".") && !value.startsWith("/")) {
    try {
      await stat(join(root, "node_modules", first));
      specifier = true;
    } catch {
      specifier = false;
    }
  }
  if (!specifier) {
    return { path: join(root, value), file: false };
  }
  const { createRequire } = await import("node:module");
  const require = createRequire(join(root, "package.json"));
  let resolved: string | undefined;
  try {
    resolved = require.resolve(value);
  } catch {
    // A specifier may name a directory, which module resolution never
    // returns: walk up to the owning package and join the remainder.
    // `@acme/kit/themes` → package `@acme/kit` + `themes` beneath it.
    const segments = value.split("/");
    const scoped = value.startsWith("@");
    const width = scoped ? 2 : 1;
    for (let end = segments.length - 1; end >= width; end--) {
      const candidate = segments.slice(0, end).join("/");
      try {
        const pkgFile = require.resolve(`${candidate}/package.json`);
        const { dirname } = await import("node:path");
        resolved = join(
          dirname(pkgFile),
          ...segments.slice(end),
        );
        break;
      } catch {
        continue;
      }
    }
    if (resolved === undefined) {
      throw new Error(
        `[spin] cannot resolve ${kind} '${value}' from ${root}: ` +
          `no package on that path`,
      );
    }
  }
  let isFile = false;
  try {
    isFile = (await stat(resolved)).isFile();
  } catch (error) {
    throw new Error(
      `[spin] cannot resolve ${kind} '${value}' from ${root}: ` +
        (error instanceof Error ? error.message : String(error)),
    );
  }
  return { path: resolved, file: isFile };
}
