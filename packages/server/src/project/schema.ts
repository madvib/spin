/**
 * The project's shapes, stated once: the valibot schema IS the domain.
 *
 * The contract composes these; it never re-declares them. A shape that
 * changes changes here, and every procedure — daemon, CLI, MCP, Studio —
 * follows. The TS types derive from the schemas (`v.InferOutput`), so
 * there is one definition, not a type beside a mirror.
 */

import * as v from "valibot";

/** A theme on disk, named by its file stem. */
export const ThemeNameSchema = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9][a-z0-9-]*$/i),
  v.description("A theme file stem, e.g. `default`."),
);

/** A theme the project holds. The text is what an author edits. */
export const ProjectThemeSchema = v.object({
  /** File stem, and the name written back to disk. */
  name: ThemeNameSchema,
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
  /** Where the theme is served from: a local file, the brand, or a verbatim map. */
  origin: v.picklist(["local", "brand", "verbatim"]),
});

export type ProjectTheme = v.InferOutput<typeof ProjectThemeSchema>;

/** A facet the project holds: a palette or spacing file composing over a base. */
export const ProjectFacetSchema = v.object({
  /** File stem before the kind suffix: `<name>.palette.json` serves `name`. */
  name: v.string(),
  /** Which tokens the facet carries. */
  kind: v.picklist(["palette", "spacing"]),
});

export type ProjectFacet = v.InferOutput<typeof ProjectFacetSchema>;

