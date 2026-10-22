/**
 * The project's operations: every answer a project root can give.
 *
 * Every operation takes the root it is about. There is no global here, and no
 * bound root: a process that serves many projects resolves the root per call,
 * and an operation never reads one that was not named.
 *
 * The filesystem is reached through dynamic imports. The daemon's client is
 * bundled for the browser, and a `node:` import at the top of this module
 * would follow it into a bundle that must never touch a disk.
 */

import { configurationIn } from "./configuration.ts";
import {
  CONFIG_FILENAME,
  CONFIG_FILES,
  initFiles,
  isWired,
  PROJECT_DIR,
} from "./facts.ts";
import { listIcons, readIcon, removeIcon, writeIcon } from "./icons.ts";
import type {
  InitProjectOptions,
  ProjectConfiguration,
  ProjectReport,
  ProjectTheme,
  WriteResult,
} from "./types.ts";

/** The uno configs — the ones where the preset is wired. */
const UNO_CONFIGS: readonly string[] = [
  "uno.config.ts",
  "uno.config.js",
  "uno.config.mjs",
];

/**
 * The shipped starters by name.
 *
 * Canonical JSON, not the package's file bytes: a theme is a document, and
 * this is the text the system writes for one. A project inherits the
 * starters rather than restating them, so an unforked theme lists as text
 * from here and a read falls back to it.
 */
async function shippedThemes(): Promise<Record<string, unknown>> {
  const { starterThemes } = await import("@spin/theme/themes");
  return starterThemes as Record<string, unknown>;
}

/** A theme document as the text written for it. */
function themeJson(document: unknown): string {
  return JSON.stringify(document, null, 2) + "\n";
}

/** Whether a path is there. */
async function exists(path: string): Promise<boolean> {
  const { access } = await import("node:fs/promises");
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * What a root holds: the project's report.
 *
 * One walk, because `detect` and `current` differ only in which root they
 * examine, and a second copy of this walk would be a second place for the
 * notions of "has spin", "has uno", "is wired" to drift.
 *
 * The uno config is where the preset is wired, so it answers the other half
 * of "is this a spin project" without being the mark of one: a project can
 * hold themes it has not wired up yet.
 */
export async function detectProject(root: string): Promise<ProjectReport> {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { existsSync } = await import("node:fs");
  const here = join(root, PROJECT_DIR);
  const hasSpin = existsSync(here);
  let themes: string[] = [];
  if (hasSpin) {
    try {
      themes = (await readdir(here)).filter((e) => e.endsWith(".json"))
        .sort();
    } catch {
      themes = [];
    }
  }
  const unoName = UNO_CONFIGS.find((name) => existsSync(join(root, name)));
  let wired = false;
  if (unoName !== undefined) {
    try {
      const text = await readFile(join(root, unoName), "utf8");
      wired = isWired(text);
    } catch {
      wired = false;
    }
  }
  return {
    root,
    spin: hasSpin,
    uno: unoName !== undefined,
    wired,
    themes,
  };
}

/**
 * The project a host serves.
 *
 * The same report {@link detectProject} gives: the difference is the root,
 * not the question. A host that serves one project asks about the root it
 * holds; a client that names a root asks about that one. One walk, so the
 * two cannot drift.
 */
export const currentProject = detectProject;

/**
 * Makes a project: the themes directory, a first theme, and the build
 * configuration that wires spin in.
 *
 * The composer, and it composes what each piece knows how to write: the
 * theme package makes a theme, the preset makes a config, and the project
 * decides where each of them lands.
 */
export async function initProject(
  options: InitProjectOptions,
): Promise<WriteResult> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    const dir = join(options.root, PROJECT_DIR);
    await mkdir(dir, { recursive: true });
    for (
      const [file, text] of Object.entries(
        initFiles({ name: options.name, starter: options.starter }),
      )
    ) {
      await writeFile(
        file === CONFIG_FILENAME ? join(options.root, file) : join(dir, file),
        text,
        "utf8",
      );
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * The Uno options a project's build configuration declares.
 *
 * The project that has no configuration declares none: an empty declaration
 * is an answer, not a failure.
 */
export async function readConfiguration(
  root: string,
): Promise<ProjectConfiguration> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { existsSync } = await import("node:fs");
  const file = CONFIG_FILES.find((name) => existsSync(join(root, name)));
  if (file === undefined) {
    return {
      file: null,
      shortcuts: {},
      content: [],
      mount: null,
      unreadable: false,
    };
  }
  let text: string;
  try {
    text = await readFile(join(root, file), "utf8");
  } catch {
    return {
      file,
      shortcuts: {},
      content: [],
      mount: null,
      unreadable: true,
    };
  }
  return configurationIn(text, file);
}

/**
 * The themes a project holds: its own files, and the starters it has not
 * forked.
 *
 * The starters a project has not forked sit beside its own files: the same
 * base the build serves, so a studio lists what an app renders. A fork
 * replaces its entry rather than joining it.
 */
export async function listThemes(root: string): Promise<ProjectTheme[]> {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  let entries: string[] = [];
  try {
    entries = await readdir(join(root, PROJECT_DIR));
  } catch {
    entries = [];
  }
  const themes: ProjectTheme[] = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".json")) continue;
    themes.push({
      name: entry.replace(/\.json$/, ""),
      text: await readFile(join(root, PROJECT_DIR, entry), "utf8"),
      // Project-relative, so a path a developer sees never carries the
      // machine's filesystem layout: a screenshot, a log line, an issue
      // report. The daemon knows the root; the contract does not leak it.
      file: join(PROJECT_DIR, entry),
    });
  }
  const forked = new Set(themes.map((theme) => theme.name));
  for (const [name, document] of Object.entries(await shippedThemes())) {
    if (forked.has(name)) continue;
    themes.push({ name, text: themeJson(document), file: null });
  }
  return themes.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}

