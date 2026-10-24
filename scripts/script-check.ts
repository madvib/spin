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

import { readdir, readFile, writeFile, rm } from "node:fs/promises";
import {
  extractScript,
  type Node,
  parse,
  stripScript,
} from "../packages/syntax/src/index.ts";

const ROOT = new URL("..", import.meta.url).pathname;
async function* walkFiles(root: string, exts: string[]): AsyncGenerator<{ path: string; isFile: boolean }> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const e of entries) {
    const p = `${root}/${e.name}`;
    if (e.isDirectory()) yield* walkFiles(p, exts);
    else if (e.isFile() && exts.some((x) => e.name.endsWith(x))) yield { path: p, isFile: true };
  }
}

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
      out.push(
        `{ const __bag: Record<string, unknown> = (${spread.expr}); void __bag; }`,
      );
    }
    emitTemplateChecks(node.children, out);
  }
}

async function main(): Promise<void> {
  const modules: string[] = [];
  const failures: string[] = [];
  try {
    for await (const entry of walkFiles(ROOT + "packages/components/src", [".html"])) {
      if (!entry.isFile) continue;
      const source = await readFile(entry.path, "utf8");
      const body = extractScript(source);
      if (body === undefined) continue;
      const stripped = stripScript(body);
      if (stripped.stripped.length > 0) {
        failures.push(
          `${entry.path}: script has stripped statements (effects?):\n    ${
            stripped.stripped.join("\n    ")
          }`,
        );
      }
      const dir = entry.path.split("/").slice(0, -1).join("/");
      let resolvedSource = source;
      for (let pass = 0; pass < 8; pass += 1) {
        const m = /<include\s+file="([^"]+)"\s*\/?>/.exec(resolvedSource);
        if (m === null) break;
        const target = m[1]!;
        const targetPath = target.startsWith("/")
          ? target.slice(1)
          : `${dir}/${target}`;
        const normalized = targetPath.split("/").reduce((parts, part) => {
          if (part === "..") return parts.slice(0, -1);
          if (part === ".") return parts;
          return [...parts, part];
        }, [] as string[]).join("/");
        const included = await readFile(normalized, "utf8");
        const includedBody = included
          .replace(/<scope>[\s\S]*?<\/scope>\s*/, "")
          .replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>\s*/, "");
        resolvedSource = resolvedSource.replace(m[0], includedBody);
      }
      const markup = resolvedSource
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>\s*/g, "");
      const ir = parse(markup);
      const templateChecks: string[] = [];
      emitTemplateChecks(ir.nodes, templateChecks);
      const virtualModule = [
        stripped.module,
        ...stripped.bindings.map((b) => `void ${b};`),
        `{`,
        ...templateChecks,
        `}`,
      ].join("\n");
      // Beside the example, so `../slider.presentation.ts` resolves.
      const tmp = `${entry.path}.script-check.ts`;
      await writeFile(tmp, virtualModule);
      modules.push(tmp);
    }
    if (modules.length === 0) {
      console.log("script-check: no <script> blocks found");
      return;
    }
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync("deno", ["check", "--no-lock", ...modules], { cwd: ROOT, encoding: "utf8" });
    const code = r.status ?? 1;
    const out = (r.stdout ?? "") + (r.stderr ?? "");
    for (const f of failures) console.log(`FAIL ${f}`);
    if (code !== 0) {
      // Map tmp paths back to examples.
      console.log(out.replaceAll(".script-check.ts", ""));
      process.exit(1);
    }
    if (failures.length > 0) process.exit(1);
    console.log(`script-check: ${modules.length} script block(s), all clear`);
  } finally {
    for (const tmp of modules) await rm(tmp).catch(() => {});
  }
}

await main();