/** What a project root looks like. */
export const ProjectReportSchema = v.object({
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

export type ProjectReport = v.InferOutput<typeof ProjectReportSchema>;

/** What `spin/config.json` holds, when it holds anything. Unknown keys stripped, never rejected. */
export const SpinConfigFileSchema = v.object({
  /** The project's brand: the `spin/<brand>/` directory the project serves by default. */
  brand: v.optional(v.string()),
  /** Project directory holding user-authored components. Default `"src/lib/components"`. */
  componentsDir: v.optional(v.string()),
  /** How much the semantic rules report. Default `"strict"`. */
  strictness: v.optional(v.picklist(["strict", "balanced", "lenient"])),
  /** The project's icons: the collection the lint holds icon classes to. */
  icons: v.optional(v.object({
    /** The iconify collection the project's icon classes come from, e.g. `"lucide"`. */
    collection: v.optional(v.string()),
  })),
});

export type SpinConfigFile = v.InferOutput<typeof SpinConfigFileSchema>;

/** What `spin/shortcuts.json` holds: each composition's name, and the classes it expands to. */
export const SpinShortcutsFileSchema = v.record(v.string(), v.string());

export type SpinShortcutsFile = v.InferOutput<typeof SpinShortcutsFileSchema>;

/** A brand's name: the `spin/<brand>/` directory it lives in. */
export const BrandNameSchema = ThemeNameSchema;

/** What a rename names: the brand, and the name it takes. */
export const BrandRenameSchema = v.object({
  root: v.string(),
  brand: BrandNameSchema,
  to: BrandNameSchema,
  themesDir: v.optional(v.string()),
});

export type BrandRename = v.InferOutput<typeof BrandRenameSchema>;

/** What an operation that writes answers with. */
export const WriteResultSchema = v.object({
  /** The refusal, or null when the write landed. */
  error: v.nullable(v.string()),
});

export type WriteResult = v.InferOutput<typeof WriteResultSchema>;

/** One brand procedure's answer: the written layer, or why it refused. */
export const BrandWriteResultSchema = v.object({
  ...WriteResultSchema.entries,
  /** The layer text written, present only when the write landed. */
  tokensJson: v.optional(v.string()),
});

export type BrandWriteResult = v.InferOutput<typeof BrandWriteResultSchema>;

/** A brand's judgment: one problem in one layer, located by layer. */
export const BrandIssueSchema = v.object({
  layer: v.string(),
  path: v.string(),
  message: v.string(),
});

export type BrandIssue = v.InferOutput<typeof BrandIssueSchema>;

/** The brand a `get` answers with: its definition, its layers, its judgment. */
export const BrandReportSchema = v.object({
  /** The brand's name. */
  name: v.string(),
  /** The brand's definition: name, description, icon preference. */
  definition: v.record(v.string(), v.unknown()),
  /** The brand's layers by file: what the brand owns, sparse. */
  layers: v.record(v.string(), v.unknown()),
  /** The composed document the build serves, with `$extends` naming the parent. */
  composed: v.optional(v.unknown()),
  /** Whether the composition holds. */
  valid: v.boolean(),
  /** Every problem, located by layer — empty when the composition holds. */
  issues: v.array(BrandIssueSchema),
});

export type BrandReport = v.InferOutput<typeof BrandReportSchema>;

/** What `create` writes: the brand's home on disk. */
export const BrandCreateOptionsSchema = v.object({
  /** The project root the brand is created in. */
  root: v.string(),
  /** The brand's name: the `spin/<brand>/` directory and the seating key. */
  name: BrandNameSchema,
  /** Plain text on the brand definition file. Brand metadata, nothing more. */
  description: v.optional(v.string()),
  /** The themes directory. Defaults to `"spin"`. */
  themesDir: v.optional(v.string()),
  /** Seat the brand in `spin/config.json` as the project's brand. Defaults to true. */
  seat: v.optional(v.boolean()),
});

export type BrandCreateOptions = v.InferOutput<typeof BrandCreateOptionsSchema>;

/** What `setPalette` seeds from: one primary, and the ramp behind it. */
export const BrandPaletteSeedSchema = v.object({
  /** The project root the brand lives in. */
  root: v.string(),
  /** The brand to seed. */
  brand: BrandNameSchema,
  /** The brand's mark: primary actions, links, focus rings. */
  primary: v.string(),
  /** The neutral ramp's own seed: paper and charcoal when the primary is loud. */
  neutral: v.optional(v.string()),
  /** The themes directory. Defaults to `"spin"`. */
  themesDir: v.optional(v.string()),
});

export type BrandPaletteSeed = v.InferOutput<typeof BrandPaletteSeedSchema>;

/** What `setType` states: faces, and the icon stroke beside them. */
export const BrandTypeChoiceSchema = v.object({
  /** The project root the brand lives in. */
  root: v.string(),
  /** The brand to set type on. */
  brand: BrandNameSchema,
  /** The display face. */
  display: v.optional(v.string()),
  /** The body face. */
  body: v.optional(v.string()),
  /** The mono face: code, identifiers, tabular figures. */
  mono: v.optional(v.string()),
  /** A named design language whose pairing to wear outright. */
  suggestion: v.optional(v.string()),
  /** The icon collection, kept as metadata: Lucide, Phosphor, or the author's own. */
  icons: v.optional(v.string()),
  /** The icon stroke: outline or filled. Type-adjacent, so asked together. */
  stroke: v.optional(v.string()),
  /** The themes directory. Defaults to `"spin"`. */
  themesDir: v.optional(v.string()),
});

export type BrandTypeChoice = v.InferOutput<typeof BrandTypeChoiceSchema>;

/** The linter a fresh project lints with. */
export const LinterKindSchema = v.picklist(["oxlint", "eslint", "none"]);

export type LinterKind = v.InferOutput<typeof LinterKindSchema>;

/** The bundler a fresh project builds with. */
export const BundlerKindSchema = v.picklist([
  "vite",
  "rspack",
  "webpack",
  "rollup",
  "rolldown",
  "esbuild",
  "bun",
  "unocss",
]);

export type BundlerKind = v.InferOutput<typeof BundlerKindSchema>;
/** What `init` writes. */
export const InitProjectOptionsSchema = v.object({
  /** The project root to create in. */
  root: v.string(),
  /** The theme name to seed. */
  name: ThemeNameSchema,
  /** The design language to seed the theme from. */
  language: v.pipe(
    v.string(),
    v.description("The design language to seed the theme from."),
  ),
  /** The bundler to scaffold a config for. */
  bundler: v.optional(BundlerKindSchema),
  /** The themes directory. Defaults to `"spin"`. */
  themesDir: v.optional(v.string()),
  /** The components directory. Defaults to `"src/lib/components"`. */
  componentsDir: v.optional(v.string()),
  /** The custom-element prefix. Defaults to the sanitized package name. */
  prefix: v.optional(v.string()),
  /** Vendor the theme into the project rather than extending it. */
  vendor: v.optional(v.boolean()),
  /** The linter to scaffold a config for. Defaults to detected, else `"none"`. */
  linter: v.optional(LinterKindSchema),
  /** Write the project agent skill under `skillDir` (defaults to `.agents/skills`). */
  skill: v.optional(v.boolean()),
  /** Target directory (relative to root) for project agent skills. */
  skillDir: v.optional(v.string()),
  /** Generate the `<brand>-brand` skill alongside the general `spin` skill. */
  brandSkill: v.optional(v.boolean()),
  from: v.optional(
    v.pipe(
      v.string(),
      v.description("Seed from an existing brand directory instead of a design language."),
    ),
  ),
});

export type InitProjectOptions = v.InferOutput<typeof InitProjectOptionsSchema>;

/** Where a saved icon came from. Recordable, not required. */
export const IconAttributionSchema = v.object({
  /** The collection the glyph came from, e.g. `lucide`. */
  collection: v.nullable(v.string()),
  /** Who made it. */
  author: v.nullable(v.string()),
  /** The licence it is under, e.g. `ISC`. */
  license: v.nullable(v.string()),
});

export type IconAttribution = v.InferOutput<typeof IconAttributionSchema>;

/** What a save carries: the markup, and where it came from. The name rides the call, not the document. */
export const SavedIconSchema = v.object({
  /** The markup that draws it. */
  markup: v.string(),
  /** Where it came from, when that is known. */
  attribution: IconAttributionSchema,
});

export type SavedIcon = v.InferOutput<typeof SavedIconSchema>;

/** A saved icon the project holds, as operations answer. */
export const ProjectIconSchema = v.object({
  ...SavedIconSchema.entries,
  /** File stem, and the name written back to disk. */
  name: v.string(),
});

export type ProjectIcon = v.InferOutput<typeof ProjectIconSchema>;

/** Theme documents by name, as the overlay holds them. */
export const ThemeDocumentsSchema = v.record(v.string(), v.unknown());

export type ThemeDocuments = v.InferOutput<typeof ThemeDocumentsSchema>;

/** Whether the overlay is the live source rather than disk. */
export const OpenStateSchema = v.object({
  open: v.boolean(),
});

export type OpenState = v.InferOutput<typeof OpenStateSchema>;

/** What the overlay holds now: the live source, its themes, and what differs from disk. */
export const OverlayStateSchema = v.object({
  /** True when the overlay is the live source rather than disk. */
  open: v.boolean(),
  /** The overlaid documents by name. */
  themes: ThemeDocumentsSchema,
  /** The overlaid names whose documents differ from disk. */
  dirty: v.array(v.string()),
});

export type OverlayState = v.InferOutput<typeof OverlayStateSchema>;
