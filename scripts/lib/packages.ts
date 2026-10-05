/**
 * Workspace discovery for the parity gates in `scripts/`.
 *
 * Every gate in this directory answers the same two questions before it can
 * check anything: which packages exist, and which of them are components. Both
 * are derived from the tree rather than from a hand-written list, because a
 * list is exactly the thing that goes stale — a new component lands, the list
 * does not mention it, and the gate reports a clean workspace.
 *
 * A **component package** is a workspace package under `packages/` whose source
 * calls `define(tag, spec)` from `@spin/runtime`. That is the definition the
 * runtime already has: `define` is the only thing that turns a spec into a
 * custom element, so a package that calls it ships an element and every other
 * package does not.
 *
 * The runtime itself declares `define` rather than calling it, so it is not a
 * component package: it is the thing that renders, not something rendering.
 */

/** The worktree root, resolved from this file rather than from `cwd`. */
export const ROOT = new URL("../../", import.meta.url);

export interface PackageManifest {
  name?: string;
  version?: string;
  exports?: Record<string, string>;
  imports?: Record<string, string>;
  tasks?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface WorkspacePackage {
  /** Absolute URL of the package directory. */
  readonly dir: URL;
  /** `name` out of the package's own `deno.json`, or the directory name. */
  readonly name: string;
  /** Directory name — `runtime`, `tree`, `select`. */
  readonly stem: string;
  readonly manifest: PackageManifest;
  /** Absolute URLs of every `.ts` file under `src/`, sorted. */
  readonly sources: readonly URL[];
}

/** Reads a JSON file, returning `undefined` when it is absent. */
export async function readJson(url: URL): Promise<unknown | undefined> {
  try {
    return JSON.parse(await Deno.readTextFile(url));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  }
}

/** Absolute URLs of every `.ts` file under `dir`, recursively, sorted. */
export async function listSources(dir: URL): Promise<URL[]> {
  const found: URL[] = [];
  const walk = async (current: URL): Promise<void> => {
    for await (const entry of Deno.readDir(current)) {
      const child = new URL(`${entry.name}${entry.isDirectory ? "/" : ""}`, current);
      if (entry.isDirectory) await walk(child);
      else if (entry.name.endsWith(".ts")) found.push(child);
    }
  };
  await walk(dir);
  return found.sort((a, b) => a.pathname.localeCompare(b.pathname));
}

/** Loads one package directory, or `undefined` when it has no `deno.json`. */
export async function loadPackage(dir: URL): Promise<WorkspacePackage | undefined> {
  const manifest = await readJson(new URL("deno.json", dir)) as PackageManifest | undefined;
  if (!manifest) return undefined;
  const stem = dir.pathname.replace(/\/$/, "").split("/").pop() ?? "";
  return {
    dir,
    stem,
    name: manifest.name ?? stem,
    manifest,
    sources: await listSources(new URL("src/", dir)),
  };
}

/** Every workspace member under `packages/`, sorted by directory name. */
export async function workspacePackages(): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];
  for await (const entry of Deno.readDir(new URL("packages/", ROOT))) {
    if (!entry.isDirectory) continue;
    const loaded = await loadPackage(new URL(`${entry.name}/`, new URL("packages/", ROOT)));
    if (loaded) packages.push(loaded);
  }
  return packages.sort((a, b) => a.stem.localeCompare(b.stem));
}

/** One `define("spin-tree", …)` call site found in a package's source. */
export interface ElementRegistration {
  /** The tag, or `undefined` when it is not a literal the gate can read. */
  readonly tag: string | undefined;
  readonly file: URL;
  /** `line:column` in that file, so a report points at the call. */
  readonly position: string;
}

