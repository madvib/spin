/**
 * The classes the preset produces that the catalog does not name.
 *
 * The catalog describes spin's own rules. The preset also layers wind4
 * underneath them, and wind4 answers for the utilities spin does not own —
 * `truncate`, `bg-transparent`, an arbitrary `w-[16rem]`. Those classes
 * generate CSS, so the closed-vocabulary rule must not call them unknown.
 *
 * The answer comes from the generator itself: the same resolver the daemon
 * and the editor ask, so a rule's answer and the editor's answer cannot
 * disagree. It is asynchronous and a linter's visitor is not, so it is
 * asked once — before the first file is linted — about the classes the
 * project's own markup contains.
 *
 * Nothing here can fail the lint: a generator that cannot be built, a tree
 * that cannot be walked, a class that cannot be read — each one leaves the
 * answer empty, and the vocabulary falls back to the catalog.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { starterThemes } from "@spin/theme/themes";

/** The directories a scan does not walk into. */
const SKIPPED = new Set([
  ".git",
  ".deno",
  ".output",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
]);

/** The files a scan reads. */
const SOURCE = /\.(?:tsx?|jsx?|mjs|cjs|vue|svelte|astro|html?)$/;

/**
 * The classes a file's markup declares.
 *
 * Only the string class attributes: those are the ones the rules read, so
 * those are the ones the vocabulary has to know about.
 */
const CLASS_ATTRIBUTE = /(?:class|className)\s*=\s*["']([^"']*)["']/g;

/**
 * Every class the project's markup declares.
 *
 * The whole tree under the tool's root, because the tool's root is the
 * project the lint runs in.
 */
function declaredClasses(root: string): Set<string> {
  const out = new Set<string>();
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let entries: { name: string; isDirectory(): boolean }[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED.has(entry.name)) stack.push(path);
        continue;
      }
      if (!SOURCE.test(entry.name)) continue;
      let text: string;
      try {
        text = readFileSync(path, "utf8") as string;
      } catch {
        continue;
      }
      for (const match of text.matchAll(CLASS_ATTRIBUTE)) {
        for (const cls of (match[1] as string).split(/\s+/)) {
          if (cls.length > 0) out.add(cls);
        }
      }
    }
  }
  return out;
}

/** The classes the preset generates, asked of the generator. */
async function resolve(): Promise<ReadonlySet<string>> {
  try {
    const candidates = declaredClasses(process.cwd());
    if (candidates.size === 0) return new Set<string>();
    const { createGenerator } = await import("@unocss/core");
    const { spinPreset } = await import("@spin/preset");
    const generator = await createGenerator({
      presets: [
        spinPreset({ themes: { ...starterThemes } }),
      ],
    });
    const { matched } = await generator.generate(candidates);
    return matched;
  } catch {
    // The vocabulary is the catalog's alone; the rules abstain rather than
    // guess, and a generator that cannot be built is not a reason to stop.
    return new Set<string>();
  }
}

/** The classes the preset produces beyond the catalog. */
export const generatedClasses: ReadonlySet<string> = await resolve();
