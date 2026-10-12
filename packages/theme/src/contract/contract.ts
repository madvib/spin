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
  /**
   * The parsed tree, when there is one.
   *
   * The daemon has already parsed to reach the verdict, so handing the tree
   * back costs nothing and saves a consumer a second parse. The studio does
   * not read it yet — its analysis is synchronous and would have to become
   * async across eight call sites to move behind RPC — so this is a contract
   * answer waiting for its consumer rather than an unused one.
   */
  tree: v.nullable(v.unknown()),
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
};