const DEFINE_CALL = /\bdefine\(\s*(["'`])([a-z][a-z0-9-]*)\1/g;
const DEFINE_CALL_DYNAMIC = /\bdefine\(\s*[^"'`]/g;
const DEFINE_DECLARATION = /\b(?:function|const|let|var)\s+define\b/;

/**
 * Every `define(tag, spec)` call in a package, in file order.
 *
 * A registration is a *call*, so three things that are not registrations are
 * skipped: comments — the runtime's own docblock shows an example
 * `define("spin-accordion", …)` that ships no element — the declaration of
 * `define` itself in `element.ts`, and `customElements.define`, which is the
 * platform call the runtime makes rather than a component registering one.
 *
 * Comments are blanked to spaces rather than deleted, so every offset here is
 * still an offset into the original file and `position` points at the real
 * line.
 */
export async function elementRegistrations(
  pkg: WorkspacePackage,
): Promise<ElementRegistration[]> {
  const registrations: ElementRegistration[] = [];
  for (const file of pkg.sources) {
    if (file.pathname.endsWith(".test.ts")) continue;
    const source = await Deno.readTextFile(file);
    // The runtime declares `define`; it is the thing that renders, not a
    // component shipping an element.
    if (DEFINE_DECLARATION.test(source)) continue;
    const code = stripComments(source);
    for (const match of code.matchAll(DEFINE_CALL)) {
      registrations.push({
        tag: match[2],
        file,
        position: position(source, match.index ?? 0),
      });
    }
    for (const match of code.matchAll(DEFINE_CALL_DYNAMIC)) {
      registrations.push({ tag: undefined, file, position: position(source, match.index ?? 0) });
    }
  }
  return registrations;
}

/** `line:column` for a character offset, 1-based. */
export function position(source: string, offset: number): string {
  const before = source.slice(0, offset);
  const line = before.split("\n").length;
  const column = offset - before.lastIndexOf("\n");
  return `${line}:${column}`;
}

/**
 * A source file with its comments blanked to spaces.
 *
 * Comments are replaced rather than deleted so every offset in the result is
 * still an offset into the original, which is what lets a finding name a line.
 * A gate that reads a `<button>` out of a docblock's example code is a gate
 * that reports findings nobody can act on.
 */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) =>
    comment.replace(/[^\n]/g, " ")
  );
}


/** `packages/<stem>/…` — the form a report uses, relative to the root. */
export function relative(url: URL): string {
  return url.pathname.startsWith(ROOT.pathname)
    ? url.pathname.slice(ROOT.pathname.length)
    : url.pathname;
}

/** Every `deno.json` in the tree, root included, sorted shallowest first. */
export async function allManifests(): Promise<URL[]> {
  const found: URL[] = [];
  const walk = async (current: URL): Promise<void> => {
    for await (const entry of Deno.readDir(current)) {
      if (entry.isDirectory) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        await walk(new URL(`${entry.name}/`, current));
      } else if (entry.name === "deno.json") {
        found.push(new URL(entry.name, current));
      }
    }
  };
  await walk(ROOT);
  return found.sort((a, b) => a.pathname.split("/").length - b.pathname.split("/").length ||
    a.pathname.localeCompare(b.pathname));
}

/**
 * Import resolution for the reachability walk.
 *
 * Returns the absolute URL a specifier points at, or `undefined` when it
 * leaves the workspace — `npm:`, `jsr:`, and a bare specifier with no entry in
 * any `imports` map. Relative specifiers resolve extensionless (`./x` finds
 * `x.ts` then `x/index.ts`), because that is what Deno does and what an author
 * writes.
 */
export function makeResolver(
  importMaps: readonly { base: URL; entries: Record<string, string> }[],
): (specifier: string, from: URL) => URL | undefined {
  const resolveRelative = (target: string, base: URL): URL | undefined => {
    const joined = new URL(target, base);
    const candidates = target.endsWith("/")
      ? [`${joined.pathname}index.ts`]
      : [`${joined.pathname}.ts`, `${joined.pathname}/index.ts`, joined.pathname];
    for (const candidate of candidates) {
      const url = new URL(candidate, base);
      try {
        if (Deno.statSync(url).isFile) return url;
      } catch {
        // Not this one; try the next shape.
      }
    }
    return undefined;
  };

  return (specifier, from) => {
    if (specifier.startsWith(".")) return resolveRelative(specifier, from);
    for (const { base, entries } of importMaps) {
      const target = entries[specifier];
      if (target === undefined) continue;
      if (target.startsWith(".")) return resolveRelative(target, base);
      // A workspace entry that is itself a bare name: follow the maps again.
      if (!/^(npm|jsr|https?|node):/.test(target)) {
        return resolveRelative(target, base);
      }
    }
    return undefined;
  };
}

/** Every import specifier in a source file, static and dynamic. */
export function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /^\s*import\s+["']([^"']+)["']/gm,
    /\bimport\s+type\s+["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

/** Prints findings and exits 1, or prints a summary and exits 0. */
export function report(title: string, findings: readonly string[], summary: string): never {
  if (findings.length > 0) {
    console.error(`✖ ${title}\n`);
    for (const finding of findings) console.error(`  ${finding}`);
    console.error(`\n${findings.length} problem${findings.length === 1 ? "" : "s"}.`);
    Deno.exit(1);
  }
  console.log(`✔ ${title}\n\n${summary}`);
  Deno.exit(0);
}