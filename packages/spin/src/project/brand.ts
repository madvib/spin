/**
 * A project's brand: one directory of layered theme documents.
 *
 * A brand is a directory under the project's themes directory holding the
 * brand's decisions in layers: `tokens.json` (identity: faces, styles,
 * palette, modes, and the `$extends` starter), `reference.json` (scale
 * overrides), `elements.json` (element voice overrides),
 * `primitives/*.json` (per-component overrides), `themes/*.palette.json`
 * and `themes/*.spacing.json` (runtime facets), and `icons/` (saved SVGs
 * the icon operations own — never read here).
 *
 * The layers merge in that order over the starter the brand names, so a
 * brand is a sparse diff and the starter stays shipped. Flat
 * `spin/<name>.json` files keep working unchanged beside brand
 * directories: a file is a theme, a directory is a brand, and the two
 * never collide because a directory has no `.json` suffix.
 */

import { mergeThemeDocuments } from "../theme/extends.ts";
import type { ThemeDocument } from "../theme/pipeline/types.ts";
import {
  validatePaletteFacet,
  validateSpacingFacet,
} from "../theme/contract/validate-theme.ts";
import { CONFIG_FILENAME } from "./facts.ts";
import { resolveProjectDir } from "./resolve-dir.ts";

/**
 * The three axes a project serves, classified by suffix.
 *
 * `<name>.json` (excluding `config.json`) is a base theme served under
 * `[data-theme]`; `<name>.palette.json` is a palette facet served under
 * `[data-palette]`; `<name>.spacing.json` is a spacing facet served under
 * `[data-spacing]`. The three touch disjoint custom properties, so a palette
 * or spacing file beside a theme of the same name composes with it rather
 * than forking it.
 */
export interface ThemeFacets {
  /** Base themes, by name: flat files and composed brands. */
  themes: Record<string, ThemeDocument>;
  /** Palette facets, by name: `<name>.palette.json`, flat or under a brand. */
  palettes: Record<string, ThemeDocument>;
  /** Spacing facets, by name: `<name>.spacing.json`, flat or under a brand. */
  spacings: Record<string, ThemeDocument>;
}

/** Read JSON, or undefined when the file is missing or does not parse. */
async function readJson(file: string): Promise<ThemeDocument | undefined> {
  const { readFile } = await import("node:fs/promises");
  try {
    return JSON.parse(await readFile(file, "utf8")) as ThemeDocument;
  } catch {
    return undefined;
  }
}

/**
 * One brand directory, composed to the document the build serves.
 *
 * The brand names its starter in `tokens.json`; the starter itself resolves
 * later, when the preset parses — what is composed here is the brand's own
 * layers, in order: reference, tokens, elements, then each primitive file
 * in sorted name order. `$extends` is carried from `tokens.json` (falling
 * back to `reference.json`), since a merge drops the override's own.
 */
async function composeBrand(dir: string): Promise<ThemeDocument | undefined> {
  const { readdir } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const reference = await readJson(join(dir, "reference.json"));
  const tokens = await readJson(join(dir, "tokens.json"));
  const elements = await readJson(join(dir, "elements.json"));
  const layers: ThemeDocument[] = [];
  if (reference !== undefined) layers.push(reference);
  if (tokens !== undefined) layers.push(tokens);
  if (elements !== undefined) layers.push(elements);
  let primitiveFiles: string[] = [];
  try {
    primitiveFiles = (await readdir(join(dir, "primitives"))).filter((name) =>
      name.endsWith(".json")
    ).sort();
  } catch {
    // No primitives directory: the brand states no component overrides.
  }
  for (const file of primitiveFiles) {
    const layer = await readJson(join(dir, "primitives", file));
    if (layer !== undefined) layers.push(layer);
  }
  if (layers.length === 0) return undefined;
  let merged: ThemeDocument = {};
  for (const layer of layers) merged = mergeThemeDocuments(merged, layer);
  const parent = tokens?.["$extends"] ?? reference?.["$extends"];
  if (typeof parent === "string") merged["$extends"] = parent;
  return merged;
}

/** A facet file that fails its shape check is an author error, said aloud. */
function assertFacet(
  file: string,
  kind: "palette" | "spacing",
  document: ThemeDocument,
): void {
  const report = kind === "palette"
    ? validatePaletteFacet(document)
    : validateSpacingFacet(document);
  if (!report.valid) {
    const details = report.issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("; ");
    throw new Error(`spin: facet "${file}" is invalid: ${details}`);
  }
}

/** File one facet document under its axis, shape-checked. */
function fileFacet(
  facets: ThemeFacets,
  full: string,
  stem: string,
  document: ThemeDocument,
): void {
  if (stem.endsWith(".palette")) {
    const name = stem.slice(0, -".palette".length);
    assertFacet(full, "palette", document);
    facets.palettes[name] = document;
  } else if (stem.endsWith(".spacing")) {
    const name = stem.slice(0, -".spacing".length);
    assertFacet(full, "spacing", document);
    facets.spacings[name] = document;
  }
}

/**
 * The themes a project's directory holds: flat files and brand directories.
 *
 * A file that doesn't parse is skipped rather than thrown on: a half
 * written theme in an editor would otherwise break the whole stylesheet,
 * and one bad theme should not cost the app its other themes. The
 * directory is the configured local path, and a value naming one file
 * serves that file alone. Facets — flat or under a brand — are shape
 * checked on load: a facet that carries the wrong tokens is refused with
 * the file that carries them.
 */
export async function loadProjectBrand(
  root: string,
  themesDir = "spin",
): Promise<ThemeFacets> {
  const { readdir, stat } = await import("node:fs/promises");
  const { basename, join } = await import("node:path");
  const resolved = await resolveProjectDir(root, themesDir, "themes");
  const facets: ThemeFacets = { themes: {}, palettes: {}, spacings: {} };
  if (resolved.file) {
    if (!resolved.path.endsWith(".json")) return facets;
    const document = await readJson(resolved.path);
    if (document === undefined) return facets;
    facets.themes[basename(resolved.path, ".json")] = document;
    return facets;
  }
  let entries: string[];
  try {
    entries = await readdir(resolved.path);
  } catch {
    return facets;
  }
  // Brand directories, in sorted order so facet collisions resolve
  // deterministically: a later brand's facet of the same name wins.
  const brands: string[] = [];
  for (const entry of entries.sort()) {
    if (entry === CONFIG_FILENAME) continue;
    const full = join(resolved.path, entry);
    if (entry.endsWith(".json")) {
      const stem = entry.slice(0, -".json".length);
      const document = await readJson(full);
      if (document === undefined) continue;
      if (stem.endsWith(".palette") || stem.endsWith(".spacing")) {
        fileFacet(facets, full, stem, document);
      } else {
        facets.themes[stem] = document;
      }
      continue;
    }
    try {
      if (!(await stat(full)).isDirectory()) continue;
    } catch {
      continue;
    }
    brands.push(entry);
  }
  for (const brand of brands) {
    const dir = join(resolved.path, brand);
    const composed = await composeBrand(dir);
    if (composed !== undefined) facets.themes[brand] = composed;
    let files: string[];
    try {
      files = (await readdir(join(dir, "themes"))).filter((name) =>
        name.endsWith(".json")
      ).sort();
    } catch {
      // No themes directory: the brand serves no facets.
      continue;
    }
    for (const file of files) {
      const full = join(dir, "themes", file);
      const stem = file.slice(0, -".json".length);
      const document = await readJson(full);
      if (document === undefined) continue;
      fileFacet(facets, full, stem, document);
    }
  }
  return facets;
}
