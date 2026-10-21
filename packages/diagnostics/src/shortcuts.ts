/**
 * The shortcuts a project declares, read from its build configuration.
 *
 * A project's build configuration is a MODULE: it imports its bundler, its
 * plugins and its icon catalogues — none of which a linter can load, and a
 * linter that tried would run a build to answer a question about a class
 * name. So the declaration is read as TEXT, the way the daemon reads a
 * configuration to know whether it is wired (`packages/api/src/project-procedures.ts`).
 *
 * The shape read is Uno's own: a `shortcuts` property whose value is an
 * object literal of `name: "utility utility"`. The plugin takes the same
 * shape as an object, so the two read one declaration.
 *
 * A configuration that spells it another way — a table imported from
 * elsewhere, say — declares shortcuts the lint cannot read, and the lint
 * says so rather than guessing. A vocabulary it could not read is one it
 * must not enforce: the alternative is flagging every class the project
 * declared as unknown, which is the one thing the closed-vocabulary rule
 * must never do. Only that rule stands down — the rest of the vocabulary
 * is still worth enforcing.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The configuration files a project may keep its build in.
 *
 * The daemon knows `uno.config.ts` as the file where the preset is wired;
 * a project that builds with vite keeps the same wiring in `vite.config.ts`.
 * Both are read, because both carry the same declaration.
 */
export const CONFIG_FILES: readonly string[] = [
  "uno.config.ts",
  "uno.config.js",
  "uno.config.mjs",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "spin.config.ts",
  "spin.config.js",
  "spin.config.mjs",
];

/**
 * What a project's configuration declares.
 *
 * `unreadable` is the answer "there are shortcuts here and I could not read
 * them". It is not the same as "there are no shortcuts": one is a project
 * that composes nothing, the other is a vocabulary the lint cannot see.
 */
export interface ShortcutDeclaration {
  /** Each shortcut's name, and the classes it expands to. */
  readonly shortcuts: ReadonlyMap<string, readonly string[]>;
  /** Whether a declaration was found that could not be read. */
  readonly unreadable: boolean;
}

/** A project that declares no shortcuts. */
export function noShortcuts(): ShortcutDeclaration {
  return { shortcuts: new Map(), unreadable: false };
}

/** Whether a path is a file. */
function exists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

/**
 * The root a file's build configuration lives at.
 *
 * The nearest ancestor holding one, the way a project's root is the nearest
 * ancestor holding a `spin/` directory. A file outside every project has no
 * configuration, and so declares no shortcuts.
 */
