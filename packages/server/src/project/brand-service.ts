/**
 * A project's brands: one directory of layered theme documents each.
 *
 * The brand is the init flow's unit: `spin/<brand>/` holds the definition
 * (`brand.json` — name, description, nothing token-shaped) and the token
 * layer (`tokens.json` — every token override the brand states). A global
 * `reference.json` at the root of the themes directory composes under
 * every brand. Reading the disk and refusing collisions live here;
 * judging and generating live in `@spinjs/theme/brand`.
 *
 * The error voice matches `assertFacet`: brand + file + issue, said aloud —
 * a refusal names the brand, the file it would have written, and the issue
 * that stopped it, so the studio can show why instead of writing anyway.
 */

import {
  compose,
  mergeThemeDocuments,
  seedPalette,
  designLanguages,
  isDesignLanguage,
  suggestionFaces,
  typeSuggestions,
  validateTheme,
  type PaletteSeed,
  type ThemeDocument,
} from "@spinjs/theme";
import { CONFIG_FILENAME, PROJECT_DIR } from "./facts.ts";
import { resolveProjectDir } from "./resolve-dir.ts";
import type { BrandCreateOptions, BrandReport, BrandWriteResult, WriteResult } from "./schema.ts";


/** What `setPalette` seeds from: one primary, and the ramp behind it. */
export interface BrandPaletteSeed {
  /** The brand's mark: primary actions, links, focus rings. */
  readonly primary: string;
  /** The neutral ramp's own seed: paper and charcoal when the primary is loud. */
  readonly neutral?: string;
}

/** What `setType` states: faces, and the icon stroke beside them. */
export interface BrandTypeChoice {
  /** The display face. */
  readonly display?: string;
  /** The body face. */
  readonly body?: string;
  /** The mono face: code, identifiers, tabular figures. */
  readonly mono?: string;
  /** A named design language whose pairing to wear outright. */
  readonly suggestion?: string;
  /** The icon collection, kept as metadata: Lucide, Phosphor, or the author's own. */
  readonly icons?: string;
  /** The icon stroke: outline or filled. Type-adjacent, so asked together. */
  readonly stroke?: string;
}



const BRAND_NAME = /^[a-z0-9][a-z0-9-]*$/i;

function brandError(brand: string, file: string, issue: string): string {
  return `spin: brand "${brand}" in "${file}" is invalid: ${issue}`;
}

