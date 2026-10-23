/**
 * The project's facts: the marks that make a directory a project, and the
 * files a project is made of.
 *
 * These are facts about a PROJECT, so they live here rather than in the
 * daemon that serves one. A host that wants to know where a project's themes
 * are asks this package; it does not keep its own copy of the answer.
 */

import { scaffoldTheme, treeToJson } from "@spin/theme";
import { configScaffoldText } from "@spin/preset/config";

/**
 * The directory a project's themes live in, relative to its root.
 *
 * `spin/` rather than `themes/` because the name is the marker: a directory
 * called `spin` at a project root is a claim, and no dependency has one. A
 * `themes/` directory is ambiguous — libraries ship those, unrelated
 * subdirectories have that name, and a scanner that trusts it finds projects
 * that are not projects.
 */
export const PROJECT_DIR = "spin";

/**
 * The directory a project's saved icons live in, under its own.
 *
 * Inside the project's directory and beside its themes, under a name of
 * their own: the themes listing reads that directory for documents, and a
 * directory of icons sitting among them would be one more thing there that
 * is not a theme. A library is a list of documents too, and it gets its
 * own drawer.
 */
export const ICONS_DIR = "icons";

/**
 * The file a project's build configuration is written to.
 *
 * The one name `spin init` writes, and the one the report looks for when it
 * says whether a project is wired.
 */
export const CONFIG_FILENAME = "uno.config.ts";

/**
 * The build configurations a project may keep.
 *
 * The uno configs come first: they are where the preset is wired, and the
 * report asks about them. A project that builds with vite keeps the same
 * declaration in `vite.config.ts`, and a project that keeps its build in its
 * own module says so in `spin.config.ts`. All of them carry the same
 * declaration, so all of them are read.
 */
export const CONFIG_FILES: readonly string[] = [
  "uno.config.ts",
  "uno.config.js",
  "uno.config.mjs",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "spin.config.ts",
  "spin.config.js",
  "spin.config.mjs",
];

/**
 * Whether a text is an uno config that applies spin.
 *
 * Two entry points wire spin, and both count: the encapsulated form
 * (`@spin/config`, `spin()`) that `spin init` writes, and the raw form
 * (`@spin/preset`, `spinPreset()`) that the escape hatch uses. A detector
 * that knew only one would report a correctly wired project as unwired —
 * which is how this bug shipped, caught by the init test.
 */
export function isWired(text: string): boolean {
  return /@spin\/config|spin\s*\(|@spin\/preset|spinPreset/.test(text);
}

/**
 * The `spin/` directory contents, by starter.
 *
 * `spin init` is a composer: it writes what each piece knows how to write.
 * Keeping the mapping here — rather than inside either package — is what lets
 * a project gain a file later (a `.gitignore`, an entry point) without the
 * theme package learning what a project is.
 */
export function initFiles(
  options: { readonly name: string; readonly starter: string },
): Record<string, string> {
  return {
    [`${options.name}.json`]: treeToJson(scaffoldTheme()),
    [CONFIG_FILENAME]: configScaffoldText(),
  };
}
