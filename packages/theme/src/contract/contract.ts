/**
 * @spin/theme procedures — the typed theme interface, owned by the module
 * that implements it.
 *
 * Contract-first oRPC: this file describes every procedure (input, output, no
 * logic) with `oc` from `@orpc/contract`. `procedures.ts` implements it. The
 * api package re-exports both and adds transport; a client needs only this
 * file, so no server code can leak into a bundle.
 *
 * Conventions, enforced by construction:
 * - Themes travel as DTCG JSON text (`text`), never as trees. Trees are not
 *   JSON-stable across a wire; text parses identically everywhere.
 * - Every mutating input carries the text it mutates. No sessions, no cursors:
 *   the caller holds state, the daemon holds files.
 * - Validation runs against a required-role list the caller supplies. The
 *   composition layer (preset/api) computes that list via `requiredRolesFor`
 *   and passes it in as `required`; theme stays generic and never imports
 *   preset or primitives. Absent `required` means the base surface
 *   (`BASE_ROLES`): the palette and contrast floors, not the component
 *   character tokens. Theme owns placeholder tables for base roles only, so
 *   a `required` list containing component roles throws by design — callers
 *   needing component roles must go through preset `scaffold()` /
 *   `requiredRolesFor`, which own the composition tables. A theme that is
 *   not complete is reported, not rejected — the studio's job is to show
 *   what is wrong, and a theme it refuses to load is one it cannot help fix.
 */

import { oc } from "@orpc/contract";
import * as v from "valibot";

import { TOKEN_TYPES } from "../pipeline/types.ts";
const ThemeText = v.pipe(
  v.string(),
  v.description("A DTCG theme document as JSON text."),
);
const DottedPath = v.pipe(
  v.array(v.pipe(v.string(), v.minLength(1))),
  v.minLength(1),
  v.description('DTCG path segments, e.g. ["color", "primary"].'),
);

const ValidationIssue = v.object({
  path: v.string(),
  message: v.string(),
});

const Analysis = v.object({
  /** Null when the text is not a parseable, well-formed token document. */
  error: v.nullable(v.string()),
  issues: v.array(ValidationIssue),
});

const CssOutput = v.object({
  error: v.nullable(v.string()),
  css: v.string(),
});

const MutationOutput = v.object({
  error: v.nullable(v.string()),
  /** The mutated document as JSON text. Null when the mutation was refused. */
  text: v.nullable(v.string()),
});

/** The closed `$type` vocabulary, derived from the pipeline's single list. */
const TokenType = v.picklist(TOKEN_TYPES);

/** Parse + validate + legibility in one round-trip. The studio overview page. */
export const analyzeTheme = oc
  .input(
    v.object({
      text: ThemeText,
      required: v.optional(v.array(v.string())),
    }),
  )
  .output(Analysis)
  .route({
    method: "POST",
    path: "/theme/analyze",
    summary: "Parse and validate a theme document",
  });

/** Emit the base-block stylesheet for one theme. */
export const themeCss = oc
  .input(
    v.object({
      text: ThemeText,
      selector: v.optional(v.string()),
      prefix: v.optional(v.string()),
    }),
  )
  .output(CssOutput)
  .route({
    method: "POST",
    path: "/theme/css",
    summary: "Generate CSS variables for a theme",
  });

/** Emit one stylesheet covering several named themes. */
export const themesCss = oc
  .input(
    v.object({
      themes: v.record(v.string(), ThemeText),
      selector: v.optional(v.string()),
      prefix: v.optional(v.string()),
    }),
  )
  .output(CssOutput)
  .route({
    method: "POST",
    path: "/themes/css",
    summary: "Generate CSS variables for named themes",
  });

/** Set a token's `$value`, creating it (with `$type`) when absent. */
export const setToken = oc
  .input(
    v.object({
      text: ThemeText,
      path: DottedPath,
      value: v.unknown(),
      type: v.optional(TokenType),
    }),
  )
  .output(MutationOutput)
  .route({
    method: "POST",
    path: "/theme/tokens/set",
    summary: "Set a token value",
  });

/** Remove the token at `path`. Groups are refused. */
export const removeToken = oc
  .input(v.object({ text: ThemeText, path: DottedPath }))
  .output(MutationOutput)
  .route({
    method: "POST",
    path: "/theme/tokens/remove",
    summary: "Remove a token",
  });

