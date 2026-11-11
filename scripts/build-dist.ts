/**
 * The dist build — compiled JavaScript and declarations, one per package.
 *
 * The packages ship TypeScript today. This turns each publishable package
 * into the shape npm wants: a `dist/` that mirrors the source tree, an export
 * map that says the same thing the `package.json` says, and nothing else.
 *
 * One compiler: `tsdown` writes the JavaScript and the declarations in a
 * single pass (`dts: true`, isolated declarations — the class of emit the
 * old `tsc --emitDeclarationOnly` pass OOMed on). Entries are the export
 * map's source files, keyed so the dist mirrors the source tree; bare
 * specifiers stay external (dependencies, named by the manifest), and
 * tsdown's chunking is pinned to flat `[name].js` so no hashed helper
 * escapes the reachability check. The copy/rewrite around it is the npm
 * shape of the workspace, unchanged:
 *
 * - A relative specifier that leaves the package becomes the sibling
 *   package's own subpath. A specifier with no npm subpath is a build
 *   failure, not a silent copy.
 * - A relative specifier's `.ts` extension becomes `.js`. Node resolves
 *   `./x.js` to `x.d.ts`, so the types still land.
 * - Nothing else moves. A bare specifier stays bare; it is a dependency, and
 *   the package's `package.json` says which.
 *
 * The packages are compiled in dependency order, because a package's
 * declarations are written against its dependencies' declarations — the same
 * order a consumer installs them in.
 *
 * Usage: `bun run build:dist [package]`
 */

import { dirname, join, relative, resolve } from "node:path";
import { mkdir, rm, copyFile, chmod, stat, symlink, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { renderAuthoringSkill } from "../packages/dev/src/skill/authoring.ts";
import { renderSkill } from "../packages/dev/src/skill/index.ts";
import { importSpecifiers, reachableFiles } from "./dist-graph.ts";
import { build } from "tsdown";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES_DIR = join(REPO, "packages");
/** Where the rewritten copy of a package's sources lives while it compiles. */
const COPY_PREFIX = ".dist-";
const INTERNAL_PACKAGES = ["theme", "preset", "diagnostics", "server", "build"] as const;
/**
 * The packages whose skill's checklist is emitted from the contract.
 *
 * The manual a package ships is rendered, not the template it is written in:
 * a template with a hole where the checklist goes is not a manual an agent
 * can follow.
 */
const SKILL_RENDERERS: Record<string, (template: string) => string> = {
  "@spinjs/dev": (template) => renderSkill(template),
};

/**
 * The authoring skill files the package ships, rendered from the starters.
 *
 * The house skill renders through SKILL_RENDERERS above; the authoring
 * skill's style list is emitted from the starters' style set, so it ships
 * rendered the same way, file by file.
 */
const AUTHORING_SKILL_FILES = ["skill/spin-type.md"];

/** A package's `package.json`, as far as the build cares. */
interface Manifest {
  readonly name: string;
  readonly version: string;
  /** Subpath → source file, both relative to the package directory. */
  readonly exports: Record<string, string>;
  /** Subpath → dist file, from `publishConfig.exports`. */
  readonly publishExports: Record<string, { types?: string; default?: string }>;
  /** Workspace dependencies, by package name. */
  readonly workspaceDeps: readonly string[];
  /** Declared bare dependencies (npm names a dist import may name). */
  readonly bareDeps: readonly string[];
}
async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** A package's `package.json`, reduced to what the build reads. */
async function loadManifest(dir: string): Promise<Manifest> {
  const raw = await readJson(join(dir, "package.json"));
  // Workspace manifests point at `src` for development; the `default`
  // condition is the module, `types` the declarations. `publishConfig.exports`
  // points at `dist` instead — read alongside, never in place of.
  const exports = (raw["exports"] ?? {}) as Record<
    string,
    string | { default?: string; types?: string }
  >;
  const subpaths: Record<string, string> = {};
  for (const [subpath, target] of Object.entries(exports)) {
    // A types-only export (`.d.ts` with no runtime module) still ships its
    // declarations; it just has no JavaScript entry to compile. The
    // `.d.ts` suffix marks it for the declaration path in `prepare`.
    if (typeof target === "string") subpaths[subpath] = target;
    else if (target.default !== undefined) subpaths[subpath] = target.default;
    else if (target.types !== undefined) subpaths[subpath] = target.types;
  }
  const publishExports =
    ((raw["publishConfig"] as { exports?: Record<string, { types?: string; default?: string }> } | undefined)?.exports ?? {});
  const allDeps = {
    ...((raw["dependencies"] ?? {}) as Record<string, string>),
    ...((raw["peerDependencies"] ?? {}) as Record<string, string>),
  };
  return {
    name: raw["name"] as string,
    version: raw["version"] as string,
    exports: subpaths,
    publishExports,
    workspaceDeps: Object.entries(allDeps)
      .filter(([, range]) => range === "workspace:*")
      .map(([name]) => name),
    bareDeps: Object.keys(allDeps).filter((name) => allDeps[name] !== "workspace:*"),
  };
}

/**
 * The packages that ship.
 *
 * A package ships when its `package.json` carries a non-empty
 * `publishConfig.exports`: the declaration of intent the build follows.
 */
async function publishablePackages(): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(COPY_PREFIX)) continue;
    const dir = join(PACKAGES_DIR, entry.name);
    if (!await exists(join(dir, "package.json"))) continue;
    const manifest = await loadManifest(dir);
    if (Object.keys(manifest.publishExports).length > 0) {
      found.push(entry.name);
    }
  }
  return found.sort();
}

