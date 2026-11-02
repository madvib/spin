/**
 * The project's saved icons: the library it keeps.
 *
 * A saved icon is a name, the markup that draws it, and where it came from.
 * The attribution is recordable but optional — an icon the project drew
 * itself has no collection behind it — and it is kept in the same document
 * as the markup, so an icon is one file and an icon that lost its
 * attribution still draws.
 *
 * The files live in the project's own directory, under a name of their own:
 * `spin/icons/<name>.json`. The themes live beside them, not inside them,
 * so the two listings cannot mistake one for the other.
 *
 * This module is the only one that touches these files. A package that is
 * not this one asks it where a project's icons live and what one holds;
 * it does not reach for a disk of its own.
 */

import { ICONS_DIR, PROJECT_DIR } from "./facts.ts";
import { CONFIG_FILES } from "./facts.ts";
import { configurationIn } from "./configuration.ts";
import type {
  IconAttribution,
  ProjectIcon,
  SavedIcon,
  WriteResult,
} from "./types.ts";

/**
 * A name that is a file stem, and nothing else.
 *
 * The same shape a theme's name takes: the stem of a file in the project's
 * own directory. A name that is not one is refused rather than tidied —
 * a tidied name would file the icon under a name its author did not choose,
 * and the library would hold something nobody asked for.
 */
const NAME = /^[a-z0-9][a-z0-9-]*$/i;

/** The directory one project's icons live in. */
async function dirOf(root: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { resolveProjectDir } = await import("./resolve-dir.ts");
  let themesDir = PROJECT_DIR;
  const file = CONFIG_FILES.find((name) => existsSync(join(root, name)));
  if (file !== undefined) {
    try {
      const text = await readFile(join(root, file), "utf8");
      themesDir = configurationIn(text, file).themesDir || PROJECT_DIR;
    } catch {
      // Fall back to the default themes directory.
    }
  }
  // Icons are always the project's own, beside its local themes tree —
  // or beside the default directory when the configured value names a
  // single file rather than a directory.
  const resolved = await resolveProjectDir(root, themesDir, "themes");
  return resolved.file
    ? join(root, PROJECT_DIR, ICONS_DIR)
    : join(resolved.path, ICONS_DIR);
}

/** The file one icon is written to. */
async function fileOf(root: string, name: string): Promise<string> {
  const { join } = await import("node:path");
  return join(await dirOf(root), `${name}.json`);
}

/** The document an icon is written as. */
function documentFor(icon: SavedIcon): string {
  return JSON.stringify(
    {
      markup: icon.markup,
      attribution: {
        collection: icon.attribution.collection,
        author: icon.attribution.author,
        license: icon.attribution.license,
      },
    },
    null,
    2,
  ) + "\n";
}

/** A stated string, or none. */
function said(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** The attribution a document carries, whatever it leaves out. */
function attributionIn(value: unknown): IconAttribution {
  const record = typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};
  return {
    collection: said(record["collection"]),
    author: said(record["author"]),
    license: said(record["license"]),
  };
}

/**
 * One icon, as the document it is written as.
 *
 * `null` for a file that is not an icon document: a file in the library's
 * drawer that carries no markup is not an icon, and the library answers
 * with the icons it holds rather than with the files it found.
 */
function iconIn(text: string, name: string): ProjectIcon | null {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof document !== "object" || document === null) return null;
  const record = document as Record<string, unknown>;
  const markup = record["markup"];
  if (typeof markup !== "string" || markup === "") return null;
  return {
    name,
    markup,
    attribution: attributionIn(record["attribution"]),
  };
}

/**
 * The icons a project holds, by name.
 *
 * The project's own files only: there is no shipped set of icons and no
 * starter to fork, because a library is a choice a project makes and
 * nobody else's icons are the project's until it saves them.
 */
export async function listIcons(root: string): Promise<ProjectIcon[]> {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const dir = await dirOf(root);
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    entries = [];
  }
  const icons: ProjectIcon[] = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".json")) continue;
    const name = entry.replace(/\.json$/, "");
    let text: string;
    try {
      text = await readFile(join(dir, entry), "utf8");
    } catch {
      // A file that went away between the listing and the read is not an
      // icon the project holds.
      continue;
    }
    const icon = iconIn(text, name);
    if (icon !== null) icons.push(icon);
  }
  return icons;
}

/**
 * One icon, as the project holds it.
 *
 * `null` for an icon the project does not hold, and for a file in the
 * library's drawer that is not an icon: the two are the same answer to the
 * question the caller asked, which is whether there is an icon here.
 */
export async function readIcon(
  root: string,
  name: string,
): Promise<{ readonly icon: ProjectIcon | null }> {
  if (!NAME.test(name)) return { icon: null };
  const { readFile } = await import("node:fs/promises");
  try {
    const text = await readFile(await fileOf(root, name), "utf8");
    return { icon: iconIn(text, name) };
  } catch {
    return { icon: null };
  }
}

/**
 * Saves one icon into the project's library.
 *
 * The library's drawer is created rather than demanded: a project that has
 * never saved an icon has no drawer, and the first save is the one that
 * makes it. A save over an icon of the same name replaces it — the name is
 * the author's, and the author is the one saving over it.
 */
export async function writeIcon(
  root: string,
  name: string,
  icon: SavedIcon,
): Promise<WriteResult> {
  if (!NAME.test(name)) {
    return {
      error:
        `“${name}” is not an icon name: a name is letters, digits and dashes`,
    };
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    const dir = await dirOf(root);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${name}.json`), documentFor(icon), "utf8");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Removes one icon from the project's library. */
export async function removeIcon(
  root: string,
  name: string,
): Promise<WriteResult> {
  if (!NAME.test(name)) {
    return {
      error:
        `“${name}” is not an icon name: a name is letters, digits and dashes`,
    };
  }
  const { rm } = await import("node:fs/promises");
  try {
    await rm(await fileOf(root, name));
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
