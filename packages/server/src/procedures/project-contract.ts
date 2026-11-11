/**
 * The project contract: the wire shape of a project's facts.
 *
 * The contract composes the project's own schemas (`../project/schema.ts`);
 * it never re-declares a domain shape. Routes and summaries live here —
 * what a call looks like over the wire — and nothing else. The operations
 * live in the project module, which owns where files are and what answers
 * mean. The daemon mounts the one on the other and adds the transport.
 */

import { oc } from "@orpc/contract";
import * as v from "valibot";
import {
  BrandCreateOptionsSchema,
  BrandNameSchema,
  BrandPaletteSeedSchema,
  BrandRenameSchema,
  BrandReportSchema,
  BrandTypeChoiceSchema,
  BrandWriteResultSchema,
  InitProjectOptionsSchema,
  ProjectFacetSchema,
  ProjectReportSchema,
  ProjectThemeSchema,
  SpinConfigFileSchema,
  ThemeNameSchema,
} from "../project/index.ts";

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
  .output(v.array(ProjectThemeSchema))
  .route({
    method: "GET",
    path: "/project/themes/list",
    summary:
      "List the project's themes: what the build serves, local files beside the unforked brand",
  });

export const readTheme = oc
  .input(v.object({ name: ThemeNameSchema, root: v.optional(v.string()) }))
  .output(v.object({ text: v.nullable(v.string()) }))
  .route({
    method: "GET",
    path: "/project/themes/read",
    summary: "Read one theme by name, disk first, then the brand layer",
  });

export const writeTheme = oc
  .input(
    v.object({
      name: ThemeNameSchema,
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
  .input(v.object({ name: ThemeNameSchema, root: v.optional(v.string()) }))
  .output(v.object({ error: v.nullable(v.string()) }))
  .route({
    method: "POST",
    path: "/project/themes/remove",
    summary: "Remove one theme file by name",
  });

export const copyTheme = oc
  .input(
    v.object({ from: ThemeNameSchema, to: ThemeNameSchema, root: v.optional(v.string()) }),
  )
  .output(v.object({ error: v.nullable(v.string()) }))
  .route({
    method: "POST",
    path: "/project/themes/copy",
    summary: "Copy one theme file to a new name",
  });
export const listFacets = oc
  .input(ProjectInput)
  .output(v.array(ProjectFacetSchema))
  .route({
    method: "GET",
    path: "/project/themes/facets",
    summary: "List the project's facets: palette and spacing files by name and kind",
  });

export const createFacet = oc
  .input(
    v.object({
      name: v.string(),
      base: ThemeNameSchema,
      kind: v.picklist(["palette", "spacing"]),
      tokens: v.record(v.string(), v.unknown()),
      root: v.optional(v.string()),
    }),
  )
  .output(v.object({ error: v.nullable(v.string()) }))
  .route({
    method: "POST",
    path: "/project/themes/createFacet",
    summary: "Write one facet file, shape-checked before write",
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
  .output(ProjectReportSchema)
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
  .output(ProjectReportSchema)
  .route({
    method: "POST",
    path: "/project/current",
    summary: "Report the daemon's own project",
  });

export const initProject = oc
  .input(InitProjectOptionsSchema)
  .output(v.object({ error: v.nullable(v.string()) }))
  .route({
    method: "POST",
    path: "/project/init",
    summary: "Create the spin directory, a theme, and an uno config",
  });

export const createBrand = oc
  .input(BrandCreateOptionsSchema)
  .output(BrandWriteResultSchema)
  .route({
    method: "POST",
    path: "/project/brand/create",
    summary: "Create a brand: its directory, its definition, and its config seating",
  });

export const setBrandDesignLanguage = oc
  .input(
    v.object({
      root: v.string(),
      brand: BrandNameSchema,
      language: v.string(),
      themesDir: v.optional(v.string()),
    }),
  )
  .output(BrandWriteResultSchema)
  .route({
    method: "POST",
    path: "/project/brand/setDesignLanguage",
    summary: "Name the brand's design language: writes $extends, nothing else",
  });

export const setBrandPalette = oc
  .input(BrandPaletteSeedSchema)
  .output(BrandWriteResultSchema)
  .route({
    method: "POST",
    path: "/project/brand/setPalette",
    summary: "Seed the brand's palette from one primary, validated before write",
  });

export const setBrandType = oc
  .input(BrandTypeChoiceSchema)
  .output(BrandWriteResultSchema)
  .route({
    method: "POST",
    path: "/project/brand/setType",
    summary: "Set the brand's type: curated faces plus icon stroke, validated before write",
  });

export const getBrand = oc
  .input(
    v.object({
      root: v.string(),
      brand: BrandNameSchema,
      themesDir: v.optional(v.string()),
    }),
  )
  .output(BrandReportSchema)
  .route({
    method: "POST",
    path: "/project/brand/get",
    summary: "Read a brand: its definition, its layers, and the composition's judgment",
  });

export const renameBrand = oc
  .input(BrandRenameSchema)
  .output(BrandWriteResultSchema)
  .route({
    method: "POST",
    path: "/project/brand/rename",
    summary: "Rename a brand: its directory, its seating, and the name inside",
  });

export const projectContract = {
  project: {
    // `detect`, `current` and `init` are the project's own, not a theme's:
    // one answers whether a root is spin's, one answers which root this is,
    // the other makes one.
    detect: detectProject,
    current: currentProject,
    init: initProject,
    brand: {
      create: createBrand,
      setDesignLanguage: setBrandDesignLanguage,
      setPalette: setBrandPalette,
      setType: setBrandType,
      get: getBrand,
      rename: renameBrand,
    },
    themes: {
      list: listThemes,
      read: readTheme,
      write: writeTheme,
      remove: removeTheme,
      copy: copyTheme,
      createFacet,
      facets: listFacets,
    },
    config: {
      read: readConfig,
      write: writeConfig,
    },
  },
};
