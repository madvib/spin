/**
 * The project's facts, read at once and synchronously.
 *
 * The daemon's client is bundled for the browser, and a `node:` import at
 * the top of the index would follow it into a bundle that must never touch a
 * disk. So the synchronous half lives here, behind its own entry: a linter
 * reads a project's facts while it walks a file, and a linter cannot wait
 * for a promise — the visitor it runs is called on the node it is looking
 * at, and the answer has to be there.
 *
 * The questions here are the ones the asynchronous service answers. What
 * differs is only how they are asked: one call, one answer, no waiting.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import * as v from "valibot";
import type { ShortcutDeclaration } from "./configuration.ts";
import { CONFIG_FILES, CONFIG_FILENAME, ICONS_DIR, PROJECT_DIR, SHORTCUTS_FILENAME } from "./facts.ts";
import { SpinShortcutsFileSchema, type SpinConfigFile } from "./schema.ts";

export type { ShortcutDeclaration };

/** Whether a path is a directory. */
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The project root a file belongs to, if there is one.
 *
  * The nearest ancestor holding a `spin/` directory wins. A file outside any
  * project has no root, and the vocabulary falls back to the design languages.
 */
export function findProjectRoot(from: string): string | undefined {
  return findProjectRootIn(dirname(from));
}

/**
 * The project root a directory belongs to, if there is one.
 *
 * The directory itself counts: the tool's root is a project when it holds
 * a `spin/` directory, and the ancestors above it are tried in turn. A
 * ceiling bounds the walk: the tool's own root must never be above the
 * tree it runs in, or a checkout named `spin` reads its own parent as a
 * project.
 */
export function findProjectRootIn(
  directory: string,
  ceiling?: string,
): string | undefined {
  let dir = directory;
  for (;;) {
    if (isDirectory(join(dir, PROJECT_DIR))) return dir;
    if (ceiling !== undefined && dir === ceiling) return undefined;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * The root whose build configuration declares a file's project, if there is
 * one.
 *
 * The nearest ancestor holding a configuration, the way a project's root is
 * the nearest ancestor holding a `spin/` directory. A file outside every
 * project has no configuration, and so declares no shortcuts.
 */
export function findConfigRoot(from: string): string | undefined {
  let dir = dirname(from);
  for (;;) {
    for (const name of CONFIG_FILES) {
      if (existsSync(join(dir, name))) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * The project's own themes, by name: the text of each brand's tokens.
 *
 * One brand directory each: `spin/<brand>/tokens.json` reads as the brand
 * name, and the global `spin/reference.json` reads beside them when the
 * project holds one. The design languages are not here: a project inherits
 * them rather than restating them, and the set they come from is the theme
 * package's. A file that cannot be read is skipped rather than thrown on —
 * a half written theme in an editor must not cost the reader the themes
 * the project has.
 *
 * The texts are the sparse layers, not the composed documents: the reader
 * merges them over the languages itself, so a half written brand degrades
 * to its readable tokens rather than vanishing behind a composition the
 * build would refuse.
 */
export function themeTextsIn(root: string): Record<string, string> {
  return themeTextsInAt(join(root, PROJECT_DIR));
}

/**
 * The themes a themes directory holds, by name: the text of each brand's
 * tokens, beside the global reference.
 *
 * The directory itself, not the project around it: a custom `themesDir`
 * reads from where the configuration points, and the default reads from
 * `spin/`. Same skips as the project form — an unreadable file costs
 * nothing.
 */
export function themeTextsInAt(themesPath: string): Record<string, string> {
  const out: Record<string, string> = {};
  let entries: { name: string; isDirectory(): boolean }[];
  try {
    entries = readdirSync(themesPath, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      if (entry.name !== "reference.json") continue;
      try {
        out["reference"] = readFileSync(join(themesPath, entry.name), "utf8");
      } catch {
        // Skipped: see above.
      }
      continue;
    }
    try {
      out[entry.name] = readFileSync(join(themesPath, entry.name, "tokens.json"), "utf8");
    } catch {
      // Skipped: see above.
    }
  }
  return out;
}

/**
 * The icon collections a themes directory declares, by brand.
 *
 * Each brand's `brand.json` may name its icon set under `icons.collection`;
 * the union is the project's declared set. A brand without one, or a
 * definition that does not parse, contributes nothing — an undeclared set
 * is not an error, it is an unenforced lint.
 */
export function brandIconCollections(themesPath: string): ReadonlySet<string> {
  const out = new Set<string>();
  let entries: { name: string; isDirectory(): boolean }[];
  try {
    entries = readdirSync(themesPath, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const definition: unknown = JSON.parse(
        readFileSync(join(themesPath, entry.name, "brand.json"), "utf8"),
      );
      const icons = (definition as { icons?: unknown } | null)?.icons;
      const collection = (icons as { collection?: unknown } | null)?.collection;
      if (typeof collection === "string" && collection !== "") out.add(collection);
    } catch {
      // Skipped: see above.
    }
  }
  return out;
}

/**
 * The saved glyphs a themes directory holds, as the classes that name them.
 *
 * Each `icons/*.json` document carries its attribution: a glyph saved from
 * a collection passes as `i-<collection>-<name>`, whatever the brand
 * declares — a glyph the project explicitly saved is intentional.
 */
export function savedIconGlyphs(themesPath: string): ReadonlySet<string> {
  const out = new Set<string>();
  let entries: string[];
  try {
    entries = readdirSync(join(themesPath, ICONS_DIR));
  } catch {
    return out;
  }
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".json")) continue;
    try {
      const document: unknown = JSON.parse(
        readFileSync(join(themesPath, ICONS_DIR, entry), "utf8"),
      );
      const attribution = (document as { attribution?: unknown } | null)?.attribution;
      const collection = (attribution as { collection?: unknown } | null)?.collection;
      if (typeof collection !== "string" || collection === "") continue;
      out.add(`i-${collection}-${entry.slice(0, -".json".length)}`);
    } catch {
      // Skipped: a half written glyph is not one the project holds.
    }
  }
  return out;
}

/**
 * The code files inside a themes directory, relative to it.
 *
 * A themes directory holds DTCG JSON, `config.json`, `shortcuts.json`,
 * and `icons/` — a `.ts`, `.tsx`, `.js`, or `.mjs` file inside it is a
 * project file in the wrong place, said aloud so it can move out.
 */
export function foreignFiles(themesPath: string): readonly string[] {
  const out: string[] = [];
  const stack: string[] = [themesPath];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let entries: { name: string; isDirectory(): boolean }[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        stack.push(full);
        continue;
      }
      if (/\.(?:tsx?|mjs|js)$/.test(entry.name)) {
        out.push(full.slice(themesPath.length + 1));
      }
    }
  }
  return out.sort();
}

