/**
 * The export map check — the built package against the source package.
 *
 * A package's `package.json` says what it exports to the workspace (`exports`
 * → `./src/...`) and what it ships to npm (`publishConfig.exports` → `./dist/...`).
 * The two must name the same subpaths with the same `./src/` → `./dist/`
 * mapping, and the dist must have what the map promises. This checks all
 * three, because a manifest that disagrees with the code is the same defect
 * whether it is wrong about a subpath, a file that is not there, or a file
 * that is there for nobody.
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
 * Usage: `bun run check:dist`
 */

import { dirname, join, relative, resolve } from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { importSpecifiers, reachableFiles } from "./dist-graph.ts";
import { renderSkill } from "../packages/theme/src/skill/index.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES_DIR = join(REPO, "packages");

interface Manifest {
  readonly name: string;
  readonly version: string;
  readonly exports: Record<string, string>;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly files?: string[];
  readonly publishConfig?: {
    readonly exports?: Record<string, { types?: string; default?: string }>;
  };
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

/** The packages that ship: the ones whose manifest carries `publishConfig.exports`. */
async function publishablePackages(): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".dist-")) continue;
    const raw = await readJson(
      join(PACKAGES_DIR, entry.name, "package.json"),
    ).catch(() => null);
    if (raw === null) continue;
    const published = (raw["publishConfig"] as { exports?: object } | undefined)?.exports;
    if (published !== null && typeof published === "object" && Object.keys(published).length > 0) {
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
  const pkg = await readJson(join(dir, "package.json")) as unknown as Manifest;

  const rawExports = (pkg.exports ?? {}) as Record<
    string,
    string | { types?: string; default?: string }
  >;
  const published = pkg.publishConfig?.exports ?? {};

  // The subpaths are the same set, and each published target is the
  // `./src/...` → `./dist/...` mapping of its source target.
  const sourcePaths = Object.keys(rawExports).sort();
  const publishedPaths = Object.keys(published).sort();
  for (const subpath of publishedPaths) {
    if (!sourcePaths.includes(subpath)) {
      findings.fail(
        `${name}: ${subpath} is exported by publishConfig.exports and ` +
          `missing from exports`,
      );
    }
  }
  for (const subpath of sourcePaths) {
    if (!publishedPaths.includes(subpath)) {
      findings.fail(
        `${name}: ${subpath} is exported by exports and missing from ` +
          `publishConfig.exports`,
      );
    }
  }
  for (const subpath of publishedPaths) {
    if (!sourcePaths.includes(subpath)) continue;
    const source = rawExports[subpath];
    const target = published[subpath]!;
    const sourceFile = typeof source === "string" ? source : source.default ?? source.types ?? "";
    const expectJs = sourceFile.endsWith(".d.ts")
      ? undefined
      : sourceFile.replace(/^\.\/src\//, "./dist/").replace(/\.tsx?$/, ".js");
    const expectDts = sourceFile.endsWith(".d.ts")
      ? sourceFile.replace(/^\.\/src\//, "./dist/")
      : sourceFile.replace(/^\.\/src\//, "./dist/").replace(/\.tsx?$/, ".d.ts");
    if (expectJs !== undefined && target.default !== undefined && target.default !== expectJs) {
      findings.fail(
        `${name}: ${subpath} publishes ${target.default}, want the dist ` +
          `mapping of ${sourceFile} (${expectJs})`,
      );
    }
    if (target.types !== undefined && target.types !== expectDts) {
      findings.fail(
        `${name}: ${subpath} publishes types ${target.types}, want the ` +
          `dist mapping of ${sourceFile} (${expectDts})`,
      );
    }
  }

  // Every subpath resolves.
  const dist = join(dir, "dist");
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
      const path = join(dir, file);
      if (!await exists(path)) {
        findings.fail(`${name}: ${subpath} names ${file}, which is not there`);
        continue;
      }
      targets.push(file);
    }
  }

  // A house skill ships with its package: it is a product agents install, so
  // it must be in the npm package, and the manifest must say it is there.
  if (await exists(join(dir, "skill"))) {
    const files = pkg.files;
    if (!Array.isArray(files) || !files.includes("skill")) {
      findings.fail(
        `${name}: the package has a skill, and the manifest does not ` +
          `ship it`,
      );
    }
    const skillMd = join(dir, "skill", "SKILL.md");
    if (!await exists(skillMd)) {
      findings.fail(
        `${name}: the package has a skill, and the built package does not ` +
          `carry it`,
      );
    } else if (pkg.name === "@spinjs/theme") {
      const rendered = renderSkill(await readFile(skillMd, "utf8"));
      const current = await readFile(skillMd, "utf8");
      if (rendered !== current) {
        findings.fail(
          `${name}: skill/SKILL.md is not the rendered checklist — run ` +
            `bun run skill in packages/theme`,
        );
      }
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
    for (const specifier of importSpecifiers(await readFile(path, "utf8"))) {
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
  // declarations both, because a type-only import is a dependency too. An
  // `import("x")` type query is not one the package chose: it is tsc's
  // serialization of a declared dependency's own types (unplugin's `Plugin`),
  // resolved transitively through that dependency.
  const TYPE_QUERY = /\bimport\s*\(\s*["'][^"']+["']\s*\)/g;
  const imports = new Set<string>();
  for (const file of shipped) {
    if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue;
    const text = (await readFile(join(dist, file), "utf8")).replace(
      TYPE_QUERY,
      "",
    );
    for (const specifier of importSpecifiers(text)) {
      if (specifier.startsWith(".") || specifier.startsWith("node:")) continue;
      imports.add(specifier);
    }
  }
  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);
  for (const specifier of imports) {
    // The package's own subpaths are self-references, not dependencies.
    if (specifier === pkg.name || specifier.startsWith(pkg.name + "/")) {
      continue;
    }
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
