import { createUnplugin } from "unplugin";
import { parse, parseScope } from "@spin/runtime";
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
      const scopeDecls = parseScope(code);
      const body = js
        .replace(/^import .*$/m, 'import { runAction, on, bindAttr, bindText, bindFor, text, bindActionProps, bindSpread } from "@spin/runtime";')
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
      const actionNames: string[] = [];
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
      // Consume codegen: for each consume name, import the machine-def by
      // convention (./<name>.machine-def.ts), create the machine via the
      // scope table's watch (which registers it for named resolution and
      // handles disposal), and set values.api as the own-machine shorthand.
      // Props are the coerced values minus the reserved `api` and `@@resolve`
      // keys, which are codegen-internal and never machine props. They are
      // handed over as a getter, not a snapshot: Zag reads props on every
      // transition, and the adapter's `resolvedProps` computed only re-runs
      // when a read inside it tracks. `values` is already live — each declared
      // prop is a getter over the element's prop store (the `seedProps` block
      // below), so a property write reaches the machine. Coercion stays at
      // build time (`values` starts as `coerceProps(...)`); a live read is
      // signal reads plus a shallow copy, never a per-read JSON.parse.
      // Events: a machine-def may declare `events` mapping a CustomEvent name
      // to the Zag callback prop that fires it plus a detail mapper. Each
      // entry becomes a machine prop — `(details) => el.dispatchEvent(...)` —
      // so Zag's own callback invocation is what emits. No effect-watching,
      // no diffing; the mapper is authored in the machine-def beside the
      // machine whose callback it translates.
      const consumeImports: string[] = [];
      const consumeCalls: string[] = [];
      for (const name of scopeDecls.consume) {
        const defFile = path.join(dir, `${name}.machine-def.ts`);
        try {
          await fs.access(defFile);
          const defMod = `./${name}.machine-def.ts`;
          consumeImports.push(`import { ${name} } from ${JSON.stringify(defMod)};`);
          const bridge = `${name}Bridge`;
          consumeCalls.push(
            `  const ${bridge}Events = Object.fromEntries(Object.entries(${name}.events ?? {}).map(([eventName, contract]) => [contract.on, (details) => { el.dispatchEvent(new CustomEvent(eventName, { detail: contract.detail(details), bubbles: true })); }]));\n` +
            `  const ${bridge} = watch(${name}, () => createMachine(${name}.machine, {\n` +
            `    connect: ${name}.connect,\n` +
            `    normalize: normalizeProps,\n` +
            `    props: () => { const p = { ...values, ...(${name}.toMachineProps?.(values) ?? {}), ...${bridge}Events }; delete p.api; delete p["@@resolve"]; return p; },\n` +
            `    getRootNode: () => el.getRootNode(),\n` +
            `    id: el.id || uniqueId(${JSON.stringify(tag)}),\n` +
            `  }));\n` +
            `  values.api = ${bridge}.api;\n` +
            `  own(() => ${bridge}.dispose());`
          );
        } catch {
          // No machine-def file: consume name is inert.
        }
      }
      const hasConsume = consumeCalls.length > 0;
      const propNames = scopeDecls.props.map((p) => p.name);
      const hasProps = propNames.length > 0;
      const runtimeImport = hasConsume
        ? `import { define, coerceProps, own, uniqueId } from "@spin/runtime";`
        : `import { define, coerceProps } from "@spin/runtime";`;
      const zagImport = hasConsume
        ? `import { createMachine, normalizeProps } from "@spin/runtime/zag";`
        : "";
      const buildParams = [hasConsume ? "el, watch" : "el", hasProps ? "props" : ""]
        .filter((p) => p.length > 0)
        .join(", ");
      const defineHead = hasProps
        ? `define(${JSON.stringify(tag)}, { props: ${JSON.stringify(propNames)}, build({ ${buildParams} }) {`
        : `define(${JSON.stringify(tag)}, { build({ ${buildParams} }) {`;
      // A declared prop is a live read of the element's prop store; the
      // attribute/coerced value is the initial path, so a property write —
      // before or after connection — wins over the attribute.
      const seedProps = hasProps
        ? [
          `  for (const name of ${JSON.stringify(propNames)}) {`,
          `    Object.defineProperty(values, name, {`,
          `      enumerable: true,`,
          `      configurable: true,`,
          `      get: () => { const live = props[name]; return live === undefined ? initial[name] : live; },`,
          `    });`,
          `  }`,
        ]
        : [];
      return {
        code: [
          runtimeImport,
          zagImport,
          actionImports,
          ...consumeImports,
          `const actions = { ${actionNames.join(", ")} };`,
          body,
          `/* spin-elements v2 ${tag} */`,
          defineHead,
          `  const attrs = {};`,
          `  for (const name of el.getAttributeNames()) {`,
          `    const camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());`,
          `    attrs[name] = el.getAttribute(name);`,
          `    attrs[camel] = el.getAttribute(name);`,
          `  }`,
          `  const initial = coerceProps(${JSON.stringify(scopeDecls.props)}, attrs);`,
          `  const values = { ...initial };`,
          ...seedProps,
          ...consumeCalls,
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
