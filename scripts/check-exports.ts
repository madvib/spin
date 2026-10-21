/**
 * The export map check — the built package against the source package.
 *
 * A package's `deno.json` says what it exports; its `package.json` says the
 * same thing to npm. The two must agree, and the dist must have what the
 * map promises. This checks all three, because a manifest that disagrees
 * with the code is the same defect whether it is wrong about a subpath, a
 * file that is not there, or a file that is there for nobody.
 *
 * The checks:
 *
 * - The subpaths are the same set. Not more, not fewer.
 * - Every subpath resolves: the types it names and the module it names are
 *   both in the dist.
 * - Nothing extra ships: every file in the dist is reachable from a
 *   subpath, by import.
 * - The name and the version are the same in both manifests.
 * - The dependencies are the ones the dist imports — no more, no less.
 *
 * Usage: `deno task check:dist`
 */

import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importSpecifiers, reachableFiles } from "./dist-graph.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES_DIR = join(REPO, "packages");
/** The npm package root, inside the package directory. */
const NPM_DIR = "npm";

interface Manifest {
  readonly name: string;
  readonly version: string;
  readonly exports: Record<string, string>;
}

interface NpmManifest {
  readonly name: string;
  readonly version: string;
  readonly exports: Record<string, { types?: string; default?: string }>;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
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

/** The packages that ship: the ones with an npm manifest beside the Deno one. */
async function publishablePackages(): Promise<string[]> {
  const found: string[] = [];
  for await (const entry of Deno.readDir(PACKAGES_DIR)) {
    if (!entry.isDirectory) continue;
    if (entry.name.startsWith(".dist-")) continue;
    if (
      await exists(join(PACKAGES_DIR, entry.name, NPM_DIR, "package.json"))
    ) {
      found.push(entry.name);
    }
  }
  return found.sort();
}

class Findings {
  readonly problems: string[] = [];

  fail(message: string): void {
    this.problems.push(message);
  }
}

/** Check one package. */
async function checkPackage(name: string, findings: Findings): Promise<void> {
  const dir = join(PACKAGES_DIR, name);
  const deno = await readJson(join(dir, "deno.json"));
  const npm = await readJson(
    join(dir, NPM_DIR, "package.json"),
  ) as unknown as NpmManifest;

  const source =
    (typeof deno["exports"] === "string"
      ? { ".": deno["exports"] as string }
      : deno["exports"]) as Record<string, string>;
  const published = npm.exports;

  // The name and the version are one decision, written twice.
  if (npm.name !== deno["name"]) {
    findings.fail(
      `${name}: the npm manifest is ${npm.name}, the Deno manifest is ` +
        `${deno["name"]}`,
    );
  }
  if (npm.version !== deno["version"]) {
    findings.fail(
      `${name}: the npm manifest is version ${npm.version}, the Deno ` +
        `manifest is ${deno["version"]}`,
    );
  }

  // The subpaths are the same set.
  const sourcePaths = Object.keys(source).sort();
  const publishedPaths = Object.keys(published).sort();
  for (const subpath of sourcePaths) {
    if (!publishedPaths.includes(subpath)) {
      findings.fail(
        `${name}: ${subpath} is exported by the Deno manifest and missing ` +
          `from the npm manifest`,
      );
    }
  }
  for (const subpath of publishedPaths) {
    if (!sourcePaths.includes(subpath)) {
      findings.fail(
        `${name}: ${subpath} is exported by the npm manifest and missing ` +
          `from the Deno manifest`,
      );
    }
  }

  // Every subpath resolves.
  const dist = join(dir, NPM_DIR, "dist");
  const targets: string[] = [];
  for (const [subpath, target] of Object.entries(published)) {
    const files = Object.values(target).filter((file): file is string =>
      typeof file === "string"
    );
    if (files.length === 0) {
      findings.fail(`${name}: ${subpath} names no file`);
      continue;
    }
    for (const file of files) {
      const path = join(dir, NPM_DIR, file);
      if (!await exists(path)) {
        findings.fail(`${name}: ${subpath} names ${file}, which is not there`);
        continue;
      }
      targets.push(file);
    }
  }

  // Nothing extra ships: every file in the dist is reachable from a
  // subpath. A declaration is reachable when the module beside it is — the
  // two are one file's worth of contract.
  const shipped = await walk(dist);
  const reachable = await reachableFiles(
    dist,
    targets.map((file) => file.replace(/^\.\/dist\//, "")),
  );
  for (const file of shipped) {
    if (!reachable.has(file)) {
      findings.fail(`${name}: ${file} is in the dist and nothing imports it`);
    }
  }

  // Nothing dangles: every relative import in the dist names a file that
  // is in the dist.
  for (const file of shipped) {
    if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue;
    const path = join(dist, file);
    for (const specifier of importSpecifiers(await Deno.readTextFile(path))) {
      if (!specifier.startsWith(".")) continue;
      const next = relative(dist, resolve(dirname(path), specifier));
      if (!await exists(join(dist, next))) {
        findings.fail(
          `${name}: ${file} imports ${specifier}, which is not in the dist`,
        );
      }
    }
  }

  // The dependencies are the ones the dist imports — the JavaScript and the
  // declarations both, because a type-only import is a dependency too.
  const imports = new Set<string>();
  for (const file of shipped) {
    if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue;
    for (
      const specifier of importSpecifiers(
        await Deno.readTextFile(join(dist, file)),
      )
    ) {
      if (specifier.startsWith(".") || specifier.startsWith("node:")) continue;
      imports.add(specifier);
    }
  }
  const declared = new Set([
    ...Object.keys(npm.dependencies ?? {}),
    ...Object.keys(npm.peerDependencies ?? {}),
  ]);
  for (const specifier of imports) {
    const packageName = specifier.startsWith("@")
      ? specifier.split("/").slice(0, 2).join("/")
      : specifier.split("/")[0];
    if (!declared.has(packageName)) {
      findings.fail(
        `${name}: the dist imports ${specifier} and no dependency declares it`,
      );
    }
  }
  for (const dependency of declared) {
    const used = [...imports].some((specifier) =>
      specifier === dependency ||
      specifier.startsWith(dependency + "/")
    );
    if (!used) {
      findings.fail(
        `${name}: ${dependency} is declared and the dist never imports it`,
      );
    }
  }
}

async function main(): Promise<void> {
  const names = await publishablePackages();
  if (names.length === 0) {
    throw new Error("no publishable packages found");
  }
  const findings = new Findings();
  for (const name of names) {
    await checkPackage(name, findings);
  }
  if (findings.problems.length > 0) {
    for (const problem of findings.problems) console.error(problem);
    throw new Error(
      `${findings.problems.length} problem(s) between the manifests and the ` +
        `built packages`,
    );
  }
  console.log(
    `the export maps agree — ${names.length} packages, every subpath ` +
      `resolves, nothing extra ships`,
  );
}

if (import.meta.main) {
  await main();
}
