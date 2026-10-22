/**
 * The script gate: every example's <script> block typechecks.
 *
 * The plugin extracts and codegens scripts without checking them (fast
 * path — the transform runs on every build). This gate is the slow path:
 * it synthesizes a virtual module per example — the stripped script
 * written beside the example so its relative imports resolve — and runs
 * tsc --noEmit over the set. A mistyped machine arg is a build error
 * here, not a silent runtime wrong-value.
 *
 *   deno run -A scripts/script-check.ts
 *
 * The exit code is the point: this belongs beside `deno check`, not in a
 * human's memory of which args are typed.
 */

import { walk } from "@std/fs/walk";
import { extractScript, parse, stripScript, type Node } from "../packages/syntax/src/index.ts";

const ROOT = new URL("..", import.meta.url).pathname;

function emitTemplateChecks(nodes: readonly Node[], out: string[]): void {
  for (const node of nodes) {
    if (node.kind === "text") {
      for (const part of node.parts) {
        if (part.kind === "expr") out.push(`void (${part.expr});`);
      }
      continue;
    }
    if (node.kind === "for") {
      out.push(`for (const ${node.binding} of (${node.source})) {`);
      if (node.key !== undefined) out.push(`void (${node.key});`);
      emitTemplateChecks(node.body, out);
      out.push(`}`);
      continue;
    }
    if (node.show !== undefined) out.push(`void Boolean(${node.show});`);
    for (const attr of node.attrs) {
      if (attr.value.kind === "expr") out.push(`void (${attr.value.expr});`);
    }
    for (const ev of node.events) out.push(`void (${ev.handler});`);
    for (const use of node.actions) {
      if (use.param !== undefined) out.push(`void (${use.param});`);
    }
    for (const spread of node.spreads) {
      out.push(`{ const __bag: Record<string, unknown> = (${spread.expr}); void __bag; }`);
    }
    emitTemplateChecks(node.children, out);
  }
}

async function main(): Promise<void> {
  const modules: string[] = [];
  const failures: string[] = [];
  try {
    for await (const entry of walk(ROOT + "packages/components/src", { exts: [".html"] })) {
      if (!entry.isFile) continue;
      const source = await Deno.readTextFile(entry.path);
      const body = extractScript(source);
      if (body === undefined) continue;
      const stripped = stripScript(body);
      if (stripped.stripped.length > 0) {
        failures.push(
          `${entry.path}: script has stripped statements (effects?):\n    ${stripped.stripped.join("\n    ")}`,
        );
      }
      const componentImports: string[] = [];
      const templateAliases: string[] = [];
      for (const call of stripped.calls) {
        for (const m of stripped.module.matchAll(
          new RegExp(`import\\s*\\{[\\s\\S]*?\\b${call.factory}\\b[\\s\\S]*?\\}\\s*from\\s*["']([^"']+)["']`, "g"),
        )) {
          const importedPath = m[1] ?? "";
          const bindingsPath = importedPath.replace(/\.machine\.ts$/, ".bindings.ts");
          if (bindingsPath !== importedPath) {
            componentImports.push(
              `import { ${call.factory} as __${call.factory}Component } from ${JSON.stringify(bindingsPath)};`,
            );
            templateAliases.push(
              `const ${call.name} = __${call.factory}Component(${call.args}); void ${call.name};`,
            );
          }
        }
      }
      const markup = source
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>\s*/g, "");
      const ir = parse(markup);
      const templateChecks: string[] = [];
      emitTemplateChecks(ir.nodes, templateChecks);
      const virtualModule = [
        ...componentImports,
        stripped.module,
        ...stripped.bindings.map((b) => `void ${b};`),
        `{`,
        ...templateAliases,
        ...templateChecks,
        `}`,
      ].join("\n");
      // Beside the example, so `../slider.bindings.ts` resolves.
      const tmp = `${entry.path}.script-check.ts`;
      await Deno.writeTextFile(tmp, virtualModule);
      modules.push(tmp);
    }
    if (modules.length === 0) {
      console.log("script-check: no <script> blocks found");
      return;
    }
    const cmd = new Deno.Command("deno", {
      args: ["check", "--no-lock", ...modules],
      cwd: ROOT,
      stdout: "piped",
      stderr: "piped",
    });
    const { code, stdout, stderr } = await cmd.output();
    const out = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
    for (const f of failures) console.log(`FAIL ${f}`);
    if (code !== 0) {
      // Map tmp paths back to examples.
      console.log(out.replaceAll(".script-check.ts", ""));
      Deno.exit(1);
    }
    if (failures.length > 0) Deno.exit(1);
    console.log(`script-check: ${modules.length} script block(s), all clear`);
  } finally {
    for (const tmp of modules) await Deno.remove(tmp).catch(() => {});
  }
}

await main();
