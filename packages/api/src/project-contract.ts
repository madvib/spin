/**
 * @spin/api — the project contract, and the procedures only a host can have.
 *
 * `project.*` is here rather than in `@spin/theme` because it touches a
 * filesystem: a theme is text, and this is what happens to text on its way to
 * a directory. The theme package stays pure and reusable without a daemon.
 *
 * The other reason this lives here is composition. `project.init` writes a
 * project, and a project is not only a theme: it is a theme AND a build
 * config that wires the preset. Neither package knows that fact — `@spin/theme`
 * has never heard of uno, and `@spin/preset` has no idea a project has a root.
 * The daemon is the one thing that knows both, so it is the one that stitches
 * them.
 *
 * The pieces it stitches are themselves pure: `@spin/theme` produces a theme
 * document as text, `@spin/preset` produces an uno config as text. Both are
 * exported as text producers precisely so a host can compose them without
 * either one growing a filesystem.
 */

import { oc } from "@orpc/contract";
import * as v from "valibot";
import { scaffoldTheme, treeToJson } from "@spin/theme";
import { configScaffoldText } from "../../preset/src/config.ts";

/** A theme on disk, named by its file stem. */
const ThemeName = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9][a-z0-9-]*$/i),
  v.description("A theme file stem, e.g. `default`."),
);

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

const ProjectTheme = v.object({
  /** File stem, and the name written back to disk. */
  name: ThemeName,
  /** The raw JSON text, which is what an author edits. */
  text: v.string(),
  /** Path within the project, shown so the author knows what they edit. */
  file: v.string(),
});

/**
 * A project a call is about.
 *
 * Optional because a daemon has a project it was started with, and naming it
 * on every call would be noise. Present because one daemon process can serve
 * many projects — a client that names another root gets that root's themes,
 * with no second process and no shared state to stomp on.
 */
const ProjectInput = v.object({
  root: v.pipe(
    v.optional(v.string()),
    v.description("Defaults to the daemon's own project root."),
  ),
});

export const listThemes = oc
  .input(ProjectInput)
  .output(v.array(ProjectTheme))
  .route({
    method: "GET",
    path: "/project/themes/list",
    summary: "List the project's themes on disk",
  });

export const readTheme = oc
  .input(v.object({ name: ThemeName, root: v.optional(v.string()) }))
  .output(v.object({ text: v.nullable(v.string()) }))
  .route({
    method: "GET",
    path: "/project/themes/read",
    summary: "Read one theme file by name",
  });

export const writeTheme = oc
  .input(
    v.object({
      name: ThemeName,
      text: v.string(),
      root: v.optional(v.string()),
    }),
  )
  .output(v.object({ error: v.nullable(v.string()) }))
  .route({
    method: "POST",
    path: "/project/themes/write",
    summary: "Write one theme file by name",
  });

export const removeTheme = oc
  .input(v.object({ name: ThemeName, root: v.optional(v.string()) }))
  .output(v.object({ error: v.nullable(v.string()) }))
  .route({
    method: "POST",
    path: "/project/themes/remove",
    summary: "Remove one theme file by name",
  });

export const copyTheme = oc
  .input(
    v.object({ from: ThemeName, to: ThemeName, root: v.optional(v.string()) }),
  )
  .output(v.object({ error: v.nullable(v.string()) }))
  .route({
    method: "POST",
    path: "/project/themes/copy",
    summary: "Copy one theme file to a new name",
  });

/** What a project root looks like to the daemon. */
const ProjectReport = v.object({
  /** The root that was examined. */
  root: v.string(),
  /** Whether the `spin/` directory is there — the mark of a spin project. */
  spin: v.boolean(),
  /** Whether an uno config is there, which is where the preset gets wired. */
  uno: v.boolean(),
  /** Whether the uno config names the spin preset. */
  wired: v.boolean(),
  /** The themes `spin/` holds, if it holds any. */
  themes: v.array(v.string()),
});

/**
 * Whether a root is a spin project.
 *
 * Detection, not a registry: a project is registered by having a `spin/`
 * directory, which `spin init` creates and nothing else does. There is no
 * `spin add` and no global list, because a project is a place on disk and
 * the CLI can be told which place. The uno config is a secondary answer —
 * a project can hold themes before it is wired into a build.
 */
export const detectProject = oc
  .input(v.object({ root: v.string() }))
  .output(ProjectReport)
  .route({
    method: "POST",
    path: "/project/detect",
    summary: "Report whether a root is a spin project",
  });

export const initProject = oc
  .input(
    v.object({
      root: v.string(),
      name: ThemeName,
      starter: v.pipe(
        v.string(),
        v.description("The starter to seed the theme from."),
      ),
    }),
  )
  .output(v.object({ error: v.nullable(v.string()) }))
  .route({
    method: "POST",
    path: "/project/init",
    summary: "Create the spin directory, a theme, and an uno config",
  });

export const projectContract = {
  project: {
    // `detect` and `init` are the project's own, not a theme's: one answers
    // whether a root is spin's, the other makes one.
    detect: detectProject,
    init: initProject,
    themes: {
      list: listThemes,
      read: readTheme,
      write: writeTheme,
      remove: removeTheme,
      copy: copyTheme,
    },
  },
};

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
    "uno.config.ts": configScaffoldText(),
  };
}

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
