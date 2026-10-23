import { createUnplugin } from "unplugin";
import { expandVariantGroups, extractScript, parse, parseScope, stripScript } from "@spin/runtime";
import { emit } from "./emit.ts";

export interface SpinElementsOptions {
  readonly actionsDir?: string;
  /**
   * Where the machines live, when the markup does not sit beside them.
   *
   * A consume name resolves by walking up from the markup, which finds
   * the machine when the markup is the machine's own example. A markup
   * that lives elsewhere — the playground's element, say — names the
   * root, and the machine is found under `<root>/spin-<name>/`.
   */
  readonly machines?: string;
}

const unplugin = createUnplugin<SpinElementsOptions | undefined>((raw) => {
  const options = raw ?? {};
  const actionsDir = options.actionsDir ?? "actions";
  const machinesRoot = options.machines;
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
      // The includes are resolved BEFORE the parse: the parser never
      // sees them, and the included file's body is inlined.
      const code = expandVariantGroups(
        (await resolveIncludes(source.replace(/<!--[\s\S]*?-->/g, ""), id)).code,
      );
      // A script block is the component's own TypeScript: extract it before
      // the parse, so the markup parser never sees it.
      const scriptSource = extractScript(code);
      const script = scriptSource === undefined ? undefined : stripScript(scriptSource);
      const markup = scriptSource === undefined
        ? code
        : code.replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>\s*/g, "");
      if (/<!doctype|<style[\s>]/i.test(markup)) {
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
      const ir = parse(markup);
      const { js } = emit(ir);
      const scopeDecls = parseScope(markup);
      // Script bindings: `const machine = slider({...})` — the machine is
      // a function, call it. Each binding becomes a bridge under its own
      // name, with the call's args object as the props seed. No coercion:
      // the checker guarantees the args.
      const scriptBindings = script?.calls ?? [];
      if (script !== undefined && scopeDecls.props.length > 0) {
        throw new Error(`spin-elements: ${id} has both <script> and <scope> props — the script replaces the scope`);
      }
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
      // Consume codegen: for each consume name, import the presentation by
      // convention (./<name>.presentation.ts), create the machine via the
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
      // Events: the presentation may declare `events` mapping a CustomEvent name
      // to the bridge's callback prop that fires it plus a detail mapper.
      // Each entry becomes a machine prop — `(details) => el.dispatchEvent(...)`
      // — so the bridge's own callback invocation is what emits. No
      // effect-watching, no diffing; the mapper is authored in the
      // presentation beside the machine whose callback it translates.
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
        const stems = [
          `${defStem}.presentation.ts`,
          `${defStem}.controller-def.ts`,
        ];
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
        if (defMod === undefined && machinesRoot !== undefined) {
          // A markup that does not sit beside its machine names the
          // machines root. The machine's DIRECTORY is not always named
          // after the consume (`cascade` lives in `spin-cascade-select`),
          // so the machine dirs are scanned for the file.
          const path = await import("node:path");
          let dirs: string[] = [];
          try {
            dirs = (await fs.readdir(machinesRoot)).filter((n) => n.startsWith("spin-"));
          } catch {
            // No machines root: the consume name is inert.
          }
          outer: for (const machine of dirs) {
            for (const stem of stems) {
              const candidate = path.join(machinesRoot, machine, stem);
              try {
                await fs.access(candidate);
                defMod = path.relative(dir, candidate).replace(/\.\//g, "./");
                if (!defMod.startsWith(".")) defMod = `./${defMod}`;
                break outer;
              } catch {
                // Next stem.
              }
            }
          }
        }
        if (defMod === undefined) {
          // Cross-machine consume: a name the walk-up misses may live in
          // a sibling machine dir (`spin-tags-input` consuming
          // `combobox`). Climb to the machine root (a dir holding
          // `spin-*`) and scan it before giving up.
          try {
            // Machine dirs have no dots; the machine's own recipe file
            // (`spin-tags-input.html`) matches the prefix and would stop
            // the climb one level short.
            const isMachineDir = (n: string): boolean => n.startsWith("spin-") && !n.includes(".");
            let root = dir;
            for (let depth = 0; depth < 6; depth++) {
              const names = await fs.readdir(root);
              if (names.some(isMachineDir)) break;
              const parent = path.dirname(root);
              if (parent === root) break;
              root = parent;
            }
            const names = await fs.readdir(root);
            if (!names.some(isMachineDir)) break;
            outer: for (const name of names) {
              if (!isMachineDir(name)) continue;
              for (const stem of stems) {
                try {
                  await fs.access(path.join(root, name, stem));
                  defMod = `./${path.relative(dir, path.join(root, name))}/${stem}`.replace("././", "./");
                  break outer;
                } catch {
                  // Next stem.
                }
              }
            }
          } catch {
            // No machine root: consume name is inert.
          }
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
      // Script imports pass through verbatim: the script names its
      // component, and the checker (not a convention walk) resolves it.
      // The `<script>` imports the callable presentation directly
      // (`../slider.presentation.ts`): the factory is the type source and
      // the runtime source, carrying `.createBridge`, `.commands`,
      // `.events`, and `.manifest`.
      const scriptImports: string[] = [];
      if (script !== undefined) {
        for (const m of script.module.matchAll(/^\s*import(?:\s|\{|\*)[\s\S]*?from\s*["'][^"']+["']\s*;?/gm)) {
          scriptImports.push(m[0].trim());
        }
      }
      // Script bindings become bridges under their own names. The script
      // calls the presentation's callable (typed args, checked by the gate);
      // the plugin pairs it with the same module for the bridge. The
      // presentation found the way consume finds defs: `<name>.presentation.ts`.
      const scriptCalls: string[] = [];
      if (script !== undefined) {
        for (const binding of scriptBindings) {
          const bridge = `${binding.name}Bridge`;
          const component = `${binding.factory}`;
          scriptCalls.push(
            `  const ${bridge}Events = Object.fromEntries(Object.entries(${component}.events ?? {}).map(([eventName, contract]) => [contract.on, (details) => { el.dispatchEvent(new CustomEvent(eventName, { detail: contract.detail(details), bubbles: true })); }]));\n` +
            `  const ${bridge}Props = () => { const p = { ...(${binding.args || "{}"}), ...${bridge}Events }; delete p["@@resolve"]; delete p["@@slots"]; p["@@authored"] = () => false; return p; };\n` +
            `  const ${bridge} = watch(${component}, () => ${component}.createBridge(${bridge}Props, () => el, el.id || uniqueId(${JSON.stringify(tag)})));\n` +
            `  values[${JSON.stringify(binding.name)}] = ${bridge}.api;\n` +
            `  provideController(el, () => controllerView(${bridge}.api, ${component}.commands));\n` +
            `  for (const command of ${component}.commands ?? []) el[command] = (...args) => ${bridge}.api[command](...args);\n` +
            `  own(() => ${bridge}.dispose());`
          );
        }
      }
      const hasConsume = consumeCalls.length > 0 || scriptCalls.length > 0;
      const propNames = scopeDecls.props.map((p) => p.name);
      const hasProps = propNames.length > 0;
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
        "object-array": "object[]",
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
      // The generated define references `P` whenever a prop type has a parser,
      // so the import covers that case too, not just consume.
      const runtimeImport = hasConsume || attributeEntries.length > 0
        ? `import { attrParsers as P, define, coerceProps, own, uniqueId, projectSlots, controllerView, provideController } from "@spin/runtime";`
        : `import { define, coerceProps, projectSlots } from "@spin/runtime";`;
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
          ...scriptImports,
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
          ...scriptCalls,
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

/**
 * The includes in a markup: `<include file="./_markup.html" />`.
 *
 * A family's markup lives ONCE, and its examples are that markup with
 * their own parameters. The include is resolved textually, before the
 * parse, so the parser never sees it: the included file's body is
 * inlined, and the INCLUDING file's scope decl stands (the included
 * file's own scope decl is dropped — it is the family's, and the
 * example's is narrower).
 */
async function resolveIncludes(
  source: string,
  id: string,
): Promise<{ readonly code: string }> {
  const file = id.split("?")[0]!;
  const dir = file.split("/").slice(0, -1).join("/");
  let code = source;
  // A family nests its examples one level, so an include may reach up.
  for (let pass = 0; pass < 8; pass += 1) {
    const m = /<include\s+file="([^"]+)"\s*\/?>/.exec(code);
    if (m === null) break;
    const target = m[1]!;
    const path = target.startsWith("/")
      ? target.slice(1)
      : `${dir}/${target}`;
    const resolved = path.split("/").reduce((parts, part) => {
      if (part === "..") return parts.slice(0, -1);
      if (part === ".") return parts;
      return [...parts, part];
    }, [] as string[]).join("/");
    let included: string;
    try {
      // The plugin runs in the app's runtime (Node, Bun, Deno), so the
      // file is read the way the other hooks read it.
      const fs = await import("node:fs/promises");
      included = await fs.readFile(resolved, "utf8");
    } catch {
      throw new Error(`spin-elements: ${id} includes ${target}, which is not there`);
    }
    // The included file's scope or script decl is the family's; the
    // example's stands. Only the BODY is shared.
    const body = included
      .replace(/<scope>[\s\S]*?<\/scope>\s*/, "")
      .replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>\s*/, "");
    code = code.replace(m[0], body);
  }
  return { code };
}

export const spinElements = unplugin.vite;
export const spinElementsRollup = unplugin.rollup;
export const spinElementsEsbuild = unplugin.esbuild;
export default unplugin;
