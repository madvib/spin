import { describe, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../../..");

interface Manifest {
  readonly name: string;
  readonly exports?: Readonly<Record<string, unknown>>;
  readonly main?: string;
}

/**
 * Every workspace package the docs copy may name. `internal/check` is here
 * because the rendered-check page documents its internal import; it is not
 * published, and the page says so.
 */
function manifests(): ReadonlyMap<string, Manifest> {
  const out = new Map<string, Manifest>();
  const packageDirs = readdirSync(resolve(ROOT, "packages"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(ROOT, "packages", entry.name, "package.json"));
  packageDirs.push(resolve(ROOT, "internal/check/package.json"));
  for (const file of packageDirs) {
    const manifest = JSON.parse(readFileSync(file, "utf8")) as Manifest;
    out.set(manifest.name, manifest);
  }
  return out;
}

interface Mention {
  readonly pkg: string;
  readonly subpath: string;
}

function mentions(text: string): readonly Mention[] {
  const found = new Map<string, Mention>();
  // A `node_modules/@scope/name/...` path is a file on disk, not an import
  // specifier — the copy commands name files, not subpath exports.
  const stripped = text.replaceAll(/node_modules\/@[a-z0-9][a-z0-9-]*\/[a-z0-9./*-]+/g, "");
  for (const specifier of stripped.match(/@[a-z0-9][a-z0-9-]*\/[a-z0-9./-]+/g) ?? []) {
    const [scope, name, ...rest] = specifier.split("/");
    const pkg = `${scope}/${name}`;
    found.set(specifier, { pkg, subpath: rest.join("/") });
  }
  return [...found.values()];
}

describe("docs content package mentions", () => {
  test("every named package and subpath exists in the workspace", () => {
    const available = manifests();
    const dir = resolve(import.meta.dir, "content");
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const text = readFileSync(resolve(dir, file), "utf8");
      for (const { pkg, subpath } of mentions(text)) {
        // The gate owns Spin's surface; other projects' packages are theirs.
        if (!pkg.startsWith("@spinjs/") && !pkg.startsWith("@spin/")) continue;
        const manifest = available.get(pkg);
        if (manifest === undefined) {
          throw new Error(`${file} names missing package ${pkg}`);
        }
        if (subpath !== "") {
          if (manifest.exports?.[`./${subpath}`] === undefined) {
            throw new Error(
              `${file} names ${pkg}/${subpath}, which is not an export`,
            );
          }
        }
      }
    }
  });
});
