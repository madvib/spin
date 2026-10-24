/**
 * The shortcuts a project declares, asked of the project.
 *
 * A project's build configuration is a MODULE: it imports its bundler, its
 * plugins and its icon catalogues — none of which a linter can load, and a
 * linter that tried would run a build to answer a question about a class
 * name. So the declaration is read as TEXT, by the project — which owns the
 * file the declaration is written in, and reads it there.
 *
 * The shape read is Uno's own: a `shortcuts` property whose value is an
 * object literal of `name: "utility utility"`.
 *
 * A configuration that spells it another way — a table imported from
 * elsewhere, say — declares shortcuts the lint cannot read, and the lint
 * says so rather than guessing. A vocabulary it could not read is one it
 * must not enforce: the alternative is flagging every class the project
 * declared as unknown, which is the one thing the closed-vocabulary rule
 * must never do. Only that rule stands down — the rest of the vocabulary
 * is still worth enforcing.
 */

import { findConfigRoot, readShortcuts } from "../project/sync.ts";
import type { ShortcutDeclaration } from "../project/index.ts";

export type { ShortcutDeclaration };
export { findConfigRoot };

/** A project that declares no shortcuts. */
export function noShortcuts(): ShortcutDeclaration {
  return { shortcuts: {}, unreadable: false };
}

/**
 * The shortcuts a project's configuration declares.
 *
 * A configuration that cannot be read declares nothing the lint can hold it
 * to: the declaration is reported as unreadable rather than guessed at.
 */
export function readProjectShortcuts(
  root: string | undefined,
): ShortcutDeclaration {
  if (root === undefined) return noShortcuts();
  return readShortcuts(root);
}
