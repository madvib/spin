/**
 * The architecture, asserted: areas import only downward, and browser
 * entries stay free of Node.
 *
 * The linter's `no-restricted-imports` covers static imports; this test
 * covers what it cannot see — dynamic `await import()` — and states the
 * whole area matrix in one place, so a new edge fails loudly instead of
 * drifting in. An exception below names its phase: the move that deletes
 * it, not a permanent pass.
 */

import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const SPIN = new URL("../../src/", import.meta.url).pathname;
const ROOT = new URL("../../../", import.meta.url).pathname;

/** Every `.ts` file under a dir, minus tests and declarations. Missing dirs (split packages) read empty. */
async function sources(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (at: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(at, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(at, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;
      if (entry.name.endsWith(".test.ts")) continue;
      if (entry.name.endsWith(".d.ts")) continue;
      out.push(full);
    }
  };
  await walk(dir);
  return out;
}

const STATIC = /^[ \t]*(?:import|export)(?!\s+type\b)(?![^"']*\bimport\s+type\b)[^"']*from\s*["']([^"']+)["']/gm;
const DYNAMIC = /(?:import|require|localRequire)\(\s*["']([^"']+)["']\s*\)/g;

/** Every module specifier a file names, static and dynamic. */
async function specifiers(file: string): Promise<string[]> {
  const text = await readFile(file, "utf8");
  const out: string[] = [];
  for (const re of [STATIC, DYNAMIC]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) out.push(m[1]!);
  }
  return out;
}

/** The spin area a specifier reaches, when it reaches one. */
function areaOf(spec: string): string | undefined {
  const m = /^(?:\.\.\/)+([a-z-]+)(?:\/|$)/.exec(spec);
  return m?.[1];
}

/**
 * Forbidden inbound edges per area: `[area, forbidden area, reason]`.
 * `compiler` renders downward only; `diagnostics` never calls the API
 * client; `project` owns the filesystem. Exceptions name their phase.
 *
 * Value imports only: `import type` erases at build and cannot cycle, so
 * the preset filling the checker's input shapes imports their types
 * freely. A value edge across these lines is the violation.
 */
const FORBIDDEN: ReadonlyArray<readonly [string, string, string]> = [
  ["compiler", "plugin", "the preset renders downward only"],
  ["compiler", "diagnostics", "the preset renders downward only"],
  ["compiler", "api", "the preset renders downward only"],
  ["compiler", "project", "the preset renders downward only"],
  ["compiler", "lsp", "the preset renders downward only"],
  ["compiler", "mcp", "the preset renders downward only"],
  ["diagnostics", "api", "findings flow up; the client lives above (cli.ts excepted, Phase 2)"],
  ["project", "plugin", "project owns the filesystem"],
];

/** Files excused from one forbidden edge, with the phase that deletes them. */
const EXCEPTIONS: ReadonlyArray<readonly [string, string, string]> = [
];

test("spin areas import only downward", async () => {
  const violations: string[] = [];
  for (const [area] of new Map(FORBIDDEN.map(([a]) => [a, true]))) {
    for (const file of await sources(join(SPIN, area))) {
      const rel = relative(ROOT, file);
      for (const spec of await specifiers(file)) {
        const target = areaOf(spec);
        if (target === undefined) continue;
        const rule = FORBIDDEN.find(([a, b]) => a === area && b === target);
        if (rule === undefined) continue;
        const excused = EXCEPTIONS.some(([f, t]) => rel.endsWith(f) && t === target);
        if (!excused) violations.push(`${rel} reaches ${target} (${spec}): ${rule[2]}`);
      }
    }
  }
  deepStrictEqual(violations, []);
});

test("every DAG exception still exists", async () => {
  const stale: string[] = [];
  for (const [file] of EXCEPTIONS) {
    try {
      await readFile(join(SPIN, file.replace(/^src\//, "")), "utf8");
    } catch {
      stale.push(file);
    }
  }
  deepStrictEqual(stale, []);
});

/**
 * Browser entries stay free of Node: static and dynamic `node:` imports
 * alike. The client ships to browsers; a Node builtin in its graph is a
 * build break for every consumer.
 */
const BROWSER_ROOTS = [
  "packages/components/src/runtime/index.ts",
  "packages/components/src/index.ts",
];

test("browser entries import no Node builtins", async () => {
  const violations: string[] = [];
  for (const root of BROWSER_ROOTS) {
    const seen = new Set<string>();
    const queue = [join(ROOT, root)];
    while (queue.length > 0) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      try {
        await readFile(file, "utf8");
      } catch {
        continue;
      }
      for (const spec of await specifiers(file)) {
        if (spec.startsWith("node:") || spec === "node") {
          violations.push(`${relative(ROOT, file)} imports ${spec}`);
          continue;
        }
        if (!spec.startsWith(".")) continue;
        const base = spec.split("?")[0]!;
        const candidates = [
          `${base}.ts`,
          `${base}/index.ts`,
          base,
        ];
        for (const cand of candidates) {
          const resolved = join(file.slice(0, file.lastIndexOf("/")), cand);
          if (!seen.has(resolved)) queue.push(resolved);
        }
      }
    }
  }
  deepStrictEqual(violations, []);
});

/**
 * Areas import through indexes, never deep modules.
 *
 * Every cross-area edge names `../<area>/index.ts`: the index is the
 * area's surface, and a deep reach is a reach past it. Intra-area imports
 * (`./`, `../utils/` inside compiler) are the area's own business. The
 * linter cannot express "index yes, deep no" with globs, so the wall
 * lives here.
 */
const AREAS = ["compiler", "diagnostics", "project", "plugin", "api", "lsp", "mcp", "examples", "animation", "skill"];

test("cross-area imports name an index", async () => {
  const walls: string[] = [];
  for (const area of AREAS) {
    let files: string[];
    try {
      files = await sources(join(SPIN, area));
    } catch {
      continue;
    }
    for (const file of files) {
      const rel = relative(ROOT, file);
      for (const spec of await specifiers(file)) {
        const target = areaOf(spec);
        if (target === undefined || target === area) continue;
        if (target === "utils") continue;
        if (spec.endsWith("/index.ts") || spec.endsWith("/index")) continue;
        walls.push(`${rel} reaches past ${target}'s index (${spec})`);
      }
    }
  }
  deepStrictEqual(walls, []);
});
