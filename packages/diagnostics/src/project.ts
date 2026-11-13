/**
 * The project the lint is running in.
 *
 * The project owns where its files are: the lint asks it, and it answers.
 * A spin project is marked by a `spin/` directory at its root, the themes in
 * that directory are the project's own, and the configuration beside it says
 * what the project composes. The lint keeps none of that: it asks, and it
 * works with the answer.
 *
 * A project that has no themes serves none — the absence of the
 * directory is the shape of a project that has not written a theme yet,
 * not an error.
 */

import { dirname, resolve } from "node:path";
import {
  findProjectRoot,
  findProjectRootIn,
  themeTextsIn,
  themeTextsInAt,
} from "@spinjs/server/project";
import type { ThemeDocument } from "@spinjs/theme";

export { findProjectRoot, findProjectRootIn };

/** The tree the tool runs in, read once: the walk never climbs above it. */
let ceiling: string | undefined;

/**
 * The project root a file belongs to, without leaving the tool's tree.
 *
 * The nearest ancestor holding a `spin/` directory wins — but the walk
 * stops at the directory the tool was run from. Without the ceiling a
 * checkout named `spin` reads its own parent as a project, and every file
 * below the tool's root would be judged by a vocabulary that never saw
 * its tree. A file outside the tool's tree never meets the ceiling, so it
 * walks unbounded, as before.
 */
export function projectRootFor(filename: string): string | undefined {
  ceiling ??= resolve(process.cwd());
  return findProjectRootIn(dirname(resolve(filename)), ceiling);
}

/**
 * The project's own themes, by name.
 *
 * The project hands over the text of each theme it holds; the document in
 * that text is the theme package's shape, and a file that does not parse is
 * skipped rather than thrown on: a half written theme in an editor would
 * otherwise cost the lint every theme the project has, and one bad file
 * should not cost the others.
 */
export function readProjectThemes(
  root: string,
): Record<string, ThemeDocument> {
  const out: Record<string, ThemeDocument> = {};
  for (const [name, text] of Object.entries(themeTextsIn(root))) {
    try {
      out[name] = JSON.parse(text) as ThemeDocument;
    } catch {
      // Skipped: see above.
    }
  }
  return out;
}

/**
 * The themes a themes directory holds, by name.
 *
 * The directory itself, not the project around it: a custom `themesDir`
 * reads from where the configuration points. Same skips as the project
 * form — a file that does not parse costs nothing.
 */
export function readProjectThemesAt(
  themesPath: string,
): Record<string, ThemeDocument> {
  const out: Record<string, ThemeDocument> = {};
  for (const [name, text] of Object.entries(themeTextsInAt(themesPath))) {
    try {
      out[name] = JSON.parse(text) as ThemeDocument;
    } catch {
      // Skipped: see above.
    }
  }
  return out;
}
