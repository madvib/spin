import { expandGlob } from "@std/fs";

/**
 * The reference app's Uno config, expressed as data.
 *
 * `@unocss/vite` owns this shape today; `spin()` reads it, so the content
 * pipeline moves with the plugin and the app's utilities keep matching.
 */
export interface ContentOptions {
  /**
   * File globs to scan. Relative globs resolve against `root`; absolute ones
   * are used as given. Brace groups (`{tsx,ts}`) expand to one glob each.
   */
  readonly filesystem?: readonly string[];
  /**
   * Which file types the pipeline will extract from. A file whose path
   * matches no pattern is scanned as text — which is how `.examples.ts`
   * reaches the generator in a spin app.
   */
  readonly pipeline?: {
    readonly include?: readonly RegExp[];
  };
}

/** One file per class it declares, keyed by absolute path. */
export type ContentMap = Map<string, string>;

/**
 * `{a,b}` → `["a", "b"]`. Deliberately flat: a nested group is a glob we do
 * not emit, and expanding it wrongly is worse than not expanding it.
 */
export function expandBraces(pattern: string): string[] {
  const open = pattern.indexOf("{");
  if (open === -1) return [pattern];
  const close = pattern.indexOf("}", open);
  if (close === -1) return [pattern];
  const head = pattern.slice(0, open);
  const tail = pattern.slice(close + 1);
  const alternatives = pattern.slice(open + 1, close).split(",");
  const rest = expandBraces(tail);
  const expanded = alternatives.flatMap((alt) =>
    rest.map((suffix) => `${head}${alt}${suffix}`)
  );
  // The group removed, expand what surrounded it.
  return expanded.flatMap((value) => expandBraces(value));
}

/**
 * True when a path every include pattern ignores.
 *
 * The regexes are matched against the path as written, not the basename, so
 * a project whose sources live under `src/` behaves as unintuitively as
 * the pipeline it replaces would.
 */
export function isIncluded(path: string, include: readonly RegExp[]): boolean {
  if (include.length === 0) return true;
  return include.some((pattern) => pattern.test(path));
}

/**
 * Read every file the globs admit, keyed by path.
 *
 * A file that cannot be read is skipped rather than thrown on: the
 * reference app's globs are curated, but a glob in a user's config is not,
 * and one unreadable node_modules path should not fail a stylesheet.
 */
export async function scanContent(
  options: ContentOptions,
  root: string,
): Promise<ContentMap> {
  const include = options.pipeline?.include ?? [];
  const files: ContentMap = new Map();
  for (const pattern of options.filesystem ?? []) {
    const absolute = /^([a-z]:)?\//i.test(pattern) ? pattern : `${root}/${pattern}`;
    for (const glob of expandBraces(absolute)) {
      try {
        for await (const entry of expandGlob(glob)) {
          if (!entry.isFile) continue;
          if (!isIncluded(entry.path, include)) continue;
          if (files.has(entry.path)) continue;
          files.set(entry.path, await Deno.readTextFile(entry.path));
        }
      } catch {
        // A pattern that matches nothing, or a directory that is not
        // readable, is not a failure of the scan.
      }
    }
  }
  return files;
}

/**
 * The scan as one string, in the order the glob walk produced it.
 *
 * The order is load-bearing, not incidental: Uno emits a rule where it first
 * met the class, so the walk's order is the sheet's order, and the sheet's
 * order is what decides which of two conflicting utilities on one element
 * wins. Sorting the paths would produce a deterministic sheet that resolves
 * those conflicts differently than this project's app does today, which is
 * a silent visual change for the sake of a nicer key.
 */
export function joinContent(files: ContentMap): string {
  return [...files.keys()].map((path) => files.get(path)!).join("\n");
}
