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
import { type ShortcutDeclaration, shortcutsIn } from "./configuration.ts";
import { CONFIG_FILES, PROJECT_DIR } from "./facts.ts";

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
 * project has no root, and the vocabulary falls back to the starters.
 */
export function findProjectRoot(from: string): string | undefined {
  return findProjectRootIn(dirname(from));
}

/**
 * The project root a directory belongs to, if there is one.
 *
 * The directory itself counts: the tool's root is a project when it holds a
 * `spin/` directory, and the ancestors above it are tried in turn.
 */
export function findProjectRootIn(directory: string): string | undefined {
  let dir = directory;
  for (;;) {
    if (isDirectory(join(dir, PROJECT_DIR))) return dir;
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
 * The project's own themes, by name: the text of each file in `spin/`.
 *
 * The shipped starters are not here: a project inherits them rather than
 * restating them, and the set they come from is the theme package's. A file
 * that cannot be read is skipped rather than thrown on — a half written
 * theme in an editor must not cost the reader the themes the project has.
 */
export function themeTextsIn(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  let names: string[];
  try {
    names = readdirSync(join(root, PROJECT_DIR)).filter((name) =>
      name.endsWith(".json")
    );
  } catch {
    return out;
  }
  for (const name of names) {
    try {
      out[name.slice(0, -".json".length)] = readFileSync(
        join(root, PROJECT_DIR, name),
        "utf8",
      );
    } catch {
      // Skipped: see above.
    }
  }
  return out;
}

/**
 * The shortcuts a project's configuration declares.
 *
 * The configuration is a MODULE: it imports its bundler, its plugins and its
 * icon catalogues — none of which a reader can load, and a reader that tried
 * would run a build to answer a question about a class name. So the
 * declaration is read as text.
 *
 * A declaration this cannot read is reported as unreadable rather than
 * guessed at: a vocabulary it could not read is one it must not enforce.
 */
export function readShortcuts(root: string): ShortcutDeclaration {
  const file = CONFIG_FILES.find((name) => existsSync(join(root, name)));
  if (file === undefined) return { shortcuts: {}, unreadable: false };
  let text: string;
  try {
    text = readFileSync(join(root, file), "utf8");
  } catch {
    return { shortcuts: {}, unreadable: true };
  }
  return shortcutsIn(text);
}
