/**
 * The dist's module graph — what imports what, and what is reachable.
 *
 * The build prunes the dist with it, and the check verifies the dist with
 * it: one reading of what a file imports, so the two cannot disagree about
 * which files the package needs.
 */

import { dirname, join, relative, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";

/** The import specifiers of a file, with the text around them. */
const SPECIFIER = /\b(?:from|import)\s*\(?\s*(["'])([^"']+)\1/g;

/**
 * The specifiers a file imports.
 *
 * Every import statement in the file, wherever it sits. Bun's build keeps
 * the modules separate (one entry per module, imports external), so an
 * import may follow a banner comment or a helper the emitter wrote above
 * it — stopping at the first non-import statement would miss those. A
 * string inside the code is still not mistaken for a dependency: only
 * `import`/`export ... from` statements are read.
 */
export function importSpecifiers(text: string): string[] {
  const found: string[] = [];
  let statement = "";
  // Inside a template literal the emitter wrote, an `import ... from`
  // line is generated content (a script tag, a config scaffold), not a
  // dependency. Backtick counting is approximate, but a missed toggle
  // only risks a skipped import, never a false one.
  let templateDepth = 0;
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
      // A statement that is not an import or re-export ends any
      // multi-line import being read, and is otherwise skipped: imports
      // may follow code the emitter wrote above them.
      if (!/^(import|export)\b/.test(trimmed)) {
        statement = "";
        templateDepth += (line.match(/`/g) ?? []).length;
        continue;
      }
    }
    statement += trimmed + "\n";
    if (!trimmed.endsWith(";")) continue;
    // A statement completed inside a template literal is content, not
    // an import — but only when the literal opened before it.
    if (templateDepth % 2 === 1) {
      statement = "";
      continue;
    }
    for (const match of statement.matchAll(SPECIFIER)) found.push(match[2]);
    statement = "";
  }
  // Lazy loaders resolve at runtime: dynamic `import("x")`, `require("x")`,
  // and `require.resolve("x")` are dependencies the static scan above
  // never sees. Comments excluded,
  // template content included — a scaffold that names a package still needs
  // it installed where the scaffold runs... no: emitted content is the
  // consumer's concern, not the dist's. Only real calls count, so strip
  // template literals first.
  const bare = text.replace(/`(?:[^`\\]|\\.)*`/g, '""');
  for (const line of bare.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    for (
      const match of trimmed.matchAll(/\b(?:import|require(?:\.resolve)?)\(\s*(["'])([^"']+)\1/g)
    ) {
      found.push(match[2]);
    }
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
    for (const specifier of importSpecifiers(await readFile(path, "utf8"))) {
      if (!specifier.startsWith(".")) continue;
      const next = relative(dist, resolve(dirname(path), specifier));
      if (await exists(join(dist, next))) queue.push(next);
    }
  }
  return reachable;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