/**
 * The project's own configuration: the parsed `spin/config.json`.
 *
 * Project facts only — the brand, the components directory, the lint
 * strictness, the icon collection. Missing, unreadable, or unparsable all
 * answer the empty config: unknown keys ignored, shape coerced, never an
 * error.
 */
export function configIn(root: string): SpinConfigFile {
  let text: string;
  try {
    text = readFileSync(join(root, PROJECT_DIR, CONFIG_FILENAME), "utf8");
  } catch {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  const record = parsed as Record<string, unknown>;
  const out: { brand?: string; componentsDir?: string; strictness?: "strict" | "balanced" | "lenient"; icons?: { collection?: string } } = {};
  if (typeof record["brand"] === "string") out.brand = record["brand"];
  if (typeof record["componentsDir"] === "string") out.componentsDir = record["componentsDir"];
  if (
    record["strictness"] === "strict" ||
    record["strictness"] === "balanced" ||
    record["strictness"] === "lenient"
  ) {
    out.strictness = record["strictness"];
  }
  const icons = record["icons"];
  if (typeof icons === "object" && icons !== null && !Array.isArray(icons)) {
    const collection = (icons as Record<string, unknown>)["collection"];
    if (typeof collection === "string") out.icons = { collection };
  }
  return out;
}
/**
 * The shortcuts a project's themes directory declares.
 *
 * The table in `shortcuts.json`, validated as JSON: each name splits to
 * the classes it expands to. A missing file declares nothing; a file that
 * does not parse — or an entry that is not a string — is reported as
 * unreadable rather than guessed at, and a vocabulary that could not be
 * read is one the lint must not enforce.
 */
export function readProjectShortcutsFile(themesRoot: string): ShortcutDeclaration {
  let text: string;
  try {
    text = readFileSync(join(themesRoot, SHORTCUTS_FILENAME), "utf8");
  } catch {
    return { shortcuts: {}, unreadable: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { shortcuts: {}, unreadable: true };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { shortcuts: {}, unreadable: true };
  }
  const table = parsed as Record<string, unknown>;
  if (v.safeParse(SpinShortcutsFileSchema, table).success) {
    const shortcuts: Record<string, string[]> = {};
    for (const [name, value] of Object.entries(table)) {
      shortcuts[name] = (value as string).split(/\s+/).filter(Boolean);
    }
    return { shortcuts, unreadable: false };
  }
  const shortcuts: Record<string, string[]> = {};
  for (const [name, value] of Object.entries(table)) {
    if (typeof value !== "string") continue;
    shortcuts[name] = value.split(/\s+/).filter(Boolean);
  }
  return { shortcuts, unreadable: true };
}
