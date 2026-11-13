/**
 * The shortcuts a project declares, asked of the project.
 *
 * A project's compositions live in `shortcuts.json` beside its brands: one
 * table of names to class lists, read as JSON. The build compiles the same
 * table, so a class the project declared is a class the project produces —
 * and the closed vocabulary knows it from the same file.
 *
 * A table the reader cannot parse declares shortcuts the lint cannot read,
 * and the lint says so rather than guessing. A vocabulary it could not
 * read is one it must not enforce: the alternative is flagging every class
 * the project declared as unknown, which is the one thing the
 * closed-vocabulary rule must never do. Only that rule stands down — the
 * rest of the vocabulary is still worth enforcing.
 */

import { findConfigRoot, readProjectShortcutsFile } from "@spinjs/server/project";
import type { ShortcutDeclaration } from "@spinjs/server/project";

export type { ShortcutDeclaration };
export { findConfigRoot };

/** A project that declares no shortcuts. */
export function noShortcuts(): ShortcutDeclaration {
  return { shortcuts: {}, unreadable: false };
}

/**
 * The shortcuts a project's themes directory declares.
 *
 * A table that cannot be read declares nothing the lint can hold the
 * project to: the declaration is reported as unreadable rather than
 * guessed at.
 */
export function readProjectShortcuts(
  themesRoot: string | undefined,
): ShortcutDeclaration {
  if (themesRoot === undefined) return noShortcuts();
  return readProjectShortcutsFile(themesRoot);
}
