import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

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
   * matches no pattern is not scanned — which is how `.examples.ts` reaches
   * the generator in a spin app.
   */
  readonly pipeline?: {
    readonly include?: readonly RegExp[];
    /** Paths matching here are never scanned, even when included above. */
    readonly exclude?: readonly RegExp[];
  };
}

/** One source per file, keyed by path. */
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
  const expanded = alternatives.flatMap((alt) =>
    expandBraces(`${head}${alt}${tail}`)
  );
  return expanded.flatMap((value) => expandBraces(value));
}

/**
 * One path segment as a matcher: `*` crosses anything but a separator, `?`
 * one character. Everything else is literal.
 */
function segmentMatcher(segment: string): RegExp {
  const source = [...segment]
    .map((
      char,
    ) => (char === "*" ? "[^/]*" : char === "?" ? "[^/]" : escapeRegExp(char)))
    .join("");
  return new RegExp(`^${source}$`);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every file a glob admits, in directory-read order.
 *
 * `**` descends, `*` and `?` match within one segment. A directory that
 * cannot be read is skipped rather than thrown on — a node_modules symlink
 * should not fail a stylesheet.
 */
export async function globFiles(pattern: string): Promise<string[]> {
  const segments = pattern.split("/").filter((part) => part.length > 0);
  let candidates: string[] = [pattern.startsWith("/") ? "/" : "."];
  for (const segment of segments) {
    if (segment === "**") {
      const descended: string[] = [];
      for (const candidate of candidates) {
        const nested = await recurse(candidate);
        descended.push(candidate, ...nested);
      }
      candidates = descended;
      continue;
    }
    const matcher = segmentMatcher(segment);
    const next: string[] = [];
    for (const candidate of candidates) {
      for (const entry of await readdirSafe(candidate)) {
        if (matcher.test(entry)) next.push(join(candidate, entry));
      }
    }
    candidates = next;
  }
  const files: string[] = [];
  for (const candidate of candidates) {
    if (await isFile(candidate)) files.push(candidate);
  }
  return files;
}

async function recurse(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdirSafe(dir)) {
    const path = join(dir, entry);
    if (await isFile(path)) continue;
    out.push(path, ...(await recurse(path)));
  }
  return out;
}

async function readdirSafe(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * True when a path matches no include pattern.
 *
 * The regexes are matched against the path as written, not the basename,
 * so a project whose sources live under `src/` behaves as unintuitively as
 * the pipeline it replaces would.
 */
export function isIncluded(
  path: string,
  include: readonly RegExp[],
  exclude: readonly RegExp[] = [],
): boolean {
  if (exclude.some((pattern) => pattern.test(path))) return false;
  if (include.length === 0) return true;
  return include.some((pattern) => pattern.test(path));
}

/**
 * Read every file the globs admit, keyed by path.
 *
 * A file that cannot be read is skipped rather than thrown on: the globs in
 * a user's config are not curated, and one unreadable path should not fail
 * a stylesheet.
 */
export async function scanContent(
  options: ContentOptions,
  root: string,
): Promise<ContentMap> {
  const include = options.pipeline?.include ?? [];
  const exclude = options.pipeline?.exclude ?? [];
  const files: ContentMap = new Map();
  for (const pattern of options.filesystem ?? []) {
    const absolute = /^([a-z]:)?[/\\]/i.test(pattern)
      ? pattern
      : join(root, pattern);
    for (const glob of expandBraces(absolute)) {
      for (const path of await globFiles(glob)) {
        if (!isIncluded(path, include, exclude)) continue;
        if (files.has(path)) continue;
        try {
          files.set(path, await readFile(path, "utf8"));
        } catch {
          // Unreadable is a skip, not a failure of the scan.
        }
      }
    }
  }
  return files;
}

/**
 * The scan as one string, in the order the glob walk produced it.
 *
 * The order is load-bearing, not incidental: Uno emits a rule where it
 * first met the class, so the walk's order is the sheet's order, and the
 * sheet's order is what decides which of two conflicting utilities on one
 * element wins. Sorting the paths would produce a deterministic sheet that
 * resolves those conflicts differently than this project's app does today,
 * which is a silent visual change for the sake of a nicer key.
 */
export function joinContent(files: ContentMap): string {
  return [...files.keys()].map((path) => files.get(path)!).join("\n");
}
