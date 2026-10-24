/**
 * The dist build — compiled JavaScript and declarations, one per package.
 *
 * The packages ship TypeScript today. This turns each publishable package
 * into the shape npm wants: a `dist/` that mirrors the source tree, an export
 * map that says the same thing the `deno.json` says, and nothing else.
 *
 * Two compilers, each for what it is good at:
 *
 * - `deno bundle` writes the JavaScript. One entry per source module, with
 *   every import left external, so the built package is the source package
 *   with the types stripped — one file per module, imports as written — and
 *   not a bundle of it.
 * - `tsc --emitDeclarationOnly` writes the declarations. TypeScript infers
 *   them without widening, which matters here: the contracts are built from
 *   `oc(...)` and the inferred types are the API.
 *
 * Both read the same rewritten copy of the sources, and the rewrite is the
 * npm shape of the workspace:
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
 * Usage: `deno task build:dist [package]`
 */

import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSkill } from "../packages/theme/src/skill/index.ts";
import { reachableFiles } from "./dist-graph.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES_DIR = join(REPO, "packages");
/** Where the rewritten copy of a package's sources lives while it compiles. */
const COPY_PREFIX = ".dist-";
/**
 * The npm package root, inside the package directory.
 *
 * The manifest cannot sit at the package's root: a `package.json` there
 * makes Deno treat the member as an npm package, link it into
 * `node_modules` under its name, and resolve every bare `@spin/…` import
 * through it — which would point the workspace's own apps at the built
 * dist instead of the source they are written against. The npm package is
 * therefore its own directory: `npm publish packages/<name>/npm`.
 */
const NPM_DIR = "npm";

/**
 * The packages whose skill's checklist is emitted from the contract.
 *
 * The manual a package ships is rendered, not the template it is written in:
 * a template with a hole where the checklist goes is not a manual an agent
 * can follow.
 */
const SKILL_RENDERERS: Record<string, (template: string) => string> = {
  "@spin/theme": (template) => renderSkill(template),
};

/** A package's `deno.json`, as far as the build cares. */
interface Manifest {
  readonly name: string;
  readonly version: string;
  /** Subpath → source file, both relative to the package directory. */
  readonly exports: Record<string, string>;
  /** Bare specifier → its target, as the manifest spells it. */
  readonly imports: Record<string, string>;
  readonly compilerOptions: Record<string, unknown>;
}

/** One module of the graph, as `deno info` reports it. */
interface GraphModule {
  readonly local?: string;
  readonly specifier: string;
  readonly mediaType?: string;
  readonly dependencies?: readonly {
    readonly specifier: string;
    readonly code?: { readonly specifier: string };
    readonly type?: { readonly specifier: string };
  }[];
}

/** The shape `deno info --json` prints. */
interface Graph {
  readonly modules: readonly GraphModule[];
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await Deno.readTextFile(path));
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/** The `deno.json` of a package, reduced to what the build reads. */
async function loadManifest(dir: string): Promise<Manifest> {
  const raw = await readJson(join(dir, "deno.json"));
  const exports = raw["exports"];
  const subpaths: Record<string, string> = typeof exports === "string"
    ? { ".": exports }
    : (exports as Record<string, string>);
  return {
    name: raw["name"] as string,
    version: raw["version"] as string,
    exports: subpaths,
    imports: (raw["imports"] ?? {}) as Record<string, string>,
    compilerOptions: (raw["compilerOptions"] ?? {}) as Record<string, unknown>,
  };
}

/**
 * The packages that ship.
 *
 * A package ships when it has an npm `package.json` beside its `deno.json`.
 * The manifest is the declaration of intent; the build follows it.
 */
async function publishablePackages(): Promise<string[]> {
  const found: string[] = [];
  for await (const entry of Deno.readDir(PACKAGES_DIR)) {
    if (!entry.isDirectory) continue;
    if (entry.name.startsWith(COPY_PREFIX)) continue;
    const dir = join(PACKAGES_DIR, entry.name);
    if (await exists(join(dir, NPM_DIR, "package.json"))) {
      found.push(entry.name);
    }
  }
  return found.sort();
}

