/**
 * The `.html → define()` stage shell: bundler hooks only.
 *
 * The pure transform (parse, emit, module rendering) lives in
 * `@spinjs/components/compiler`; the project tree (walk, prefix, dts)
 * lives in `../project/components.ts`. This module owns neither — only
 * the unplugin hooks that wire them into the bundler.
 */

import type { UnpluginOptions } from "unplugin";
import {
  renderComponentsModule,
  resolveIncludes,
  SPIN_COMPONENTS_ID,
  tagForProjectFile,
  transformMarkup,
  type ActionImports,
} from "@spinjs/components/compiler";
import {
  prefixForFile,
  projectComponentFiles,
  writeProjectComponentsDts,
} from "@spinjs/server/project";

/**
 * The `.html → define()` stage: compiles a component example into a
 * custom element. Consume names resolve beside the markup first (the
 * machine's own example) and fall back to `@spinjs/components`, so a
 * markup that lives outside the package needs no path option.
 */
export interface SpinComponentsOptions {
  /** Project directory holding user-authored `.html` components. Default `"src/lib/components"`. */
  readonly componentsDir?: string;
  /** Custom-element prefix for files under `componentsDir`. Defaults to the sanitized package name, else `"app"`. */
  readonly prefix?: string;
  /** Fallback prefix when no package name resolves. Default `"app"`. */
  readonly fallbackPrefix?: string;
}

export { SPIN_COMPONENTS_ID, tagForProjectFile };
export { projectComponentFiles, writeProjectComponentsDts };

export function spinComponentsStage(options: SpinComponentsOptions = {}): UnpluginOptions {
  const actionsDir = "actions";
  const componentsDir = options.componentsDir ?? "src/lib/components";
  let projectRoot = process.cwd();
  let cachedPrefix: string | undefined;
  const prefixOf = async (file: string): Promise<string> => {
    if (cachedPrefix !== undefined) return cachedPrefix;
    cachedPrefix = await prefixForFile(file, options);
    return cachedPrefix;
  };
  const isUnderDir = (file: string, dir: string): boolean =>
    file.split("/").join("/").includes(`/${dir}/`);
  const resolvedDirOf = async (): Promise<string> => {
    const { resolveProjectDir } = await import("@spinjs/server/project");
    return (await resolveProjectDir(projectRoot, componentsDir, "components")).path;
  };
  const writeDts = async (): Promise<void> => {
    await writeProjectComponentsDts(projectRoot, options);
  };
  return {
    name: "spin-components",
    enforce: "pre",
    vite: {
      configResolved(config: { root: string }): void {
        projectRoot = config.root;
      },
    },
    async buildStart() {
      await writeDts();
    },
    async resolveId(id, importer) {
      if (id === SPIN_COMPONENTS_ID || id === `\0${SPIN_COMPONENTS_ID}`) {
        return `\0${SPIN_COMPONENTS_ID}`;
      }
      if (
        id.startsWith("@spinjs/components/") && id.endsWith(".html")
      ) {
        const path = await import("node:path");
        const { createRequire } = await import("node:module");
        const machines = path.dirname(
          createRequire(import.meta.url).resolve("@spinjs/components"),
        );
        return `${path.join(machines, id.slice("@spinjs/components/".length))}?spin-component`;
      }
      if (
        (id.startsWith(`${componentsDir}/`) || id.startsWith(`/${componentsDir}/`)) &&
        id.endsWith(".html")
      ) {
        const path = await import("node:path");
        const rel = id.startsWith("/") ? id.slice(1) : id;
        return `${path.resolve(projectRoot, rel)}?spin-component`;
      }
      if (id.includes("?raw") || id.includes("?url")) return undefined;
      if (
        id === "index.html" ||
        id.endsWith("/index.html") ||
        id.endsWith("\\index.html")
      ) {
        return undefined;
      }
      if (
        id.endsWith(".html") && importer && !importer.includes("node_modules")
      ) {
        const path = await import("node:path");
        const real = path.resolve(path.dirname(importer.split("?")[0]!), id);
        return `${real}?spin-component`;
      }
      return undefined;
    },
    loadInclude(id) {
      return id.endsWith("?spin-component") || id === `\0${SPIN_COMPONENTS_ID}`;
    },
    async load(id) {
      if (id === `\0${SPIN_COMPONENTS_ID}`) {
        const files = await projectComponentFiles(projectRoot, componentsDir);
        return renderComponentsModule(files);
      }
      const real = id.split("?")[0]!;
      const path = await import("node:path");
      const fs = await import("node:fs/promises");
      const file = path.isAbsolute(real) ? real : path.resolve(projectRoot, real);
      return fs.readFile(file, "utf8");
    },
    transformInclude(id) {
      return id.endsWith("?spin-component");
    },
    async transform(source, id) {
      if (isUnderDir(id.split("?")[0]!, componentsDir)) void writeDts();
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const readFile = (file: string): Promise<string> => fs.readFile(file, "utf8");
      const code = await resolveIncludes(source, id, readFile);
      const file = id.split("?")[0]!;
      const stem = file.split("/").pop()!.replace(/\.html$/, "");
      const parentDir = file.split("/").slice(-2, -1)[0] ?? "";
      const grandparent = file.split("/").slice(-3, -2)[0] ?? "";
      const machine = parentDir === "examples"
        ? (grandparent.startsWith("spin-")
          ? grandparent.slice("spin-".length)
          : grandparent)
        : "";
      let tag: string;
      if (machine.length > 0) {
        tag = `${machine}-${stem}`;
      } else if (isUnderDir(file, componentsDir) || isUnderDir(file, await resolvedDirOf())) {
        tag = tagForProjectFile(file, await resolvedDirOf(), await prefixOf(file));
      } else {
        tag = stem;
      }
      const dir = file.split("/").slice(0, -1).join("/");
      const findActions = async (
        start: string,
      ): Promise<string | undefined> => {
        let current = start;
        for (let depth = 0; depth < 4; depth++) {
          try {
            const entries = await fs.readdir(path.join(current, actionsDir));
            void entries;
            return path.join(current, actionsDir);
          } catch {
          }
          const parent = path.dirname(current);
          if (parent === current) return undefined;
          current = parent;
        }
        return undefined;
      };
      const actionsPath = await findActions(dir);
      let actionImports = "";
      const actionNames: string[] = [];
      try {
        if (!actionsPath) throw new Error("no actions");
        const files = await fs.readdir(actionsPath);
        for (const f of files) {
          if (!f.endsWith(".action.ts")) continue;
          const mod = `./${path.relative(dir, actionsPath)}/${f}`;
          const src = await fs.readFile(path.join(actionsPath, f), "utf8");
          const names = [...src.matchAll(/export const (\w+)/g)].map((m) =>
            m[1]!
          );
          for (const name of names) {
            const alias = `${name}_${actionNames.length}`;
            actionImports += `import { ${name} as ${alias} } from ${
              JSON.stringify(mod)
            };\n`;
            actionNames.push(`${JSON.stringify(name)}: ${alias}`);
          }
        }
      } catch {
        // No actions directory: markup wires no actions.
      }
      const actions: ActionImports = { imports: actionImports, entries: actionNames };
      return { code: transformMarkup(code, { id, tag, actions }), map: null };
    },
  };
}

export default spinComponentsStage;