/** Move or rename the token at `from` to `to`, preserving `$type`. */
export const renameToken = oc
  .input(
    v.object({
      text: ThemeText,
      from: DottedPath,
      to: DottedPath,
    }),
  )
  .output(MutationOutput)
  .route({
    method: "POST",
    path: "/theme/tokens/rename",
    summary: "Rename a token",
  });

/**
 * The minimal valid theme: every required role, no scales. `required` names
 * the roles to scaffold; absent it, the base surface (`BASE_ROLES`).
 */
export const scaffold = oc
  .input(
    v.optional(
      v.object({
        required: v.optional(v.array(v.string())),
      }),
    ),
  )
  .output(v.object({ text: ThemeText }))
  .route({
    method: "POST",
    path: "/theme/scaffold",
    summary: "Create a scaffold theme",
  });

/** Emit `ThemeTokens`, `ThemeTokenPath`, and `ThemeCssVar` for a theme. */
export const themeTypes = oc
  .input(v.object({ text: ThemeText }))
  .output(
    v.object({
      error: v.nullable(v.string()),
      types: v.string(),
    }),
  )
  .route({
    method: "POST",
    path: "/theme/types",
    summary: "Generate TypeScript declarations for a theme",
  });
/**
 * A theme on disk, named by its file stem.
 *
 * The name is a bare stem constrained to `[a-z0-9-]`: a name from a picker
 * is untrusted input to a filesystem read, and a separator in it reads
 * outside the themes directory. The regex below is that constraint, stated
 * once in the contract so every caller shares it.
 */
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
  /** Path relative to the workspace, shown so the author knows what they edit. */
  file: v.string(),
});

/**
 * The project a call is about.
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

/** Every theme file in the project's themes directory. */
export const listThemes = oc
  .input(ProjectInput)
  .output(v.array(ProjectTheme))
  .route({
    method: "GET",
    path: "/project/themes/list",
    summary: "List the project's themes on disk",
  });

/** Read one theme file by name. */
export const readTheme = oc
  .input(v.object({ name: ThemeName, root: v.optional(v.string()) }))
  .output(
    v.object({ text: v.nullable(v.string()) }),
  )
  .route({
    method: "GET",
    path: "/project/themes/read",
    summary: "Read one theme file by name",
  });

/** Write one theme file by name, creating it when absent. */
export const writeTheme = oc
  .input(
    v.object({
      name: ThemeName,
      text: ThemeText,
      root: v.optional(v.string()),
    }),
  )
  .output(v.object({ error: v.nullable(v.string()) }))
  .route({
    method: "POST",
    path: "/project/themes/write",
    summary: "Write one theme file by name",
  });

/** Remove one theme file by name. */
export const removeTheme = oc
  .input(v.object({ name: ThemeName, root: v.optional(v.string()) }))
  .output(v.object({ error: v.nullable(v.string()) }))
  .route({
    method: "POST",
    path: "/project/themes/remove",
    summary: "Remove one theme file by name",
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

/** Create `spin/` and seed one theme from a starter. */
export const initProject = oc
  .input(
    v.object({
      root: v.string(),
      name: ThemeName,
      starter: v.pipe(v.string(), v.description("The starter to seed from.")),
    }),
  )
  .output(v.object({ error: v.nullable(v.string()) }))
  .route({
    method: "POST",
    path: "/project/init",
    summary: "Create the spin directory and seed a theme",
  });

/** Copy one theme file to a new name. A new theme starts as a copy. */
export const copyTheme = oc
  .input(
    v.object({
      from: ThemeName,
      to: ThemeName,
      root: v.optional(v.string()),
    }),
  )
  .output(v.object({ error: v.nullable(v.string()) }))
  .route({
    method: "POST",
    path: "/project/themes/copy",
    summary: "Copy one theme file to a new name",
  });

export const themeContract = {
  theme: {
    analyze: analyzeTheme,
    css: themeCss,
    types: themeTypes,
    scaffold,
    tokens: {
      set: setToken,
      remove: removeToken,
      rename: renameToken,
    },
  },
  themes: {
    css: themesCss,
  },
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