async function run(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; out: string; err: string }> {
  const process = new Deno.Command(cmd, {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await process.output();
  return {
    code,
    out: new TextDecoder().decode(stdout),
    err: new TextDecoder().decode(stderr),
  };
}

/** Every file under a directory, relative to it. */
async function walk(dir: string): Promise<string[]> {
  const found: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory) {
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
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isDirectory) continue;
    const path = join(dir, entry.name);
    found.push(...(await emptyDirs(path)));
    if ((await Array.fromAsync(Deno.readDir(path))).length === 0) {
      found.push(path);
    }
  }
  return found;
}

/**
 * The Deno globals the sources use.
 *
 * `tsc` compiles against the runtime it is told about, and this repository
 * runs on Deno: the globals are part of the surface the packages are written
 * against, and the compiler has to know them. The build writes this beside
 * the copy it compiles — it is a build input, not a file the repository
 * ships, and it names only what the sources actually use.
 */
const DENO_GLOBALS = `declare namespace Deno {
  interface NetAddr {
    hostname: string;
    port: number;
    transport: string;
  }
  interface ServeOptions {
    hostname?: string;
    port?: number;
    signal?: AbortSignal;
  }
  interface HttpServer {
    readonly addr: NetAddr;
    readonly finished: Promise<void>;
    shutdown(): void;
  }
  const args: string[];
  function cwd(): string;
  function serve(
    options: ServeOptions,
    handler: (request: Request) => Response | Promise<Response>,
  ): HttpServer;
  namespace env {
    function get(key: string): string | undefined;
  }
  function readTextFile(path: string | URL): Promise<string>;
  function readTextFileSync(path: string | URL): string;
  function writeTextFile(
    path: string | URL,
    data: string | Uint8Array,
  ): Promise<void>;
}
`;

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
  boundary: string,
  manifests: Map<string, Manifest>,
  compiled: boolean,
  text: string,
): string {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return specifier;
  }
  const target = resolve(dirname(fromFile), specifier);
  if (target.startsWith(boundary + "/")) {
    if (!compiled || !/\.tsx?$/.test(specifier)) return specifier;
    return specifier.replace(/\.tsx?$/, ".js");
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
  boundary: string,
  manifests: Map<string, Manifest>,
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
        boundary,
        manifests,
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
 * The installed copy of an npm specifier.
 *
 * The build resolves npm packages from the workspace's `node_modules`
 * rather than from the registry: the workspace's lockfile already pins what
 * is installed, and the build must not reach for the network to find out
 * what it has.
 */
function installedNpm(specifier: string): string | null {
  if (!specifier.startsWith("npm:")) return null;
  const bare = specifier.slice("npm:".length);
  const versionAt = bare.lastIndexOf("@");
  const withoutVersion = versionAt > 0 ? bare.slice(0, versionAt) : bare;
  const parts = withoutVersion.split("/");
  const name = withoutVersion.startsWith("@")
    ? parts.slice(0, 2).join("/")
    : parts[0];
  const subpath = withoutVersion.slice(name.length);
  return join(REPO, "node_modules", name) + subpath;
}

/**
 * The import map the compile reads.
 *
 * The workspace's own manifests are the source of truth, and Deno merges the
 * root's map with the member's. This reproduces that merge for the copy,
 * and adds the subpaths a cross-package import is published under — the copy
 * sits beside the package it came from, so the relative targets in the
 * member's map resolve to the same files they did before.
 */
function buildImportMap(
  copyDir: string,
  manifest: Manifest,
  root: Manifest,
  siblings: Map<string, Manifest>,
): Record<string, string> {
  const map: Record<string, string> = {};
  const add = (key: string, value: string, base: string): void => {
    if (value.startsWith("./") || value.startsWith("../")) {
      map[key] = new URL(`file://${resolve(base, value)}`).href;
      return;
    }
    const installed = installedNpm(value);
    map[key] = installed ? new URL(`file://${installed}`).href : value;
  };
  for (const [key, value] of Object.entries(root.imports)) {
    add(key, value, REPO);
  }
  for (const [key, value] of Object.entries(manifest.imports)) {
    add(key, value, copyDir);
  }
  // The subpaths a cross-package import is published under.
  for (const [name, sibling] of siblings) {
    for (const [subpath, file] of Object.entries(sibling.exports)) {
      const key = subpath === "."
        ? name
        : `${name}/${subpath.replace(/^\.\//, "")}`;
      map[key] = new URL(
        `file://${resolve(join(PACKAGES_DIR, name), file)}`,
      ).href;
    }
  }
  return map;
}

/**
 * The module graph of a package's exported surface.
 *
 * `deno info` prints the raw specifier of every import — the text the source
 * wrote, not the file it resolved to. That text is what the bundle has to
 * leave alone, and what the rewrite pass reads.
 *
 * `deno info` takes one file, so the graph is read through a synthetic entry
 * that names every exported file.
 */
async function moduleGraph(
  configPath: string,
  entries: string[],
): Promise<Graph> {
  const synthetic = join(dirname(configPath), "entries.ts");
  await Deno.writeTextFile(
    synthetic,
    entries.map((entry) => `import ${JSON.stringify(entry)};`).join("\n") +
      "\n",
  );
  const result = await run(
    "deno",
    [
      "info",
      "--json",
      "--config",
      configPath,
      "--node-modules-dir=manual",
      synthetic,
    ],
    REPO,
  );
  if (result.code !== 0) {
    throw new Error(`deno info failed:\n${result.err}`);
  }
  return JSON.parse(result.out) as Graph;
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
  root: Manifest,
): Promise<Prepared> {
  const dir = join(PACKAGES_DIR, name);
  const manifest = manifests.get(name)!;
  const copyDir = join(PACKAGES_DIR, `${COPY_PREFIX}${name}`);
  const copySrc = join(copyDir, "src");

  await Deno.remove(copyDir, { recursive: true }).catch(() => {});
  await Deno.mkdir(copySrc, { recursive: true });

  const entryFiles: string[] = [];
  const declarationExports: string[] = [];
  for (const file of Object.values(manifest.exports)) {
    if (file.endsWith(".d.ts")) declarationExports.push(file);
    else entryFiles.push(file);
  }

  // The copy, with the cross-package imports pointed at their subpaths.
  for (const file of await walk(join(dir, "src"))) {
    const from = join(dir, "src", file);
    const to = join(copySrc, file);
    await Deno.mkdir(dirname(to), { recursive: true });
    if (!/\.tsx?$/.test(file)) {
      await Deno.copyFile(from, to);
      continue;
    }
    const text = await Deno.readTextFile(from);
    await Deno.writeTextFile(
      to,
      rewriteFile(text, from, dir, manifests, false),
    );
  }

  // The config the compile reads.
  const siblings = new Map<string, Manifest>();
  for (const [other, otherManifest] of manifests) {
    if (other === name) continue;
    siblings.set(other, otherManifest);
  }
  await Deno.writeTextFile(
    join(copyDir, "deno.json"),
    JSON.stringify({
      imports: buildImportMap(copyDir, manifest, root, siblings),
      compilerOptions: {
        ...root.compilerOptions,
        ...manifest.compilerOptions,
      },
    }),
  );

  // The globals the sources are written against.
  await Deno.writeTextFile(join(copyDir, "deno-globals.d.ts"), DENO_GLOBALS);

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

/** Compile one package's dist. */
/** The media types that are code: they compile, and they do not ship as they are. */
const CODE = new Set(["TypeScript", "TSX", "JavaScript", "JSX", "MTS", "MJS"]);

async function buildPackage(
  name: string,
  manifests: Map<string, Manifest>,
  root: Manifest,
): Promise<Built> {
  const prepared = await prepare(name, manifests, root);
  const { dir, copyDir, copySrc, manifest } = prepared;
  const dist = join(dir, NPM_DIR, "dist");
  const configPath = join(copyDir, "deno.json");

  try {
    const graph = await moduleGraph(
      configPath,
      prepared.entryFiles.map((file) =>
        new URL(
          `file://${resolve(copySrc, file.replace(/^\.\/src\//, ""))}`,
        ).href
      ),
    );
    console.error(`  ${name}: graph read`);

    // The package's own modules: everything the exported surface reaches.
    const own = graph.modules.filter((module) =>
      module.local !== undefined &&
      module.local.startsWith(copySrc + "/") &&
      !module.local.endsWith(".test.ts") &&
      !module.local.endsWith(".test.tsx")
    );
    const modules = own.filter((module) => CODE.has(module.mediaType ?? ""));
    const assets = own.filter((module) => !CODE.has(module.mediaType ?? ""));

    // The JSX runtime the package's own manifest points at — a shim for the
    // runtime the package is written against, not a module of the package.
    // It is in the graph because the compiler reaches for the runtime, and
    // it ships to nobody: a consumer's framework provides its own.
    const runtime = manifest.imports["solid-js/jsx-runtime"];
    const shim =
      runtime && (runtime.startsWith("./") || runtime.startsWith("../"))
        ? resolve(dir, runtime)
        : null;
    const shipped = modules.filter((module) => module.local !== shim);

    // The imports the source writes, as the source writes them.
    const externals = new Set<string>();
    for (const module of own) {
      for (const dependency of module.dependencies ?? []) {
        externals.add(dependency.specifier);
      }
    }

    // The JavaScript. One entry per module, every import left external, so
    // the dist is the source tree with the types stripped. It is assembled
    // beside the copy and moved into place at the end: a build that fails
    // leaves no half-written dist behind.
    const jsDir = join(copyDir, "js");
    const args = ["bundle", "--no-check"];
    // The externals come first in the argument list: `deno bundle`
    // mis-parses them when they follow the other flags, and the failure is a
    // panic in its type checker rather than a message.
    for (const external of externals) args.push("--external", external);
    args.push(
      "--config",
      configPath,
      "--outdir",
      jsDir,
      "--node-modules-dir=manual",
    );
    args.push(...shipped.map((module) => module.local!));
    const bundled = await run("deno", args, REPO);
    if (bundled.code !== 0) {
      throw new Error(`deno bundle failed for ${name}:\n${bundled.err}`);
    }
    console.error(`  ${name}: javascript written`);

    // The declarations. TypeScript infers them without widening, which is
    // what the contracts need.
    const types = await emitDeclarations(prepared, manifests);
    if (types.code !== 0) {
      throw new Error(
        `tsc failed for ${name}:\n${types.out}${types.err}`,
      );
    }
    console.error(`  ${name}: declarations written`);

    // The dist is the JavaScript, with the declarations laid over it.
    await Deno.remove(dist, { recursive: true }).catch(() => {});
    await Deno.mkdir(dist, { recursive: true });
    for (const file of await walk(join(copyDir, "types"))) {
      const target = join(dist, file);
      await Deno.mkdir(dirname(target), { recursive: true });
      await Deno.copyFile(join(copyDir, "types", file), target);
    }
    for (const file of await walk(jsDir)) {
      const target = join(dist, file);
      await Deno.mkdir(dirname(target), { recursive: true });
      await Deno.copyFile(join(jsDir, file), target);
    }

    // A module the code only imports for its types has no runtime to write,
    // so the bundler writes no file for it — but the declarations beside it
    // name it, and a name that points at nothing is a broken type. The
    // module ships as the empty module it is.
    for (const module of shipped) {
      const name = relative(copySrc, module.local!)
        .replace(/\.tsx?$/, ".js");
      const target = join(dist, name);
      if (await exists(target)) continue;
      await Deno.mkdir(dirname(target), { recursive: true });
      await Deno.writeTextFile(target, "export {};\n");
    }

    // The assets the source imports: a theme document, a stylesheet.
    for (const asset of assets) {
      const target = join(dist, relative(copySrc, asset.local!));
      await Deno.mkdir(dirname(target), { recursive: true });
      await Deno.copyFile(asset.local!, target);
    }

    // The README the npm package carries: npm includes it, and a package
    // without one is a package nobody can read.
    const readme = join(dir, "README.md");
    if (await exists(readme)) {
      await Deno.writeTextFile(
        join(dir, NPM_DIR, "README.md"),
        await Deno.readTextFile(readme),
      );
    }

    // The house skill, when the package has one: it is a product agents
    // install, so it ships with the package. The manual's checklist is
    // emitted from the contract, so the copy that ships is the rendered
    // one, not the template it was written in.
    const skill = join(dir, "skill");
    if (await exists(skill)) {
      const target = join(dir, NPM_DIR, "skill");
      await Deno.remove(target, { recursive: true }).catch(() => {});
      const renderer = SKILL_RENDERERS[manifest.name];
      for (const file of await walk(skill)) {
        const from = join(skill, file);
        const to = join(target, file);
        await Deno.mkdir(dirname(to), { recursive: true });
        if (file === "SKILL.md" && renderer) {
          await Deno.writeTextFile(
            to,
            renderer(await Deno.readTextFile(from)),
          );
        } else {
          await Deno.copyFile(from, to);
        }
      }
    }

    // The declarations that are exports in their own right: a `.d.ts` source
    // is copied, not compiled.
    for (const file of prepared.declarationExports) {
      const target = join(
        dist,
        relative(join(dir, "src"), resolve(dir, file)),
      );
      await Deno.mkdir(dirname(target), { recursive: true });
      await Deno.writeTextFile(
        target,
        await Deno.readTextFile(join(dir, file)),
      );
    }

    // The rewrite: every emitted file, specifiers read against its source.
    const emitted = await walk(dist);
    for (const file of emitted) {
      if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue;
      const path = join(dist, file);
      const source = join(
        copySrc,
        file.replace(/\.d\.ts$/, ".ts").replace(/\.js$/, ".ts"),
      );
      const text = await Deno.readTextFile(path);
      await Deno.writeTextFile(
        path,
        // The bundle records where a module came from; the copy is a build
        // step, and the published file should name the source it came from.
        rewriteFile(text, source, copySrc, manifests, true).replaceAll(
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
      await Deno.remove(join(dist, file));
    }
    for (const dir of await emptyDirs(dist)) {
      await Deno.remove(dir).catch(() => {});
    }

    // A bin is run, not imported: it says how it is run, and it is allowed
    // to run. npm links the file into `node_modules/.bin`, and the link is
    // only as good as the file it points at.
    await markBins(dir);

    return { name: manifest.name, files: (await walk(dist)).length };
  } finally {
    await Deno.remove(copyDir, { recursive: true }).catch(() => {});
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
  const manifest = await readJson(join(dir, NPM_DIR, "package.json"));
  const bins = manifest["bin"];
  const targets = typeof bins === "string"
    ? [bins]
    : Object.values((bins ?? {}) as Record<string, string>);
  for (const target of targets) {
    const path = join(dir, NPM_DIR, target);
    if (!await exists(path)) continue;
    const text = await Deno.readTextFile(path);
    if (!text.startsWith("#!")) {
      await Deno.writeTextFile(path, `#!/usr/bin/env node\n${text}`);
    }
    await Deno.chmod(path, 0o755);
  }
}

/**
 * The TypeScript that writes the declarations.
 *
 * The version Deno itself compiles with: the packages type-check under
 * `deno check`, and a compiler that reads the same sources differently
 * would write declarations the repository's own check does not agree with.
 */
const TYPESCRIPT = "npm:typescript@6.0.3/bin/tsc";

/**
 * Write a package's declarations.
 *
 * The declarations are written against the dependencies' declarations — the
 * built packages — so a consumer's compiler reads the same files the build
 * read.
 */
async function emitDeclarations(
  prepared: Prepared,
  manifests: Map<string, Manifest>,
): Promise<{ code: number; out: string; err: string }> {
  const { copyDir, copySrc, manifest } = prepared;
  const paths: Record<string, string[]> = {};
  for (const [name, sibling] of manifests) {
    if (name === manifest.name) continue;
    const npm = await readJson(
      join(PACKAGES_DIR, name, NPM_DIR, "package.json"),
    );
    const exports = npm["exports"] as Record<string, unknown>;
    for (const [subpath, target] of Object.entries(exports)) {
      const types = (target as { types?: string }).types;
      if (!types) continue;
      const key = subpath === "."
        ? sibling.name
        : `${sibling.name}/${subpath.replace(/^\.\//, "")}`;
      paths[key] = [join(PACKAGES_DIR, name, NPM_DIR, types)];
    }
  }
  // The package's own subpaths resolve to the copy under compile: the dist
  // they name does not exist until this emit finishes, and the copy's files
  // are the same program the declarations describe. The export paths are
  // package-relative, so they join at the copy's root, not its `src`.
  for (const [subpath, file] of Object.entries(manifest.exports)) {
    const key = subpath === "."
      ? manifest.name
      : `${manifest.name}/${subpath.replace(/^\.\//, "")}`;
    paths[key] = [join(copyDir, file as string)];
  }

  const outDir = join(copyDir, "types");
  const tsconfig = {
    compilerOptions: {
      target: "es2022",
      module: "esnext",
      moduleResolution: "bundler",
      lib: ["es2023", "dom", "dom.iterable"],
      // The package's own compiler options — a JSX runtime, mostly. The
      // rest of the manifest's options describe the Deno runtime, which
      // `tsc` does not share.
      ...(manifest.compilerOptions["jsx"] === undefined ? {} : {
        jsx: manifest.compilerOptions["jsx"],
        jsxImportSource: manifest.compilerOptions["jsxImportSource"],
      }),
      strict: true,
      declaration: true,
      emitDeclarationOnly: true,
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      outDir,
      rootDir: copySrc,
      types: ["node"],
      paths,
    },
    files: [join(copyDir, "deno-globals.d.ts")],
    include: [join(copySrc, "**/*.ts"), join(copySrc, "**/*.tsx")],
    exclude: [
      join(copySrc, "**/*.test.ts"),
      join(copySrc, "**/*.test.tsx"),
      join(copySrc, "**/*.d.ts"),
    ],
  };
  const tsconfigPath = join(copyDir, "tsconfig.json");
  await Deno.writeTextFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));

  const result = await run(
    "deno",
    ["run", "-A", TYPESCRIPT, "--project", tsconfigPath],
    REPO,
  );
  if (result.code === 0) {
    // The declarations land beside the JavaScript.
    for (const file of await walk(outDir)) {
      const target = join(prepared.dir, NPM_DIR, "dist", file);
      await Deno.mkdir(dirname(target), { recursive: true });
      await Deno.copyFile(join(outDir, file), target);
    }
  }
  return result;
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
  const deps = new Map<string, Set<string>>();
  for (const name of names) {
    const found = new Set<string>();
    const manifest = manifests.get(name)!;
    for (const key of Object.keys(manifest.imports)) {
      for (const [other, otherManifest] of manifests) {
        if (other === name) continue;
        if (
          key === otherManifest.name ||
          key.startsWith(otherManifest.name + "/")
        ) {
          found.add(other);
        }
      }
    }
    deps.set(name, found);
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
  const only = Deno.args[0];
  const root = await loadManifest(REPO);
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

  for (const name of dependencyOrder(selected, manifests)) {
    const built = await buildPackage(name, manifests, root);
    console.log(
      `built ${built.name} — ${built.files} files in ` +
        relative(REPO, join(PACKAGES_DIR, name, NPM_DIR, "dist")),
    );
  }
}

if (import.meta.main) {
  await main();
}
