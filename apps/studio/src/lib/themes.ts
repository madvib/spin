/**
 * The theme registry the studio edits.
 *
 * Themes are not bundled and they are not the studio's own: they are the
 * project's, found on disk. The studio is a tool pointed at a project, so the
 * list comes from the filesystem at request time — a theme added while the
 * studio is running has to be visible without a rebuild.
 *
 * The chrome is deliberately not in this list. It is styled by the studio's own
 * static theme so that editing a theme cannot restyle the tool you are editing
 * it with.
 */

import { spinClient } from "./client.ts";

/** A theme the studio found, with the state the editor needs to show it. */
export interface StudioTheme {
  /** File stem, and the name written back to disk. */
  name: string;
  /** The raw JSON text, which is what an author edits. */
  text: string;
  /** Path relative to the workspace, shown so the author knows what they are editing. */
  file: string;
}

/**
 * Every theme in the project's themes directory.
 *
 * Server-side: this reads the filesystem, which the browser cannot do. The
 * result is serialised to the client, which is where the editing state lives.
 */
export async function listProjectThemes(): Promise<StudioTheme[]> {
  "use server";
  const listed = await (await spinClient()).project.themes.list({});
  return listed.map((theme) => ({
    name: theme.name,
    text: theme.text,
    file: theme.file,
  }));
}

/**
 * Write one theme to disk. The studio's save is explicit: nothing persists
 * until the author says so, and this is the only call that changes disk.
 */
export async function saveTheme(
  name: string,
  text: string,
): Promise<{ error: string | null }> {
  "use server";
  const written = await (await spinClient()).project.themes.write({
    name,
    text,
  });
  return { error: written.error ?? null };
}

/** Re-reads one theme from disk, discarding unsaved edits to it. */
export async function loadProjectTheme(
  name: string,
): Promise<string | undefined> {
  "use server";
  const read = await (await spinClient()).project.themes.read({ name });
  return read.text ?? undefined;
}