/** The themes directory on the filesystem. */
async function themesDirOf(root: string, themesDir?: string): Promise<string> {
  const value = themesDir ?? PROJECT_DIR;
  const resolved = await resolveProjectDir(root, value, "themes");
  if (resolved.file) {
    throw new Error(
      `cannot seat a brand in '${value}': it names one file`,
    );
  }
  return resolved.path;
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

function themeJson(document: unknown): string {
  return JSON.stringify(document, null, 2) + "\n";
}

/**
 * The brand's own layers, in the order the build composes.
 *
 * The global `reference.json` first when the themes directory holds one,
 * then the brand's `tokens.json`. Every token override the brand states
 * lives in `tokens.json`: there are no other layers.
 */
async function readLayers(
  brandDir: string,
  themesRoot: string,
): Promise<{ file: string; layer: ThemeDocument }[]> {
  const { join } = await import("node:path");
  const tagged: { file: string; layer: ThemeDocument }[] = [];
  const reference = await readJson(join(themesRoot, "reference.json"));
  if (reference !== undefined) {
    tagged.push({ file: join(themesRoot, "reference.json"), layer: reference });
  }
  const tokens = await readJson(join(brandDir, "tokens.json"));
  if (tokens !== undefined) tagged.push({ file: join(brandDir, "tokens.json"), layer: tokens });
  return tagged;
}

function parentOf(tagged: readonly { file: string; layer: ThemeDocument }[]): { name: string; document: ThemeDocument | undefined } | { name: undefined; document: undefined } {
  const tokens = tagged.find((entry) => entry.file.endsWith("tokens.json"))?.layer;
  const parentName = tokens?.["$extends"];
  if (typeof parentName !== "string") return { name: undefined, document: undefined };
  if (!isDesignLanguage(parentName)) return { name: parentName, document: undefined };
  return { name: parentName, document: designLanguages[parentName] };
}

/**
 * Makes a brand: the directory, the definition, and the project's brand.
 *
 * The brand starts with no tokens — `create` writes the directory, the
 * `brand.json` definition, and the project's `brand` when the project names
 * none yet, and the design language, palette, and type follow as their own
 * procedures. A brand that already exists is a collision, refused naming
 * the brand: `create` never overwrites a brand someone saved.
 */
export async function createBrand(options: BrandCreateOptions): Promise<BrandWriteResult> {
  const { mkdir, writeFile, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  if (!BRAND_NAME.test(options.name)) {
    return { error: `a brand name is a file stem, and "${options.name}" is not one` };
  }
  try {
    const dir = await themesDirOf(options.root, options.themesDir);
    const brandDir = join(dir, options.name);
    await mkdir(brandDir, { recursive: true });
    const definitionFile = join(brandDir, "brand.json");
    const tokensFile = join(brandDir, "tokens.json");
    let collision: string | null = null;
    try {
      await readFile(definitionFile, "utf8");
      collision = definitionFile;
    } catch {
      // No definition yet.
    }
    if (collision === null) {
      try {
        await readFile(tokensFile, "utf8");
        collision = tokensFile;
      } catch {
        // No tokens yet.
      }
    }
    if (collision !== null) {
      return { error: `a brand named ${options.name} already exists` };
    }
    const definition: Record<string, unknown> = { name: options.name };
    if (options.description !== undefined && options.description !== "") {
      definition["description"] = options.description;
    }
    await writeFile(definitionFile, themeJson(definition), "utf8");
    if (options.seat !== false) {
      const configFile = join(dir, CONFIG_FILENAME);
      let config: Record<string, unknown> = {};
      try {
        config = JSON.parse(await readFile(configFile, "utf8")) as Record<string, unknown>;
        if (typeof config !== "object" || config === null || Array.isArray(config)) config = {};
      } catch {
        config = {};
      }
      if (typeof config["brand"] !== "string") {
        await writeFile(configFile, themeJson({ ...config, brand: options.name }), "utf8");
      }
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Renames a brand: the directory, the project's brand, and the name inside.
 *
 * The `spin/<brand>/` directory moves, the config's `brand` entry naming
 * the old brand moves with it, the `brand.json` `name` moves, and any layer
 * `$extends` naming the old brand moves too (brands extend design
 * languages, so usually a no-op — still walked, refusing nothing). A
 * missing source and a colliding target are refused in the create voice.
 */
export async function renameBrand(
  root: string,
  brand: string,
  to: string,
  themesDir?: string,
): Promise<BrandWriteResult> {
  const { readFile, rename, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  if (!BRAND_NAME.test(to)) {
    return { error: `a brand name is a file stem, and "${to}" is not one` };
  }
  try {
    const dir = await themesDirOf(root, themesDir);
    const fromDir = join(dir, brand);
    const toDir = join(dir, to);
    let source: string | null = null;
    for (const file of ["brand.json", "tokens.json"]) {
      try {
        await readFile(join(fromDir, file), "utf8");
        source = file;
        break;
      } catch {
        // Not this file.
      }
    }
    if (source === null) {
      return { error: `no brand named ${brand}` };
    }
    for (const file of ["brand.json", "tokens.json"]) {
      try {
        await readFile(join(toDir, file), "utf8");
        return { error: `a brand named ${to} already exists` };
      } catch {
        // No collision on this file.
      }
    }
    await rename(fromDir, toDir);
    const definitionFile = join(toDir, "brand.json");
    try {
      const definition = JSON.parse(await readFile(definitionFile, "utf8")) as Record<string, unknown>;
      if (definition["name"] === brand) {
        await writeFile(definitionFile, themeJson({ ...definition, name: to }), "utf8");
      }
    } catch {
      // No definition to rename inside.
    }
    for (const entry of await readLayers(toDir, dir)) {
      if (entry.layer["$extends"] === brand) {
        await writeFile(entry.file, themeJson({ ...entry.layer, $extends: to }), "utf8");
      }
    }
    const configFile = join(dir, CONFIG_FILENAME);
    try {
      const config = JSON.parse(await readFile(configFile, "utf8")) as Record<string, unknown>;
      if (config["brand"] === brand) {
        await writeFile(configFile, themeJson({ ...config, brand: to }), "utf8");
      }
    } catch {
      // No config to reseat.
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
/**
 * Names the brand's design language: writes `$extends`, nothing else.
 *
 * The chain is `base → design language → brand tokens.json`: the brand
 * names one parent and transitivity handles the rest. An unknown language
  * is refused naming the valid set, the way `initFiles` refuses an unknown
  * language.
 */
export async function setBrandDesignLanguage(
  root: string,
  brand: string,
  language: string,
  themesDir?: string,
): Promise<BrandWriteResult> {
  const { readFile, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  if (!isDesignLanguage(language)) {
    return {
      error: brandError(
        brand,
        `${brand}/tokens.json`,
        `unknown design language "${language}" — expected one of ${Object.keys(designLanguages).join(", ")}`,
      ),
    };
  }
  try {
    const dir = await themesDirOf(root, themesDir);
    const brandDir = join(dir, brand);
    const tokensFile = join(brandDir, "tokens.json");
    let tokens: ThemeDocument = {};
    try {
      tokens = JSON.parse(await readFile(tokensFile, "utf8")) as ThemeDocument;
    } catch {
      tokens = {};
    }
    const next: ThemeDocument = { ...tokens, $extends: language };
    if (!next["modes"]) next["modes"] = ["light", "dark"];
    const text = themeJson(next);
    await writeFile(tokensFile, text, "utf8");
    return { error: null, tokensJson: text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Copies one brand directory to seed another: the `--from` escape hatch.
 * A whole directory, not a composed document: the copy keeps the sparse
 * layers, the definition, and the seating intent, so the new brand starts
 * where the old one is. Refuses when the source holds no brand or the
 * target already exists — an escape hatch copies, never overwrites.
 */
export async function copyBrandDirectory(
  root: string,
  from: string,
  name: string,
  themesDir?: string,
): Promise<WriteResult> {
  const { cp, mkdir, readFile, stat, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  if (!BRAND_NAME.test(name)) {
    return { error: `a brand name is a file stem, and "${name}" is not one` };
  }
  try {
    const dir = await themesDirOf(root, themesDir);
    const source = join(dir, from);
    const target = join(dir, name);
    let isBrand = false;
    try {
      isBrand = (await stat(source)).isDirectory() && (await stat(join(source, "tokens.json"))).isFile();
    } catch {
      isBrand = false;
    }
    if (!isBrand) {
      return { error: `no brand named ${from} — expected a brand directory in '${dir}'` };
    }
    try {
      await stat(target);
      return { error: `a brand named ${name} already exists` };
    } catch {
      // No target: the copy lands.
    }
    await mkdir(target, { recursive: true });
    await cp(source, target, { recursive: true });
    const configFile = join(dir, CONFIG_FILENAME);
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(await readFile(configFile, "utf8")) as Record<string, unknown>;
      if (typeof config !== "object" || config === null || Array.isArray(config)) config = {};
    } catch {
      config = {};
    }
    if (typeof config["brand"] !== "string") {
      await writeFile(configFile, themeJson({ ...config, brand: name }), "utf8");
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
/**
 * Seeds the brand's palette from one primary: the uniqueness engine.
 *
 * The seeded `color.*` layer is validated before write — a palette that
 * fails contrast never lands — and the refusal carries the issue text, the
 * way a facet names its file. Nothing is written when the seed fails: a
 * partial palette is worse than none, because the composition would judge
 * clean on the old colors while the author reads the new ones.
 */
export async function setBrandPalette(
  root: string,
  brand: string,
  seed: BrandPaletteSeed,
  themesDir?: string,
): Promise<BrandWriteResult> {
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    const dir = await themesDirOf(root, themesDir);
    const brandDir = join(dir, brand);
    const tokensFile = join(brandDir, "tokens.json");
    let tokens: ThemeDocument;
    try {
      tokens = JSON.parse(await readFile(tokensFile, "utf8")) as ThemeDocument;
    } catch {
      try {
        await readFile(join(brandDir, "brand.json"), "utf8");
      } catch {
        return {
          error: brandError(brand, `${brand}/tokens.json`, `no brand named ${brand} — create it first`),
        };
      }
      return {
        error: brandError(brand, `${brand}/tokens.json`, `no design language set — set one before seeding a palette`),
      };
    }
    const parentName = tokens["$extends"];
    if (typeof parentName !== "string" || !isDesignLanguage(parentName)) {
      return {
        error: brandError(
          brand,
          `${brand}/tokens.json`,
          typeof parentName === "string"
            ? `unknown design language "${parentName}" — expected one of ${Object.keys(designLanguages).join(", ")}`
            : `no design language set — set one before seeding a palette`,
        ),
      };
    }
    const paletteSeed: PaletteSeed = {
      primary: seed.primary,
      ...(seed.neutral === undefined ? {} : { neutral: seed.neutral }),
    };
    const seeded = seedPalette(parentName, paletteSeed);
    if (seeded.layer === undefined) {
      return {
        error: brandError(brand, `${brand}/tokens.json`, seeded.issues.join("; ") || "the seeded palette is invalid"),
      };
    }
    const layer = seeded.layer["color"] as ThemeDocument;
    const next = mergeThemeDocuments(tokens, { color: layer, modes: seeded.layer["modes"] } as ThemeDocument);
    const report = validateTheme(mergeThemeDocuments(next, { $extends: parentName }) as ThemeDocument);
    if (!report.valid) {
      const details = report.issues
        .map((issue) => `${issue.path ? `${issue.path}: ` : ""}${issue.message}`)
        .join("; ");
      return { error: brandError(brand, `${brand}/tokens.json`, details || "the seeded palette is invalid") };
    }
    await mkdir(brandDir, { recursive: true });
    const text = themeJson(next);
    await writeFile(tokensFile, text, "utf8");
    return { error: null, tokensJson: text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Sets the brand's type: faces per the design language's pairing, plus icons.
 *
 * A named suggestion wears the pairing outright; explicit faces override it;
 * `system-ui` is the escape hatch for the author who wants no voice. Icon
 * collection and stroke ride on the `brand.json` definition — metadata, not
 * tokens — because the palette screen's ink never learns what an icon is.
 * Faces are validated before write: an unknown suggestion names the valid
 * set, and nothing partial lands.
 */
export async function setBrandType(
  root: string,
  brand: string,
  choice: BrandTypeChoice,
  themesDir?: string,
): Promise<BrandWriteResult> {
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    const dir = await themesDirOf(root, themesDir);
    const brandDir = join(dir, brand);
    const tokensFile = join(brandDir, "tokens.json");
    const definitionFile = join(brandDir, "brand.json");
    let tokens: ThemeDocument;
    try {
      tokens = JSON.parse(await readFile(tokensFile, "utf8")) as ThemeDocument;
    } catch {
      return {
        error: brandError(brand, `${brand}/tokens.json`, `no brand named ${brand} — create it first`),
      };
    }
    const suggestions = typeSuggestions();
    if (choice.suggestion !== undefined && !suggestions.some((entry) => entry.language === choice.suggestion)) {
      return {
        error: brandError(
          brand,
          `${brand}/tokens.json`,
          `unknown type suggestion "${choice.suggestion}" — expected one of ${suggestions.map((entry) => entry.language).join(", ")}`,
        ),
      };
    }
    const parentName = tokens["$extends"];
    const parent = typeof parentName === "string" && isDesignLanguage(parentName) ? designLanguages[parentName] : undefined;
    const pairing = choice.suggestion !== undefined
      ? suggestions.find((entry) => entry.language === choice.suggestion)
      : parent !== undefined && typeof parentName === "string"
      ? suggestions.find((entry) => entry.language === parentName)
      : undefined;
    const faces: Record<string, { $value: string }> = {
      ...(pairing === undefined ? {} : suggestionFaces(pairing)),
      ...(choice.display === undefined ? {} : {
        heading: { $value: choice.display },
        display: { $value: choice.display },
      }),
      ...(choice.body === undefined ? {} : {
        sans: { $value: choice.body },
        body: { $value: choice.body },
      }),
      ...(choice.mono === undefined ? {} : { mono: { $value: choice.mono } }),
    };
    if (Object.keys(faces).length === 0) {
      return {
        error: brandError(brand, `${brand}/tokens.json`, `no faces named — suggest a language or state display, body, or mono`),
      };
    }
    const font = { family: faces };
    const next = mergeThemeDocuments(tokens, { font } as ThemeDocument);
    await mkdir(brandDir, { recursive: true });
    const text = themeJson(next);
    await writeFile(tokensFile, text, "utf8");
    if (choice.icons !== undefined || choice.stroke !== undefined) {
      let definition: Record<string, unknown> = { name: brand };
      try {
        definition = JSON.parse(await readFile(definitionFile, "utf8")) as Record<string, unknown>;
      } catch {
        // No definition yet: create writes it, setType only annotates it.
      }
      const icons = { ...((definition["icons"] ?? {}) as Record<string, unknown>) };
      if (choice.icons !== undefined) icons["collection"] = choice.icons;
      if (choice.stroke !== undefined) icons["stroke"] = choice.stroke;
      await writeFile(definitionFile, themeJson({ ...definition, icons }), "utf8");
    }
    return { error: null, tokensJson: text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Reads a brand: its definition, its layers, and the composition's judgment.
 *
 * The judgment is per-layer fragment checks plus per-composition
 * completeness: `compose()` over the parent the brand names, with the same
 * brand + file + issue voice as the refusals.
 */
export async function getBrand(
  root: string,
  brand: string,
  themesDir?: string,
): Promise<BrandReport> {
  const { join, relative } = await import("node:path");
  const dir = await themesDirOf(root, themesDir);
  const brandDir = join(dir, brand);
  const definition = (await readJson(join(brandDir, "brand.json"))) as Record<string, unknown> | undefined;
  if (definition === undefined) {
    return {
      name: brand,
      definition: {},
      layers: {},
      composed: undefined,
      valid: false,
      issues: [{ layer: "definition", path: "", message: `no brand named ${brand}` }],
    };
  }
  const tagged = await readLayers(brandDir, dir);
  const layers: Record<string, ThemeDocument> = {};
  for (const entry of tagged) {
    layers[relative(brandDir, entry.file)] = entry.layer;
  }
  if (tagged.length === 0) {
    return {
      name: brand,
      definition,
      layers,
      composed: undefined,
      valid: false,
      issues: [{ layer: "tokens", path: "", message: `brand "${brand}" holds no token layers` }],
    };
  }
  const parent = parentOf(tagged);
  if (parent.name !== undefined && parent.document === undefined) {
    return {
      name: brand,
      definition,
      layers,
      composed: undefined,
      valid: false,
      issues: [{
        layer: "layer[0]",
        path: "$extends",
        message: `unknown design language "${parent.name}" — expected one of ${Object.keys(designLanguages).join(", ")}`,
      }],
    };
  }
  const result = compose(
    tagged.map((entry) => entry.layer),
    parent.document,
  );
  if (parent.name !== undefined && result.document !== undefined) {
    result.document["$extends"] = parent.name;
  }
  return {
    name: brand,
    definition,
    layers,
    composed: result.document,
    valid: result.valid,
    issues: [...result.issues],
  };
}