/**
 * One theme, as the text it is written as.
 *
 * The project's own file first, then the shipped set: a project inherits the
 * starters rather than restating them, so a theme it has not forked still
 * reads.
 */
export async function readTheme(
  root: string,
  name: string,
): Promise<{ readonly text: string | null }> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    return {
      text: await readFile(
        join(root, PROJECT_DIR, `${name}.json`),
        "utf8",
      ),
    };
  } catch {
    const document = (await shippedThemes())[name];
    return { text: document === undefined ? null : themeJson(document) };
  }
}

/**
 * Writes one theme file.
 *
 * A write is also the first write for a project that has never held a theme:
 * the themes directory is created rather than demanded. The alternative
 * shipped for a while — an ENOENT in a dialog on a fresh checkout — was the
 * directory's absence surfacing as the writer's failure.
 */
export async function writeTheme(
  root: string,
  name: string,
  text: string,
): Promise<WriteResult> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    const dir = join(root, PROJECT_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${name}.json`), text, "utf8");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Removes one theme file. */
export async function removeTheme(
  root: string,
  name: string,
): Promise<WriteResult> {
  const { rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    await rm(join(root, PROJECT_DIR, `${name}.json`));
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Copies one theme to a new name.
 *
 * The copy is the text, so a fork copies byte for byte. A source the project
 * has not forked is a shipped starter, and it answers for a name the project
 * never wrote.
 */
export async function copyTheme(
  root: string,
  from: string,
  to: string,
): Promise<WriteResult> {
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    const dir = join(root, PROJECT_DIR);
    const source = join(dir, `${from}.json`);
    // Read first so a missing source is an error, not an empty file.
    let text: string;
    try {
      text = await readFile(source, "utf8");
    } catch {
      const document = (await shippedThemes())[from];
      if (document === undefined) {
        throw new Error(`no theme named ${from}`);
      }
      text = themeJson(document);
    }
    await mkdir(dir, { recursive: true });
    // A copy never overwrites: the name is the author's, and a theme that
    // exists holds work someone saved. Writing over it would destroy that
    // work with no warning and no undo, so a taken name is an error the
    // studio can show.
    const target = join(dir, `${to}.json`);
    if (await exists(target)) {
      return { error: `a theme named ${to} already exists` };
    }
    await writeFile(target, text, "utf8");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * The project's operations, as one surface.
 *
 * The api's procedures call these; a host that talks to a project directly
 * calls the same ones.
 */
export const projectService = {
  detect: detectProject,
  current: currentProject,
  init: initProject,
  configuration: readConfiguration,
  themes: {
    list: listThemes,
    read: readTheme,
    write: writeTheme,
    remove: removeTheme,
    copy: copyTheme,
  },
  icons: {
    list: listIcons,
    read: readIcon,
    write: writeIcon,
    remove: removeIcon,
  },
};
