/**
 * @spinjs/api — the project contract: the wire shape of a project's facts.
 *
 * The contract is the transport's business, and it stays here: it says what
 * a call looks like over the wire, and nothing else. The OPERATIONS over a
 * project live in `@spinjs/project` — the module that owns where a project's
 * files are, what a theme document is, and what a configuration declares.
 *
 * The two are separated because they answer different questions. This file
 * says what a caller may ask; `@spinjs/project` says what the answer is. The
 * daemon mounts the one on the other and adds the transport.
 */

import { oc } from "@orpc/contract";
import * as v from "valibot";

/** A theme on disk, named by its file stem. */
const ThemeName = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9][a-z0-9-]*$/i),
  v.description("A theme file stem, e.g. `default`."),
);

const ProjectTheme = v.object({
  /** File stem, and the name written back to disk. */
  name: ThemeName,
  /** The raw JSON text, which is what an author edits. */
  text: v.string(),
  /**
   * Path within the project, shown so the author knows what they edit.
   *
   * `null` for a theme the project has not forked: it is served from the
   * brand or from a verbatim `themes:` map, and a save writes
   * `spin/<name>.json` to fork it.
   */
  file: v.nullable(v.string()),
  /** Where the theme is served from: a local file, the brand, or a verbatim map. Optional so old daemons stay wire-compatible. */
  origin: v.optional(v.picklist(["local", "brand", "verbatim"])),
});

/** What `spin/config.json` holds, when it holds anything. Unknown keys stripped, never rejected. */
const SpinConfigFileSchema = v.object({
  /** The theme the studio seats on load, when it names a served theme. */
  activeTheme: v.optional(v.string()),
  /** Display order for the theme list. */
  themeOrder: v.optional(v.array(v.string())),
  /** The shipped set the scale-key contract compares. */
  contractThemes: v.optional(v.array(v.string())),
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
    summary:
      "List the project's themes: what the build serves, local files beside the unforked brand",
  });

export const readTheme = oc
  .input(v.object({ name: ThemeName, root: v.optional(v.string()) }))
  .output(v.object({ text: v.nullable(v.string()) }))
  .route({
    method: "GET",
    path: "/project/themes/read",
    summary: "Read one theme by name, disk first, then the brand layer",
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

export const readConfig = oc
  .input(ProjectInput)
  .output(v.object({ config: SpinConfigFileSchema, file: v.nullable(v.string()) }))
  .route({
    method: "GET",
    path: "/project/config/read",
    summary: "Read spin/config.json, or the empty config",
  });

export const writeConfig = oc
  .input(v.object({ config: SpinConfigFileSchema, root: v.optional(v.string()) }))
  .output(v.object({ error: v.nullable(v.string()) }))
  .route({
    method: "POST",
    path: "/project/config/write",
    summary: "Write spin/config.json",
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

/**
 * The project this daemon serves, when a call names none.
 *
 * Safe on the wire without arguments because the daemon's root is not a
 * secret from the client that started it — and it is the one thing an MCP
 * client cannot learn any other way: the URL it dialed carries a port, not a
 * directory. Same report as `detect`, about the daemon's own root.
 */
export const currentProject = oc
  .input(v.object({}))
  .output(ProjectReport)
  .route({
    method: "POST",
    path: "/project/current",
    summary: "Report the daemon's own project",
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
      bundler: v.optional(
        v.picklist([
          "vite",
          "rspack",
          "webpack",
          "rollup",
          "rolldown",
          "esbuild",
          "bun",
          "unocss",
        ]),
      ),
      themesDir: v.optional(v.string()),
      componentsDir: v.optional(v.string()),
      prefix: v.optional(v.string()),
      vendor: v.optional(v.boolean()),
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
    // `detect`, `current` and `init` are the project's own, not a theme's:
    // one answers whether a root is spin's, one answers which root this is,
    // the other makes one.
    detect: detectProject,
    current: currentProject,
    init: initProject,
    themes: {
      list: listThemes,
      read: readTheme,
      write: writeTheme,
      remove: removeTheme,
      copy: copyTheme,
    },
    config: {
      read: readConfig,
      write: writeConfig,
    },
  },
};
