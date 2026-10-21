/**
 * The project the lint is running in.
 *
 * A spin project is marked by a `spin/` directory at its root — the same
 * marker the daemon reads to know that a root is a project rather than a
 * folder (`packages/api/src/project-contract.ts` calls it `PROJECT_DIR`).
 * The lint finds the root the same way the rest of the system does: the
 * nearest ancestor of the file being linted that holds one.
 *
 * The themes in that directory are the project's own. A project that has
 * none still renders — it serves the shipped starters — so the absence of
 * the directory is not an error, it is the shape of a project that has not
 * forked a theme yet.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ThemeDocument } from "@spin/theme";

/**
 * The directory a project's themes live in, relative to its root.
 *
 * The same name the daemon uses. It is repeated rather than imported
 * because the daemon's constant belongs to the package that owns the
 * filesystem procedures, and the lint is below that package: dependencies
 * point downward, so the lint cannot reach up for it.
 */
export const PROJECT_DIR = "spin";

/** Whether a path is a directory. */
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The project root a file belongs to, if there is one.
 *
 * The nearest ancestor holding a `spin/` directory wins. A file outside any
 * project has no root, and the vocabulary falls back to the starters.
 */
export function findProjectRoot(from: string): string | undefined {
  return findProjectRootIn(dirname(from));
}

/**
 * The project root a directory belongs to, if there is one.
 *
 * The directory itself counts: the tool's root is a project when it holds a
 * `spin/` directory, and the ancestors above it are tried in turn.
 */
export function findProjectRootIn(directory: string): string | undefined {
  let dir = directory;
  for (;;) {
    if (isDirectory(join(dir, PROJECT_DIR))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * The project's own themes, by name.
 *
 * A file that does not parse is skipped rather than thrown on: a half
 * written theme in an editor would otherwise cost the lint every theme
 * the project has, and one bad file should not cost the others.
 */
export function readProjectThemes(
  root: string,
): Record<string, ThemeDocument> {
  const out: Record<string, ThemeDocument> = {};
  let names: string[];
  try {
    names = readdirSync(join(root, PROJECT_DIR)).filter((name) =>
      name.endsWith(".json")
    );
  } catch {
    return out;
  }
  for (const name of names) {
    try {
      const text = readFileSync(
        join(root, PROJECT_DIR, name),
        "utf8",
      ) as string;
      out[name.slice(0, -".json".length)] = JSON.parse(text) as ThemeDocument;
    } catch {
      // Skipped: see above.
    }
  }
  return out;
}
