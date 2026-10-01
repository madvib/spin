/**
 * Disk discovery for user themes.
 *
 * The studio does not carry themes; it finds the ones a project has on disk.
 * That is the whole reason the docs site and the studio are separate: the
 * studio is pointed at a project, and the project's themes are what it edits.
 *
 * The list is read at request time rather than bundled, because a theme editor
 * that only knows about the themes present at build time cannot see a theme
 * added while it is running.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** Where project themes live, relative to the workspace root. */
export const THEMES_DIR = "apps/docs/themes";

/** A theme found on disk, named by its file stem. */
export interface DiscoveredTheme {
  name: string;
  file: string;
  text: string;
}

/**
 * Every `.json` theme in the themes directory, keyed by file stem.
 *
 * A file that is not valid JSON is still returned — the studio's job is to show
 * an author what is wrong with it, and a theme it refuses to load is a theme
 * it cannot help fix.
 */
export async function discoverThemes(): Promise<DiscoveredTheme[]> {
  let entries: string[];
  try {
    entries = await readdir(THEMES_DIR);
  } catch {
    // A project with no themes yet is a normal state, not an error.
    return [];
  }

  const themes: DiscoveredTheme[] = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".json")) continue;
    const file = join(THEMES_DIR, entry);
    const text = await readFile(file, "utf8");
    themes.push({ name: entry.replace(/\.json$/, ""), file, text });
  }
  return themes;
}

/** Reads one theme by name, or undefined when it is no longer on disk. */
export async function readTheme(name: string): Promise<string | undefined> {
  // The name comes from a picker, so it is constrained to a bare stem before it
  // reaches the filesystem: a name with a separator could read outside the
  // themes directory.
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(name)) return undefined;
  try {
    return await readFile(join(THEMES_DIR, `${name}.json`), "utf8");
  } catch {
    return undefined;
  }
}
