import { createUnplugin } from "unplugin";
import { expandVariantGroups, parse, parseScope } from "@spin/runtime";
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
      // `?raw` / `?url` imports want the file, not the element: the
      // reference app reads example sources as text through globs.
      if (id.includes("?raw") || id.includes("?url")) return undefined;
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
    async transform(source, id) {
      // Example notes live in HTML comments (rendered in the code tab);
      // they are source-only and never reach the IR.
      const code = expandVariantGroups(source.replace(/<!--[\s\S]*?-->/g, ""));
      if (/<!doctype|<script[\s>]|<style[\s>]/i.test(code)) {
        throw new Error(`spin-elements: ${id} looks like a document, not a component`);
      }
      const file = id.split("?")[0]!;
      const stem = file.split("/").pop()!.replace(/\.html$/, "");
      // A bare stem (`basic.html`) is not a valid custom element name, and
      // examples live under their machine dir: qualify with the parent
      // (`spin-tree-view/examples/basic.html` → `tree-view-basic`).
      // Recipes (`spin-*.html`) already carry their tag in the filename.
      // The machine dir is the grandparent: examples nest one level
      // (`spin-tree-view/examples/basic.html` → `tree-view-basic`).
      const grandparent = file.split("/").slice(-3, -2)[0] ?? "";
      const machine = grandparent.startsWith("spin-") ? grandparent.slice("spin-".length) : "";
      // Examples always qualify (`basic` → `tree-view-basic`): the mount
      // tag derives the same way, so the two can never disagree the way a
      // "valid names pass through" rule lets dashed stems disagree.
      const tag = machine.length > 0 ? `${machine}-${stem}` : stem;
      const dir = file.split("/").slice(0, -1).join("/");
      const { parse: parseMod } = await import("@spin/runtime");
      void parseMod;
      const ir = parse(code);
      const { js } = emit(ir);
      const scopeDecls = parseScope(code);
      const body = js
        .replace(/^export function create\(ctx, actions\) \{/, "export function create(actions, values) {")
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
      // scope table's watch, and expose the bridge under the consume NAME
      // (values.tabs), never a bare `api`. Two machines mean two names; a
      // bare shorthand would alias whichever ran last and strand the other.
      // Props are the coerced values minus each consume name and the reserved
      // `@@resolve` key, which are codegen-internal and never machine props.
      // They are handed over as a getter, not a snapshot: the bridge reads
      // props on demand, and a snapshot would strand post-build property
      // writes. `values` is already live — each declared prop is a getter
      // over the element's prop store (the `seedProps` block below), so a
      // property write reaches the machine. Coercion stays at build time
      // (`values` starts as `coerceProps(...)`); a live read is signal reads
      // plus a shallow copy, never a per-read JSON.parse.
      // Events: a machine-def may declare `events` mapping a CustomEvent name
      // to the bridge's callback prop that fires it plus a detail mapper.
      // Each entry becomes a machine prop — `(details) => el.dispatchEvent(...)`
      // — so the bridge's own callback invocation is what emits. No
      // effect-watching, no diffing; the mapper is authored in the
      // machine-def beside the machine whose callback it translates.
      const consumeImports: string[] = [];
      const consumeCalls: string[] = [];
      const consumeDeletes = scopeDecls.consume
        .map((name) => `delete p[${JSON.stringify(name)}];`)
        .join(" ");
      for (const name of scopeDecls.consume) {
        // The def file is named for the COMPONENT (kebab, like the directory
        // and the tag); the consume name is the export (camel). Resolve the
        // path through the same dash mapping the attribute spellings use, or
        // a camelCase consume name never finds its def and the element
        // silently mounts without its machine. A `.controller-def.ts` is the
        // platform tier: same slot, no machine.
        const defStem = name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
        const stems = [`${defStem}.machine-def.ts`, `${defStem}.controller-def.ts`];
        // Examples live in `<machine>/examples/`, one level below the def:
        // look beside the file first, then walk up like actions do.
        let defMod: string | undefined;
        let walk = dir;
        for (let depth = 0; depth < 4; depth++) {
          let hit = false;
          for (const stem of stems) {
            try {
              await fs.access(path.join(walk, stem));
              defMod = `./${path.relative(dir, walk)}/${stem}`.replace("././", "./");
              hit = true;
              break;
            } catch {
              // Next stem.
            }
          }
          if (hit) break;
          const parent = path.dirname(walk);
          if (parent === walk) break;
          walk = parent;
        }
        if (defMod === undefined) {
          // No def file: consume name is inert.
          continue;
        }
        {
          const found = defMod;
          consumeImports.push(`import { ${name} } from ${JSON.stringify(found)};`);
          const bridge = `${name}Bridge`;
          consumeCalls.push(
            `  const ${bridge}Events = Object.fromEntries(Object.entries(${name}.events ?? {}).map(([eventName, contract]) => [contract.on, (details) => { el.dispatchEvent(new CustomEvent(eventName, { detail: contract.detail(details), bubbles: true })); }]));\n` +
            `  const ${bridge}Props = () => { const p = { ...values, ...${bridge}Events }; ${consumeDeletes} delete p["@@resolve"]; delete p["@@slots"]; p["@@authored"] = (name) => typeof authored === "function" && authored(name); return p; };\n` +
            `  const ${bridge} = watch(${name}, () => "createBridge" in ${name}\n` +
            `    ? ${name}.createBridge(${bridge}Props, () => el, el.id || uniqueId(${JSON.stringify(tag)}))\n` +
            `    : { api: ${name}.attach(el), dispose() {} });\n` +
            `  values[${JSON.stringify(name)}] = ${bridge}.api;\n` +
            // The controller surface for app controllers: the api's reads as
            // reactive state, the declared commands as calls.
            `  provideController(el, () => controllerView(${bridge}.api, ${name}.commands));\n` +
            `  for (const command of ${name}.commands ?? []) el[command] = (...args) => ${bridge}.api[command](...args);\n` +
            `  own(() => ${bridge}.dispose());`
          );
        }
      }
      const hasConsume = consumeCalls.length > 0;
      const propNames = scopeDecls.props.map((p) => p.name);
      const hasProps = propNames.length > 0;
      const runtimeImport = hasConsume
        ? `import { attrParsers as P, define, coerceProps, own, uniqueId, projectSlots, controllerView, provideController } from "@spin/runtime";`
        : `import { define, coerceProps, projectSlots } from "@spin/runtime";`;
      const buildParams = [hasConsume ? "el, watch, authored" : "el", hasProps ? "props" : ""]
        .filter((p) => p.length > 0)
        .join(", ");
      // Declared props are ALSO observed attributes: a framework's string
      // prop (Solid sets strings as attributes) and any post-connect
      // setAttribute must land in the same live prop a property write
      // reaches. The parsers come from the runtime, so the initial coerced
      // path and the observed path cannot drift.
      const PARSER_NAMES: Record<string, string> = {
        bool: "bool",
        string: "string",
        int: "int",
        "string[]": "string[]",
        "object[]": "object[]",
      };
      const attributeEntries: string[] = [];
      for (const decl of scopeDecls.props) {
        const parser = PARSER_NAMES[decl.type];
        if (!parser) continue;
        // Both spellings: author HTML is dashed, but a framework that writes
        // attributes verbatim (Solid's custom-element handling) writes the
        // camelCase name, and an unobserved spelling is a silent no-op.
        const dashed = decl.name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
        const entry = `${JSON.stringify(dashed)}: P[${JSON.stringify(parser)}]`;
        attributeEntries.push(entry);
        if (dashed !== decl.name) attributeEntries.push(`${JSON.stringify(decl.name)}: P[${JSON.stringify(parser)}]`);
      }
      const attributeDecl = attributeEntries.length > 0
        ? ` attributes: { ${attributeEntries.join(", ")} },`
        : "";
      const defineHead = hasProps
        ? `define(${JSON.stringify(tag)}, { props: ${JSON.stringify(propNames)},${attributeDecl} build({ ${buildParams} }) {`
        : `define(${JSON.stringify(tag)}, {${attributeDecl} build({ ${buildParams} }) {`;
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
          // Light-DOM children are projected BEFORE create(): the markup's
          // `<slot>` points resolve against this map. Reserved like
          // `@@resolve` — never a machine prop (see the deletes above).
          `  values["@@slots"] = projectSlots(el);`,
          `  const { nodes } = create(actions, values, el);`,
          `  for (const node of nodes) el.appendChild(node);`,
          `} });`,
          // Example modules cannot hot-swap: the tag is already defined and
          // the define guard keeps the first registration, so an edit would
          // serve stale markup forever. Invalidate (full reload) instead.
          ...(file.includes("/examples/") ? [`if (import.meta.hot) import.meta.hot.invalidate();`] : []),
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