/** Every file under a directory, relative to it. */
async function walk(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walk(path)).map((sub) => join(entry.name, sub)));
    } else {
      found.push(entry.name);
    }
  }
  return found.sort();
}

/** The empty directories under a directory, deepest first. */
async function emptyDirs(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    found.push(...(await emptyDirs(path)));
    if ((await readdir(path, { withFileTypes: true })).length === 0) {
      found.push(path);
    }
  }
  return found;
}

/** The import specifiers of a file, with the text around them. */
const SPECIFIER = /\b(?:from|import)\s*\(?\s*(["'])([^"']+)\1/g;

/**
 * The ranges of comments in a file, so the import scan skips documentation.
 *
 * A doc example names imports its file never resolves — the script block's
 * own example is one — and rewriting those would corrupt the comment while
 * checking a dependency the program does not have.
 */
function commentRanges(text: string): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  let i = 0;
  let string: string | null = null;
  while (i < text.length) {
    const char = text[i] as string;
    // A `/** */` doc block is documentation in full: fenced examples name
    // imports the file never resolves, and backtick-quoting inside the
    // block must not flip the scanner into string mode.
    if (string === null && char === "/" && text[i + 1] === "*" && text[i + 2] === "*") {
      const end = text.indexOf("*/", i + 3);
      const stop = end === -1 ? text.length : end + 2;
      out.push([i, stop]);
      i = stop;
      continue;
    }
    if (string !== null) {
      if (char === "\\") {
        i += 2;
        continue;
      }
      if (char === string) string = null;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      string = char;
      i += 1;
      continue;
    }
    if (char === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? text.length : end;
      out.push([i, stop]);
      i = stop;
      continue;
    }
    if (char === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out.push([i, stop]);
      i = stop;
      continue;
    }
    i += 1;
  }
  return out;
}

/**
 * The npm subpath a sibling package publishes a file under.
 *
 * A file that leaves the package is a workspace import, and npm has no
 * workspace: the file has to be reachable under the sibling's own name. When
 * the sibling does not export it, the build stops — a dist that imports
 * something no consumer can resolve is worse than no dist.
 */
function siblingSubpath(
  target: string,
  siblingDir: string,
  sibling: Manifest,
): string | null {
  for (const [subpath, file] of Object.entries(sibling.exports)) {
    if (resolve(siblingDir, file) === target) {
      return subpath === "." ? "." : subpath;
    }
  }
  return null;
}

/** The package a file belongs to, by which package directory holds it. */
function owningPackage(
  target: string,
  packages: readonly string[],
): string | null {
  for (const name of packages) {
    const dir = join(PACKAGES_DIR, name);
    if (target.startsWith(dir + "/")) return name;
  }
  return null;
}

/**
 * The specifier a source import becomes in the dist.
 *
 * A relative import inside the package keeps its shape. A relative import
 * that leaves the package becomes the sibling's npm subpath. A bare import
 * is a dependency and stays exactly as written.
 *
 * `compiled` says which side of the build the file is on: the copy the
 * compiler reads is still TypeScript, and only the emitted file drops the
 * `.ts` extension a Node runtime cannot resolve.
 */
function rewriteSpecifier(
  specifier: string,
  fromFile: string,
  toFile: string,
  boundary: string,
  manifests: Map<string, Manifest>,
  internalManifests: Map<string, Manifest>,
  copySrc: string | null,
  compiled: boolean,
  text: string,
): string {
  if (copySrc !== null && specifier.startsWith("@spinjs/")) {
    for (const [internalDir, internal] of internalManifests) {
      if (specifier === internal.name || specifier.startsWith(internal.name + "/")) {
        const sub = specifier === internal.name
          ? "."
          : "./" + specifier.slice(internal.name.length + 1);
        const exported = internal.exports[sub];
        if (exported === undefined) {
          throw new Error(
            `${relative(REPO, fromFile)} imports ${specifier}, which ${internal.name} does not export`,
          );
        }
        const relInSrc = exported.replace(/^\.\/src\//, "");
        const destTarget = join(copySrc, "_internal", internalDir, relInSrc);
        let rel = relative(dirname(toFile), destTarget).replaceAll("\\", "/");
        if (!rel.startsWith(".")) rel = `./${rel}`;
        if (compiled && /\.tsx?$/.test(rel)) rel = rel.replace(/\.tsx?$/, ".js");
        return rel;
      }
    }
  }
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return specifier;
  }
  const target = resolve(dirname(fromFile), specifier);
  if (target.startsWith(boundary + "/")) {
    if (!compiled || !/\.tsx?$/.test(specifier)) return specifier;
    return specifier.replace(/\.tsx?$/, ".js");
  }
  if (copySrc !== null) {
    const internalOwner = owningPackage(target, [...internalManifests.keys()]);
    if (internalOwner !== null) {
      const relInSrc = relative(join(PACKAGES_DIR, internalOwner, "src"), target);
      const destTarget = join(copySrc, "_internal", internalOwner, relInSrc);
      let rel = relative(dirname(toFile), destTarget).replaceAll("\\", "/");
      if (!rel.startsWith(".")) rel = `./${rel}`;
      if (compiled && /\.tsx?$/.test(rel)) rel = rel.replace(/\.tsx?$/, ".js");
      return rel;
    }
  }
  const owner = owningPackage(target, [...manifests.keys()]);
  if (owner === null) {
    throw new Error(
      `${relative(REPO, fromFile)} imports ${specifier}, which leaves the ` +
        `workspace's packages and has no package to name it under`,
    );
  }
  const sibling = manifests.get(owner)!;
  const subpath = siblingSubpath(
    target,
    join(PACKAGES_DIR, owner),
    sibling,
  );
  if (subpath === null) {
    const lines = text.split("\n");
    const at = lines.findIndex((line) => line.includes(specifier));
    const context = at === -1
      ? ""
      : lines.slice(Math.max(0, at - 2), at + 3).join("\n");
    throw new Error(
      `${relative(REPO, fromFile)} imports ${specifier}, but ` +
        `${sibling.name} does not export it — add it to that package's ` +
        `exports before shipping a dist\n---\n${context}\n---`,
    );
  }
  return subpath === "."
    ? sibling.name
    : `${sibling.name}/${subpath.replace(/^\.\//, "")}`;
}

/** Rewrite the specifiers of a file, leaving documentation alone. */
function rewriteFile(
  text: string,
  fromFile: string,
  toFile: string,
  boundary: string,
  manifests: Map<string, Manifest>,
  internalManifests: Map<string, Manifest>,
  copySrc: string | null,
  compiled: boolean,
): string {
  const comments = commentRanges(text);
  const inside = (index: number): boolean =>
    comments.some(([start, stop]) => index >= start && index < stop);
  let out = "";
  let cursor = 0;
  for (const match of text.matchAll(SPECIFIER)) {
    const whole = match[0];
    const specifier = match[2] as string;
    const index = match.index ?? 0;
    out += text.slice(cursor, index);
    if (inside(index)) {
      out += whole;
    } else {
      const rewritten = rewriteSpecifier(
        specifier,
        fromFile,
        toFile,
        boundary,
        manifests,
        internalManifests,
        copySrc,
        compiled,
        text,
      );
      out += whole.replace(specifier, rewritten);
    }
    cursor = index + whole.length;
  }
  return out + text.slice(cursor);
}


/**
 * The tsdown entries for a package, keyed so the dist mirrors the source tree.
 *
 * One entry per source module, keyed by its path under `src` without the
 * extension (`menu/menu.presentation.ts` → `menu/menu.presentation`): the
 * key is the dist path, and tsdown writes `<key>.js` + `<key>.d.ts`
 * under it. Every module is an entry — not just the exported surface — so
 * a types-only shared module (no runtime of its own) still gets its
 * declaration emitted where the entries' declarations import it from. The
 * prune after the emit removes whatever the export map does not reach.
 * The copy the entries point at is already rewritten to the npm shape, so
 * bare specifiers name sibling subpaths and dependencies tsdown leaves
 * external. Test files and declaration sources never reach the entries.
 */
async function entryMap(
  copySrc: string,
): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  for (const file of await walk(copySrc)) {
    if (!/\.tsx?$/.test(file)) continue;
    if (/\.test\.tsx?$/.test(file)) continue;
    if (/\.d\.tsx?$/.test(file)) continue;
    const key = file.replace(/\.tsx?$/, "");
    entries[key] = join(copySrc, file);
  }
  return entries;
}

/**
 * The bare specifiers a package's manifest declares, as matchers.
 *
 * tsdown leaves sibling subpaths and dependencies external instead of
 * bundling them: the `node_modules` link under the copy resolves them, and
 * without this they (and their transitive files) land in the dist. Each
 * name matches itself and its subpaths (`linkedom`, `linkedom/esm/...`).
 */
function bareExternals(manifest: Manifest): RegExp[] {
  const out = [new RegExp("^node:"), new RegExp("^@spinjs/(?:components|dev)(?=/|$)")];
  for (const name of manifest.bareDeps) {
    out.push(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=/|$)`));
  }
  return out;
}

/** A package ready to be compiled. */
interface Prepared {
  /** The package directory. */
  readonly dir: string;
  /** The copy of its sources the compile reads. */
  readonly copyDir: string;
  /** The copy's `src` directory. */
  readonly copySrc: string;
  /** The manifest the copy's config and tsconfig are written from. */
  readonly manifest: Manifest;
  /** The exported surface, as source files. */
  readonly entryFiles: string[];
  /** The exports that are declarations in their own right. */
  readonly declarationExports: string[];
}

/**
 * Copy a package's sources and rewrite the imports that leave the package.
 *
 * The copy sits beside the package it came from, so the relative targets in
 * the manifest still resolve to the same files. The rewrite is the one the
 * npm shape needs: a cross-package import becomes the sibling's subpath.
 */
async function prepare(
  name: string,
  manifests: Map<string, Manifest>,
  internalManifests: Map<string, Manifest>,
): Promise<Prepared> {
  const dir = join(PACKAGES_DIR, name);
  const manifest = manifests.get(name)!;
  const copyDir = join(PACKAGES_DIR, `${COPY_PREFIX}${name}`);
  const copySrc = join(copyDir, "src");

  await rm(copyDir, { recursive: true }).catch(() => {});
  await mkdir(copySrc, { recursive: true });

  const entryFiles: string[] = [];
  const declarationExports: string[] = [];
  for (const file of Object.values(manifest.exports)) {
    if (file.endsWith(".d.ts")) declarationExports.push(file);
    else entryFiles.push(file);
  }

  const internalCopySrc = name === "dev" ? copySrc : null;
  // The copy, with the cross-package imports pointed at their subpaths.
  for (const file of await walk(join(dir, "src"))) {
    const from = join(dir, "src", file);
    const to = join(copySrc, file);
    await mkdir(dirname(to), { recursive: true });
    if (!/\.tsx?$/.test(file)) {
      await copyFile(from, to);
      continue;
    }
    const text = await readFile(from, "utf8");
    const rewritten = /\.test\.tsx?$/.test(file)
      ? text
      : rewriteFile(text, from, to, dir, manifests, internalManifests, internalCopySrc, false);
    await writeFile(to, rewritten);
  }

  if (name === "dev") {
    for (const internalName of INTERNAL_PACKAGES) {
      const internalDir = join(PACKAGES_DIR, internalName);
      for (const file of await walk(join(internalDir, "src"))) {
        if (/\.test\.tsx?$/.test(file)) continue;
        const from = join(internalDir, "src", file);
        const to = join(copySrc, "_internal", internalName, file);
        await mkdir(dirname(to), { recursive: true });
        if (!/\.tsx?$/.test(file)) {
          await copyFile(from, to);
          continue;
        }
        const text = await readFile(from, "utf8");
        const rewritten = rewriteFile(
          text,
          from,
          to,
          internalDir,
          manifests,
          internalManifests,
          copySrc,
          false,
        );
        await writeFile(to, rewritten);
      }
    }
  }
  // The package's own `node_modules`: the bare specifiers the sources write
  // (`hono`, `@iconify-json/*`) resolve through the workspace member, not
  // the root. The copy sits beside the package, not inside it, so the link
  // puts the same resolution under the copy for `tsc` and `bun build`.
  await rm(join(copyDir, "node_modules"), { recursive: true }).catch(() => {});
  try {
    await symlink(join(dir, "node_modules"), join(copyDir, "node_modules"));
  } catch {
    // A package with no installed dependencies needs no link.
  }

  // Sibling trees the sources import as siblings: the house skill's
  // markdown is read through `../../skill/*.md?raw` from `src/`, so the
  // copy carries the same directory beside its own `src/`.
  const skillSrc = join(dir, "skill");
  if (await exists(skillSrc)) {
    const skillDest = join(copyDir, "skill");
    await mkdir(skillDest, { recursive: true });
    for (const file of await walk(skillSrc)) {
      const target = join(skillDest, file);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(join(skillSrc, file), target);
    }
  }

  return { dir, copyDir, copySrc, manifest, entryFiles, declarationExports };
}

/** The files the package's export map names, as paths under the dist. */
function publishedTargets(prepared: Prepared): string[] {
  const targets: string[] = [];
  for (const file of prepared.entryFiles) {
    const module = file.replace(/^\.\/src\//, "").replace(/\.tsx?$/, ".js");
    targets.push(module);
    targets.push(module.replace(/\.js$/, ".d.ts"));
  }
  for (const file of prepared.declarationExports) {
    targets.push(file.replace(/^\.\/src\//, ""));
  }
  return targets;
}

interface Built {
  readonly name: string;
  readonly files: number;
}

/**
 * The `?raw` imports a glob expands to, answered with the file's text.
 *
 * A `import.meta.glob("./x/*.html", { query: "?raw" })` compiles to one
 * import per match with a `?raw` suffix, and only vite answers those —
 * the dist compiler does not. This loader does: a `?raw` id resolves
 * against its importer to the file, and loads as a default-exported
 * string. The suffix is stripped before the resolve so the module graph
 * holds the file, not the query.
 */
function rawLoader(): {
  name: string;
  resolveId(
    id: string,
    importer: string | undefined,
  ): string | undefined;
  load(id: string): Promise<string | undefined>;
} {
  return {
    name: "spin-raw",
    resolveId(id, importer) {
      if (!id.endsWith("?raw")) return undefined;
      if (importer === undefined) return undefined;
      const dir = importer.slice(0, importer.lastIndexOf("/"));
      return join(dir, id.slice(0, -"?raw".length));
    },
    async load(id) {
      if (!id.endsWith(".html") && !id.endsWith(".md")) return undefined;
      try {
        return `export default ${JSON.stringify(await readFile(id, "utf8"))};`;
      } catch {
        return undefined;
      }
    },
  };
}

/** Compile one package's dist. */

async function buildPackage(
  name: string,
  manifests: Map<string, Manifest>,
  internalManifests: Map<string, Manifest>,
): Promise<Built> {
  const prepared = await prepare(name, manifests, internalManifests);
  const { dir, copyDir, copySrc, manifest } = prepared;
  const dist = join(dir, "dist");

  try {
    // One compiler: tsdown writes the JavaScript and the declarations in a
    // single pass. Entries are keyed so the dist mirrors the source tree;
    // bare specifiers stay external (sibling subpaths and dependencies, as
    // the copy rewrote them). `preserveModules` keeps one file per module —
    // a shared helper lands beside its entries instead of under a hash, so
    // every import the dist names resolves to a file the dist ships.
    const outDir = join(copyDir, "out");
    await mkdir(outDir, { recursive: true });
    await build({
      entry: await entryMap(copySrc),
      outDir,
      cwd: copyDir,
      dts: true,
      format: ["esm"],
      sourcemap: true,
      outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
      outputOptions: { preserveModules: true, preserveModulesRoot: "src" },
      deps: { neverBundle: bareExternals(manifest) },
      plugins: [rawLoader()],
      // The kit's `.tsx` is Solid source, not React: rolldown's default
      // automatic runtime would emit `react/jsx-runtime` imports no
      // dependency declares. Preserved, the consumer's own Solid plugin
      // compiles it — the same transform the workspace apps apply.
      inputOptions: { transform: { jsx: "preserve" } },
    });
    console.error(`  ${name}: tsdown written`);

    // The dist is what tsdown wrote. It is assembled beside the copy and
    // moved into place at the end: a build that fails leaves no half-written
    // dist behind.
    await rm(dist, { recursive: true }).catch(() => {});
    await mkdir(dist, { recursive: true });
    for (const file of await walk(outDir)) {
      const target = join(dist, file);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(join(outDir, file), target);
    }

    // The house skill, when the package has one: it is a product agents
    // install, so it ships in place. The manual's checklist is emitted from
    // the contract, so the copy that ships is the rendered one, not the
    // template it was written in.
    const skillFile = join(dir, "skill", "SKILL.md");
    const renderer = SKILL_RENDERERS[manifest.name];
    if (renderer && (await exists(skillFile))) {
      await writeFile(skillFile, renderer(await readFile(skillFile, "utf8")));
    }
    if (manifest.name === "@spinjs/dev") {
      for (const file of AUTHORING_SKILL_FILES) {
        const path = join(dir, file);
        if (await exists(path)) {
          await writeFile(path, renderAuthoringSkill(await readFile(path, "utf8")));
        }
      }
    }



    // Declaration sources (`.d.ts` files with no `.ts` counterpart) are not
    // compiled by tsdown; copy the already-rewritten declaration sources from
    // `copySrc` with relative `.d.ts` specifiers turned into `.js`.
    for (const file of await walk(copySrc)) {
      if (!file.endsWith(".d.ts")) continue;
      const target = join(dist, file);
      await mkdir(dirname(target), { recursive: true });
      const rawDts = await readFile(join(copySrc, file), "utf8");
      const emittedDts = rawDts.replace(
        /((?:from|import)\s*\(?\s*["'])(\.\.?\/[^"']+?)\.d\.ts(["'])/g,
        "$1$2.js$3",
      );
      await writeFile(target, emittedDts);
    }

    // A declaration with no runtime to write: the source names it (`import
    // type ... from "./x.d.ts"` becomes `./x.js` in the emit), but tsdown
    // writes no module for a file with no values. The module ships as the
    // empty module it is, so the import the declarations name resolves.
    for (const file of await walk(dist)) {
      if (!file.endsWith(".d.ts")) continue;
      const js = file.replace(/\.d\.ts$/, ".js");
      if (await exists(join(dist, js))) continue;
      let wanted = false;
      for (const other of await walk(dist)) {
        if (!other.endsWith(".js") && !other.endsWith(".d.ts")) continue;
        const text = await readFile(join(dist, other), "utf8");
        for (const specifier of importSpecifiers(text)) {
          if (!specifier.startsWith(".")) continue;
          const next = relative(dist, resolve(dirname(join(dist, other)), specifier));
          if (next === js) {
            wanted = true;
            break;
          }
        }
        if (wanted) break;
      }
      if (!wanted) continue;
      await writeFile(join(dist, js), "export {};\n");
    }

    // The paths the bundle records name the copy, which is a build step:
    // point them at the source the published file came from. No specifier
    // scan here — tsdown already emitted final specifiers (bare stays
    // external, relative stays same-package with `.js`), and scanning
    // emitted code with the source-oriented tracker misreads constructs
    // the emitter produces (regex literals carrying quotes, doc comments
    // carried into chunks). The copy the compiler read was already
    // rewritten to the npm shape in `prepare`.
    for (const file of await walk(dist)) {
      if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue;
      const path = join(dist, file);
      const text = await readFile(path, "utf8");
      await writeFile(
        path,
        text.replaceAll(
          relative(REPO, copySrc),
          relative(REPO, join(dir, "src")),
        ),
      );
    }

    // Nothing extra ships. The graph reaches modules the source imports but
    // the public surface does not name — a helper the entry imports and
    // never re-exports — and those are not part of the package.
    const reachable = await reachableFiles(
      dist,
      Object.values(publishedTargets(prepared)),
    );
    for (const file of await walk(dist)) {
      if (reachable.has(file)) continue;
      await rm(join(dist, file));
    }
    for (const dir of await emptyDirs(dist)) {
      await rm(dir).catch(() => {});
    }
    // A bin is run, not imported: it says how it is run, and it is allowed
    // to run. npm links the file into `node_modules/.bin`, and the link is
    // only as good as the file it points at.
    await markBins(dir);

    // The studio bundle, built by `bun run build:studio` in this checkout.
    // A published `@spinjs/dev` serves `/__spin/studio` from this copy;
    // shipping without it strands every consumer's Studio, so the build
    // fails loudly instead of publishing a package that cannot serve it.
    if (manifest.name === "@spinjs/dev") {
      const built = join(REPO, "apps", "studio", "dist");
      const shipped = join(dist, "studio");
      if (!(await exists(join(built, "index.html")))) {
        throw new Error(
          "[spin] studio bundle missing: run bun run build:studio first",
        );
      }
      await rm(shipped, { recursive: true }).catch(() => {});
      await mkdir(shipped, { recursive: true });
      for (const file of await walk(built)) {
        const target = join(shipped, file);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(join(built, file), target);
      }
    }
    if (manifest.name === "@spinjs/components") {
      const srcBase = join(REPO, "packages", "components", "src");
      for (const file of await walk(srcBase)) {
        if (!/\/examples\/[^/]+\.html$/.test(file)) continue;
        const target = join(dist, file);
        await mkdir(dirname(target), { recursive: true });
        // The example's script imports by source paths (`../x.ts`); the
        // dist beside it is compiled, so the shipped copy names the
        // emitted modules instead.
        const text = await readFile(join(srcBase, file), "utf8");
        await writeFile(
          target,
          text.replace(/from\s*(["'])(\.\.?\/[^"']+?)\.ts\1/g, 'from $1$2.js$1'),
        );
      }
    }
    return { name: manifest.name, files: (await walk(dist)).length };
  } finally {
    await rm(copyDir, { recursive: true }).catch(() => {});
  }
}

/**
 * The bins a package ships, ready to be run.
 *
 * The manifest says which file is the bin; the build gives it a shebang
 * and the bit that says it may be run. A bin without them is a file npm
 * links into `node_modules/.bin` and nobody can start.
 */
async function markBins(dir: string): Promise<void> {
  const manifest = await readJson(join(dir, "package.json"));
  const bins = manifest["bin"];
  const targets = typeof bins === "string"
    ? [bins]
    : Object.values((bins ?? {}) as Record<string, string>);
  for (const target of targets) {
    const path = join(dir, target);
    if (!await exists(path)) continue;
    const text = await readFile(path, "utf8");
    if (!text.startsWith("#!")) {
      await writeFile(path, `#!/usr/bin/env node\n${text}`);
    }
    await chmod(path, 0o755);
  }
}
/**
 * The order the packages compile in.
 *
 * A package's declarations are written against its dependencies' — so the
 * dependency comes first, the same order a consumer installs them in.
 */
function dependencyOrder(
  names: readonly string[],
  manifests: Map<string, Manifest>,
): string[] {
  // Workspace deps are package names (`@spinjs/preset`); the build walks
  // directory names (`preset`). The index bridges the two — without it the
  // filter below matches nothing and the "order" is alphabetical, so a
  // package compiles against siblings whose dists do not exist yet.
  const dirOf = new Map(
    [...manifests].map(([dir, manifest]) => [manifest.name, dir] as const),
  );
  const deps = new Map<string, Set<string>>();
  for (const name of names) {
    const manifest = manifests.get(name)!;
    deps.set(
      name,
      new Set(
        manifest.workspaceDeps
          .map((dep) => dirOf.get(dep))
          .filter((dep): dep is string =>
            dep !== undefined && dep !== name && names.includes(dep)
          ),
      ),
    );
  }

  const ordered: string[] = [];
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (name: string): void => {
    if (done.has(name) || visiting.has(name)) return;
    visiting.add(name);
    for (const dep of deps.get(name) ?? []) visit(dep);
    visiting.delete(name);
    done.add(name);
    ordered.push(name);
  };
  for (const name of names) visit(name);
  return ordered;
}

async function main(): Promise<void> {
  const only = process.argv.slice(2)[0];
  const names = await publishablePackages();
  const selected = only ? names.filter((name) => name === only) : names;
  if (selected.length === 0) {
    throw new Error(
      only
        ? `no publishable package named ${only} (publishable: ${
          names.join(", ")
        })`
        : "no publishable packages found",
    );
  }

  const manifests = new Map<string, Manifest>();
  for (const name of names) {
    manifests.set(name, await loadManifest(join(PACKAGES_DIR, name)));
  }
  const internalManifests = new Map<string, Manifest>();
  for (const name of INTERNAL_PACKAGES) {
    internalManifests.set(name, await loadManifest(join(PACKAGES_DIR, name)));
  }

  for (const name of dependencyOrder(selected, manifests)) {
    const built = await buildPackage(name, manifests, internalManifests);
    console.log(
      `built ${built.name} — ${built.files} files in ` +
        relative(REPO, join(PACKAGES_DIR, name, "dist")),
    );
  }
}

/**
 * The manifest a tarball ships, written beside the workspace one.
 *
 * The workspace manifest points at `src/` so development never builds;
 * the packed manifest must point at `dist/` or the installed package
 * resolves subpaths to sources that are not shipped. `bun pm pack`
 * packs `package.json` as written, so packing runs through
 * `scripts/pack.ts`: it swaps each manifest, packs, and restores.
 * Kept here because the swap reads the same `Manifest` shape the
 * build reads — one shape, two writers.
 */
export function packManifestOf(
  raw: Record<string, unknown>,
  versions: ReadonlyMap<string, string>,
): Record<string, unknown> | undefined {
  const publishExports =
    (raw["publishConfig"] as { exports?: unknown } | undefined)?.exports;
  if (publishExports === undefined) return undefined;
  const pin = (
    deps: Record<string, string> | undefined,
  ): Record<string, string> | undefined => {
    if (deps === undefined) return undefined;
    const out: Record<string, string> = {};
    for (const [dep, range] of Object.entries(deps)) {
      out[dep] = range === "workspace:*" && versions.has(dep)
        ? versions.get(dep)!
        : range;
    }
    return out;
  };
  const next: Record<string, unknown> = { ...raw };
  next["exports"] = publishExports;
  // The exports map ships promoted, but access travels with the
  // package: a scoped tarball without `access: public` publishes as
  // restricted, which the registry refuses without a paid org.
  const { exports: _exports, ...publishRest } =
    (raw["publishConfig"] as Record<string, unknown> | undefined) ?? {};
  if (Object.keys(publishRest).length > 0) {
    next["publishConfig"] = publishRest;
  } else {
    delete next["publishConfig"];
  }
  const dependencies = pin(
    raw["dependencies"] as Record<string, string> | undefined,
  );
  const peerDependencies = pin(
    raw["peerDependencies"] as Record<string, string> | undefined,
  );
  if (dependencies !== undefined) next["dependencies"] = dependencies;
  if (peerDependencies !== undefined) next["peerDependencies"] = peerDependencies;
  return next;
}


if (import.meta.main) {
  await main();
}
