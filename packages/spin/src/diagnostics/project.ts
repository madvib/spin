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

import {
  findProjectRoot,
  findProjectRootIn,
  themeTextsIn,
} from "../project/sync.ts";
import type { ThemeDocument } from "../theme/index.ts";

export { findProjectRoot, findProjectRootIn };

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