export function findConfigRoot(filename: string): string | undefined {
  let dir = dirname(filename);
  for (;;) {
    for (const name of CONFIG_FILES) {
      if (exists(join(dir, name))) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * The shortcuts a project's configuration declares.
 *
 * A configuration that cannot be read declares nothing: the lint has no
 * vocabulary to add and no reason to stand down.
 */
export function readProjectShortcuts(
  root: string | undefined,
): ShortcutDeclaration {
  if (root === undefined) return noShortcuts();
  for (const name of CONFIG_FILES) {
    let text: string;
    try {
      text = readFileSync(join(root, name), "utf8") as string;
    } catch {
      continue;
    }
    return shortcutsIn(text);
  }
  return noShortcuts();
}

/**
 * The shortcuts a configuration's text declares.
 *
 * Every `shortcuts` property in the text is read: a project may compose
 * more than one table, and each is part of the vocabulary.
 */
export function shortcutsIn(text: string): ShortcutDeclaration {
  const source = withoutComments(text);
  const shortcuts = new Map<string, readonly string[]>();
  let unreadable = false;
  for (const match of source.matchAll(/(?:^|[^\w$.])shortcuts\s*:/g)) {
    const start = match.index + match[0].length;
    const literal = objectLiteralAt(source, start) ??
      literalFor(source, nameAt(source, start));
    if (literal === undefined) {
      // The property is there and its value is not an object literal: a table
      // from another module, a computed value. The names are unknowable here.
      unreadable = true;
      continue;
    }
    for (const entry of parseEntries(literal)) {
      shortcuts.set(entry.name, entry.classes);
    }
  }
  return { shortcuts, unreadable };
}

/**
 * The name a property's value is, when the value is a name.
 *
 * `shortcuts: studioShortcuts` points at a table; `shortcuts: { … }` is
 * the table. Only the second is a literal, so only the second can be read
 * without looking elsewhere.
 */
function nameAt(text: string, start: number): string {
  let i = start;
  while (i < text.length && /\s/.test(text[i] as string)) i += 1;
  const match = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
  return match === null ? "" : match[0];
}

/**
 * The object literal a name is declared as, in the same file.
 *
 * A configuration that keeps its table in a constant of its own is the
 * ordinary way to write one — the table is a dozen lines, and burying it
 * in the plugin's options helps nobody. So the name is followed to its
 * declaration: `const studioShortcuts = { … }`.
 *
 * A name declared in another module is not followed: reading it would mean
 * resolving imports, and a table the lint cannot see is a table it must
 * not guess at.
 */
function literalFor(text: string, name: string): string | undefined {
  if (name === "") return undefined;
  const pattern = new RegExp(
    `\\b(?:const|let|var)\\s+${name}\\s*(?::[^=]*?)?=\\s*`,
    "g",
  );
  const match = pattern.exec(text);
  if (match === null) return undefined;
  return objectLiteralAt(text, match.index + match[0].length);
}

/* ------------------------------------------------------------- the scanner -- */

/**
 * The text with its comments blanked out.
 *
 * The strings stay: a shortcut's value is a string, and the declaration is
 * found by the words around it.
 */
function withoutComments(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      out += "  ";
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        out += text[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      out += "  ";
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const end = stringEnd(text, i);
      out += text.slice(i, end);
      i = end;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** The index just past the string that starts at `start`. */
function stringEnd(text: string, start: number): number {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    i += 1;
    if (ch === quote) break;
  }
  return i;
}

/**
 * The object literal that starts at `start`, with its braces.
 *
 * `undefined` when the text there is not an object literal — which is how a
 * declaration the lint cannot read is told apart from one it can.
 */
function objectLiteralAt(text: string, start: number): string | undefined {
  let i = start;
  while (i < text.length && /\s/.test(text[i] as string)) i += 1;
  if (text[i] !== "{") return undefined;
  const open = i;
  let depth = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === '"' || ch === "'" || ch === "`") {
      i = stringEnd(text, i);
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(open, i + 1);
    }
    i += 1;
  }
  return undefined;
}

/** One shortcut: a name, and the classes it expands to. */
interface Entry {
  readonly name: string;
  readonly classes: readonly string[];
}

/**
 * The entries of an object literal.
 *
 * A name is a string or an identifier; a value is a string of utilities or
 * an array of them. A value that is neither — a function, a number — leaves
 * the entry out: a dynamic shortcut's expansion is not knowable here, and a
 * name with no expansion still knows its name.
 */
function parseEntries(literal: string): Entry[] {
  const out: Entry[] = [];
  let i = 1;
  while (i < literal.length) {
    const ch = literal[i] as string;
    if (ch === "}" || ch === ",") {
      i += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    const name = readName(literal, i);
    if (name === undefined) {
      i += 1;
      continue;
    }
    i = name.end;
    while (i < literal.length && /\s/.test(literal[i] as string)) i += 1;
    if (literal[i] !== ":") continue;
    i += 1;
    while (i < literal.length && /\s/.test(literal[i] as string)) i += 1;
    const value = readValue(literal, i);
    if (value === undefined) continue;
    i = value.end;
    out.push({ name: name.name, classes: value.classes });
  }
  return out;
}

/** A name in an object literal: a string or an identifier. */
function readName(
  text: string,
  start: number,
): { readonly name: string; readonly end: number } | undefined {
  const ch = text[start];
  if (ch === '"' || ch === "'") {
    const end = stringEnd(text, start);
    return { name: text.slice(start + 1, end - 1), end };
  }
  const match = /^[A-Za-z_$][\w$-]*/.exec(text.slice(start));
  if (match === null) return undefined;
  return { name: match[0], end: start + match[0].length };
}

/**
 * A value in an object literal: a string of utilities, or an array of them.
 */
function readValue(
  text: string,
  start: number,
): { readonly classes: readonly string[]; readonly end: number } | undefined {
  const ch = text[start];
  if (ch === '"' || ch === "'") {
    const end = stringEnd(text, start);
    const body = text.slice(start + 1, end - 1);
    return { classes: body.split(/\s+/).filter(Boolean), end };
  }
  if (ch === "[") {
    const close = text.indexOf("]", start);
    if (close === -1) return undefined;
    const body = text.slice(start + 1, close);
    const classes: string[] = [];
    for (const match of body.matchAll(/["']([^"']*)["']/g)) {
      classes.push(...(match[1] as string).split(/\s+/).filter(Boolean));
    }
    return { classes, end: close + 1 };
  }
  return undefined;
}
