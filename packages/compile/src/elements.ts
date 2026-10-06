import { createUnplugin } from "unplugin";
import { parse } from "@spin/runtime";
import { emit } from "./emit.ts";

export interface SpinElementsOptions {
  readonly actionsDir?: string;
}

const unplugin = createUnplugin<SpinElementsOptions | undefined>((raw) => {
  const options = raw ?? {};
  const actionsDir = options.actionsDir ?? "actions";
  return {
    name: "spin-elements",
    enforce: "pre",
    async resolveId(id, importer) {
      if (id.endsWith(".html") && importer && !importer.includes("node_modules")) {
        const path = await import("node:path");
        const real = path.resolve(path.dirname(importer.split("?")[0]!), id);
        return `${real}?spin-element`;
      }
      return undefined;
    },
    loadInclude(id) {
      return id.endsWith("?spin-element");
    },
    async load(id) {
      const real = id.split("?")[0]!;
      const fs = await import("node:fs/promises");
      return fs.readFile(real, "utf8");
    },
    transformInclude(id) {
      return id.endsWith("?spin-element");
    },
    async transform(code, id) {
      if (/<!doctype|<script[\s>]|<style[\s>]/i.test(code)) {
        throw new Error(`spin-elements: ${id} looks like a document, not a component`);
      }
      const file = id.split("?")[0]!;
      const tag = file.split("/").pop()!.replace(/\.html$/, "");
      const dir = file.split("/").slice(0, -1).join("/");
      const { parse: parseMod } = await import("@spin/runtime");
      void parseMod;
      const ir = parse(code);
      const { js } = emit(ir);
      const body = js
        .replace(/^import .*$/m, 'import { runAction, on, bindAttr, bindText, bindFor, text, bindZag, bindActionProps } from "@spin/runtime";')
        .replace(/^void _bt;$/m, "")
        .replace(/export function create\(ctx, actions\) \{/, "export function create(actions, values) {")
        .replace(/void ctx;\n/, "");
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const findActions = async (start: string): Promise<string | undefined> => {
        let current = start;
        for (let depth = 0; depth < 4; depth++) {
          try {
            const entries = await fs.readdir(path.join(current, actionsDir));
            void entries;
            return path.join(current, actionsDir);
          } catch {
            // Walk up: elements/accordion-root.html looks beside itself,
            // then in the component directory above.
          }
          const parent = path.dirname(current);
          if (parent === current) return undefined;
          current = parent;
        }
        return undefined;
      };
      const actionsPath = await findActions(dir);
      let actionImports = "";
      let actionNames: string[] = [];
      try {
        if (!actionsPath) throw new Error("no actions");
        const files = await fs.readdir(actionsPath);
        for (const f of files) {
          if (!f.endsWith(".action.ts")) continue;
          const mod = `./${path.relative(dir, actionsPath)}/${f}`;
          const src = await fs.readFile(path.join(actionsPath, f), "utf8");
          const names = [...src.matchAll(/export const (\w+)/g)].map((m) => m[1]!);
          for (const name of names) {
            const alias = `${name}_${actionNames.length}`;
            actionImports += `import { ${name} as ${alias} } from ${JSON.stringify(mod)};\n`;
            actionNames.push(`${JSON.stringify(name)}: ${alias}`);
          }
        }
      } catch {
        // No actions directory: markup wires no actions.
      }
      return {
        code: [
          `import { define } from "@spin/runtime";`,
          actionImports,
          `const actions = { ${actionNames.join(", ")} };`,
          body,
          `/* spin-elements v2 ${tag} */`,
          `define(${JSON.stringify(tag)}, { build({ el }) {`,
          `  const values = {};`,
          `  for (const name of el.getAttributeNames()) {`,
          `    const camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());`,
          `    values[name] = el.getAttribute(name);`,
          `    values[camel] = el.getAttribute(name);`,
          `  }`,
          `  const { nodes } = create(actions, values, el);`,
          `  for (const node of nodes) el.appendChild(node);`,
          `} });`,
          `export default ${JSON.stringify(tag)};`,
        ].join("\n"),
        map: null,
      };
    },
  };
});

export const spinElements = unplugin.vite;
export const spinElementsRollup = unplugin.rollup;
export const spinElementsEsbuild = unplugin.esbuild;
export default unplugin;
