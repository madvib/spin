/**
 * The project's facts: the marks that make a directory a project, and the
 * files a project is made of.
 *
 * These are facts about a PROJECT, so they live here rather than in the
 * daemon that serves one. A host that wants to know where a project's themes
 * are asks this package; it does not keep its own copy of the answer.
 */

import { scaffoldTheme, treeToJson } from "../theme/index.ts";
import { starterThemes } from "../theme/themes/index.ts";
import { configScaffoldText } from "../plugin/config.ts";

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

export const COMPONENTS_DIR = "src/lib/components";

export function defaultPrefix(packageName?: string): string {
  let base = packageName ?? "";
  const slash = base.lastIndexOf("/");
  if (slash >= 0) base = base.slice(slash + 1);
  let out = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (out === "" || out === "workspace") out = "app";
  return out;
}

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
 * The file a project's own configuration lives in, under its directory.
 *
 * Additive metadata the plugin options cannot express: which theme the
 * studio seats, and what order the theme list shows. Unknown keys are
 * ignored, and a file that does not parse counts as absent — a half
 * written config must not cost the reader the themes the project has.
 */
export const CONFIG_FILENAME = "config.json";

/** What `spin/config.json` holds, when it holds anything. */
export interface SpinConfigFile {
  /** The theme the studio seats on load, when it names a served theme. */
  readonly activeTheme?: string;
  /** Display order for the theme list; unknown names ignored, unlisted served names after, alphabetically. */
  readonly themeOrder?: readonly string[];
  /** The shipped set the scale-key contract compares; absent until the project adopts the contract. */
  readonly contractThemes?: readonly string[];
}

/**
 * The file a project's build configuration is written to.
 *
 * The one name `spin init` writes, and the one the report looks for when it
 * says whether a project is wired.
 */
export const UNO_FILENAME = "uno.config.ts";

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
  "rspack.config.ts",
  "rspack.config.js",
  "webpack.config.js",
  "webpack.config.mjs",
  "rollup.config.js",
  "rollup.config.mjs",
  "rolldown.config.ts",
  "spin.config.ts",
  "spin.config.js",
  "spin.config.mjs",
];

/**
 * Whether a text is an uno config that applies spin.
 *
 * Two entry points wire spin, and both count: the encapsulated form
 * (`@spinjs/config`, `spin()`) that `spin init` writes, and the raw form
 * (`@spinjs/preset`, `spinPreset()`) that the escape hatch uses.
 * A detector that knew only one would report a correctly wired project
 * as unwired — which is how this bug shipped, caught by the init test.
 */
export function isWired(text: string): boolean {
  return /@spinjs\/spin|@spinjs\/config|spin\s*\(|spin\.(?:vite|rspack|webpack|rollup|rolldown|esbuild|bun)\s*\(|@spinjs\/preset|spinPreset/.test(
    text,
  );
}

/**
 * The `spin/` directory contents, by starter.
 *
 * `spin init` is a composer: it writes what each piece knows how to write.
 * Keeping the mapping here — rather than inside either package — is what lets
 * a project gain a file later (a `.gitignore`, an entry point) without the
 * theme package learning what a project is.
 *
 * Keys are paths under the themes directory: a brand is a directory, and
 * the brand's identity file is the tokens layer it names first.
 */
export function initFiles(
  options: {
    readonly name: string;
    readonly starter: string;
    readonly bundler?: string;
    readonly themesDir?: string;
    /** Write the starter's full JSON instead of a sparse `$extends` layer. */
    readonly vendor?: boolean;
  },
): Record<string, string> {
  const config = configScaffoldText(options.bundler ?? "vite", {
    themesDir: options.themesDir,
  });
  return {
    [`${options.name}/tokens.json`]: options.vendor === true
      ? themeText(options.starter)
      : JSON.stringify({ $extends: options.starter, modes: ["light", "dark"] }, null, 2) + "\n",
    [config.filename]: config.text,
  };
}

/**
 * A starter theme as the text written for it.
 *
 * A known starter resolves against the shipped registry; anything else —
 * `"scaffold"` or unknown — falls back to the scaffold, so `init` never
 * fails on a name it does not know.
 */
function themeText(starter: string): string {
  const document = starterThemes[starter];
  if (document === undefined) return treeToJson(scaffoldTheme());
  return JSON.stringify(document, null, 2) + "\n";
}
