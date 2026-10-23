/**
 * The dist's module graph — what imports what, and what is reachable.
 *
 * The build prunes the dist with it, and the check verifies the dist with
 * it: one reading of what a file imports, so the two cannot disagree about
 * which files the package needs.
 */

import { dirname, join, relative, resolve } from "node:path";

/** The import specifiers of a file, with the text around them. */
const SPECIFIER = /\b(?:from|import)\s*\(?\s*(["'])([^"']+)\1/g;

/**
 * The specifiers a file imports.
 *
 * The imports are the statements at the top of the file — what the bundler
 * or the compiler wrote — and the code follows. The scan stops at the first
 * statement that is not an import, so a string inside the code (a script the
 * plugin injects, a config a module generates) is not mistaken for a
 * dependency.
 */
export function importSpecifiers(text: string): string[] {
  const found: string[] = [];
  let statement = "";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (statement === "") {
      if (trimmed === "") continue;
      if (
        trimmed.startsWith("//") || trimmed.startsWith("/*") ||
        trimmed.startsWith("*") || trimmed.startsWith("*/")
      ) {
        continue;
      }
      if (!/^(import|export)\b/.test(trimmed)) break;
    }
    statement += trimmed + "\n";
    if (!trimmed.endsWith(";")) continue;
    for (const match of statement.matchAll(SPECIFIER)) found.push(match[2]);
    statement = "";
  }
  return found;
}

/** Whether a file is a module — the things that import and are imported. */
export function isModule(file: string): boolean {
  return file.endsWith(".js") || file.endsWith(".d.ts");
}

/**
 * The files a set of entry points reaches.
 *
 * A declaration and the module beside it are one file's worth of contract:
 * whichever is reached, the other ships with it. The declarations import
 * too — a type-only import is a dependency the package has, and the file
 * behind it ships with it.
 */
export async function reachableFiles(
  dist: string,
  entries: readonly string[],
): Promise<Set<string>> {
  const reachable = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (reachable.has(file)) continue;
    reachable.add(file);
    const path = `${dist}/${file}`;
    const companion = file.endsWith(".d.ts")
      ? file.slice(0, -5) + ".js"
      : file.replace(/\.js$/, ".d.ts");
    if (await exists(`${dist}/${companion}`)) queue.push(companion);
    if (!isModule(file)) continue;
    for (const specifier of importSpecifiers(await Deno.readTextFile(path))) {
      if (!specifier.startsWith(".")) continue;
      const next = relative(dist, resolve(dirname(path), specifier));
      if (await exists(join(dist, next))) queue.push(next);
    }
  }
  return reachable;
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}
