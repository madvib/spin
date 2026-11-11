/**
 * The project's component tree on disk: discovery, tags, and the dts writer.
 *
 * Project-owned: `spin init` writes the dts, the bundler stage refreshes
 * it, and the components procedures read it — all three through here, so
 * the walk, the prefix, and the tag derivation cannot disagree.
 */

import {
  renderComponentsDts as renderTagsDts,
  tagForProjectFile,
} from "@spinjs/components/compiler";
import { resolveProjectDir } from "./resolve-dir.ts";

/** The options that locate a project's components. */
export interface ProjectComponentsOptions {
  /** Project directory holding user-authored `.html` components. Default `"src/lib/components"`. */
  readonly componentsDir?: string;
  /** Custom-element prefix for files under `componentsDir`. Defaults to the sanitized package name, else `"app"`. */
  readonly prefix?: string;
  /** Fallback prefix when no package name resolves. Default `"app"`. */
  readonly fallbackPrefix?: string;
}

/** Every `.html` component under a directory, relative to the project root. */
export async function projectComponentFiles(
  root: string,
  componentsDir: string,
): Promise<string[]> {
  const path = await import("node:path");
  const fs = await import("node:fs/promises");
  const resolved = await resolveProjectDir(root, componentsDir, "components");
  if (resolved.file) {
    return resolved.path.endsWith(".html")
      ? [path.relative(root, resolved.path).split(path.sep).join("/")]
      : [];
  }
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith(".html")) {
        out.push(path.relative(root, full).split(path.sep).join("/"));
      }
    }
  };
  await walk(resolved.path);
  return out.sort();
}

const sanitizePrefix = (raw: string): string => {
  let base = raw;
  const slash = base.lastIndexOf("/");
  if (slash >= 0) base = base.slice(slash + 1);
  const out = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return out === "" || out === "workspace" ? "app" : out;
};

/** The prefix a file's nearest named manifest declares, or `"app"`. */
export async function prefixForFile(
  file: string,
  options: ProjectComponentsOptions = {},
): Promise<string> {
  if (options.prefix !== undefined) return options.prefix;
  if (options.fallbackPrefix !== undefined) return options.fallbackPrefix;
  try {
    const path = await import("node:path");
    const fs = await import("node:fs/promises");
    let dir = path.dirname(file);
    for (let depth = 0; depth < 6; depth++) {
      try {
        const raw = await fs.readFile(path.join(dir, "package.json"), "utf8");
        const manifest: unknown = JSON.parse(raw);
        const name = typeof manifest === "object" && manifest !== null && "name" in manifest
          ? (manifest as { name?: unknown }).name
          : undefined;
        if (typeof name === "string" && name.length > 0) {
          return sanitizePrefix(name);
        }
      } catch {
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
  }
  return "app";
}

const PRIMITIVE_CUSTOM_TAGS = [
  "alert",
  "badge",
  "breadcrumbs",
  "card",
  "card-action",
  "card-content",
  "card-description",
  "card-figure",
  "card-footer",
  "card-header",
  "card-title",
  "checkbox",
  "field",
  "icon",
  "join",
  "panel",
  "panel-list",
  "prose",
  "radio",
  "range",
  "skeleton",
  "stat",
  "swatch",
  "tooltip",
] as const;

/** The project's component tags and Spin primitive tags as JSX types. */
export function renderComponentsDts(tags: readonly string[]): string {
  return renderTagsDts([...PRIMITIVE_CUSTOM_TAGS, ...tags]);
}

/** Write or refresh `src/spin-components.d.ts` (or `src/lib/components/components.d.ts` during build). */
export async function writeProjectComponentsDts(
  projectRoot: string,
  options: ProjectComponentsOptions = {},
  mode: { readonly onlyIfSrcExists?: boolean } = {},
): Promise<void> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const componentsDir = options.componentsDir ?? "src/lib/components";
  let srcIsDir = false;
  try {
    srcIsDir = (await fs.stat(path.join(projectRoot, "src"))).isDirectory();
  } catch {
    srcIsDir = false;
  }
  if (mode.onlyIfSrcExists && !srcIsDir) return;
  const files = await projectComponentFiles(projectRoot, componentsDir);
  const probe = files.length > 0
    ? `${projectRoot}/${files[0]}`
    : `${projectRoot}/package.json`;
  const prefix = await prefixForFile(probe, options);
  const resolved = (await resolveProjectDir(projectRoot, componentsDir, "components")).path;
  const tags = files.map((file) =>
    tagForProjectFile(`${projectRoot}/${file}`, resolved, prefix)
  );
  const body = renderComponentsDts(tags);
  const same = async (file: string): Promise<boolean> => {
    try {
      return (await fs.readFile(file, "utf8")) === body;
    } catch {
      return false;
    }
  };
  if (srcIsDir) {
    const out = path.join(projectRoot, "src", "spin-components.d.ts");
    if (!(await same(out))) await fs.writeFile(out, body);
    return;
  }
  const out = path.join(resolved, "components.d.ts");
  if (!(await same(out))) await fs.writeFile(out, body);
}
