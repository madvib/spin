import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  expandBraces,
  isIncluded,
  joinContent,
  scanContent,
} from "../../src/preset/content.ts";

const PIPELINE_INCLUDE = [
  /\.(vue|svelte|[jt]sx?|vine.ts|mdx?|astro|elm|php|phtml|marko|html)($|\?)/,
];

test("braces expand to one glob per alternative", () => {
  deepStrictEqual(expandBraces("src/**/*.{tsx,ts}"), [
    "src/**/*.tsx",
    "src/**/*.ts",
  ]);
});

test("a group at the end expands before the rest", () => {
  deepStrictEqual(expandBraces("pkg/*.{ts,tsx}/deep"), [
    "pkg/*.ts/deep",
    "pkg/*.tsx/deep",
  ]);
});

test("a pattern with no group is itself", () => {
  deepStrictEqual(expandBraces("src/app.tsx"), ["src/app.tsx"]);
});

test("an unterminated group is left alone", () => {
  deepStrictEqual(expandBraces("src/**/*.{tsx,ts"), ["src/**/*.{tsx,ts"]);
  deepStrictEqual(expandBraces("src/**/*.tsx}"), ["src/**/*.tsx}"]);
});

test("the include filter admits examples data modules", () => {
  assert(isIncluded("pkg/alert.examples.ts", PIPELINE_INCLUDE));
  assert(isIncluded("src/app.tsx", PIPELINE_INCLUDE));
  assert(isIncluded("src/Page.svelte", PIPELINE_INCLUDE));
});

test("the include filter passes only scanned files to the generator", () => {
  const scan = ["src/app.tsx", "docs/readme.md", "assets/hero.png"];
  deepStrictEqual(scan.filter((p) => isIncluded(p, PIPELINE_INCLUDE)), [
    "src/app.tsx",
    "docs/readme.md",
  ]);
});

test("an empty include list admits everything", () => {
  assert(isIncluded("anything.at.all", []));
});

test("scanning reads the files the globs name, keyed by path", async () => {
  const dir = await mkdtemp(join(tmpdir(), "spin-"));
  await writeFile(`${dir}/a.examples.ts`, "A");
  await writeFile(`${dir}/app.tsx`, "APP");
  await writeFile(`${dir}/notes.txt`, "NOT SCANNED");
  const scanned = await scanContent(
    { filesystem: ["*.{tsx,ts}"], pipeline: { include: PIPELINE_INCLUDE } },
    dir,
  );
  deepStrictEqual([...scanned.keys()].sort(), [
    `${dir}/a.examples.ts`,
    `${dir}/app.tsx`,
  ]);
  await rm(dir, { recursive: true });
});

test("a relative glob resolves against the root, not the cwd", async () => {
  const dir = await mkdtemp(join(tmpdir(), "spin-"));
  await mkdir(`${dir}/src`);
  await writeFile(`${dir}/src/index.ts`, "INDEX");
  const scanned = await scanContent({ filesystem: ["**/*.ts"] }, dir);
  deepStrictEqual(scanned.get(`${dir}/src/index.ts`), "INDEX");
  await rm(dir, { recursive: true });
});

test("joining preserves walk order", () => {
  const files = new Map([
    ["b.ts", "B"],
    ["a.ts", "A"],
    ["c.ts", "C"],
  ]);
  deepStrictEqual(joinContent(files), "B\nA\nC");
});

test("an excluded path is never scanned, even when included", () => {
  const include = [/\.(tsx|ts)($|\?)/];
  const exclude = [/components\/demos\//];
  assert(!isIncluded("src/components/demos/ValueInput.tsx", include, exclude));
  assert(isIncluded("src/routes/colors.tsx", include, exclude));
});

test("scanning skips what the pipeline excludes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "spin-"));
  await mkdir(`${dir}/demos`);
  await writeFile(`${dir}/app.tsx`, "APP");
  await writeFile(`${dir}/demos/skip.tsx`, "SKIP");
  const scanned = await scanContent(
    {
      filesystem: ["**/*.tsx"],
      pipeline: { include: [/\.tsx($|\?)/], exclude: [/\/demos\//] },
    },
    dir,
  );
  deepStrictEqual([...scanned.keys()], [`${dir}/app.tsx`]);
  await rm(dir, { recursive: true });
});
