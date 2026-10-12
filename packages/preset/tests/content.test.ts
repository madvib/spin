import { assert, assertEquals } from "@std/assert";
import {
  expandBraces,
  isIncluded,
  joinContent,
  scanContent,
} from "../src/content.ts";

const PIPELINE_INCLUDE = [
  /\.(vue|svelte|[jt]sx?|vine.ts|mdx?|astro|elm|php|phtml|marko|html)($|\?)/,
];

Deno.test("braces expand to one glob per alternative", () => {
  assertEquals(expandBraces("src/**/*.{tsx,ts}"), [
    "src/**/*.tsx",
    "src/**/*.ts",
  ]);
});

Deno.test("a group at the end expands before the rest", () => {
  assertEquals(expandBraces("pkg/*.{ts,tsx}/deep"), [
    "pkg/*.ts/deep",
    "pkg/*.tsx/deep",
  ]);
});

Deno.test("a pattern with no group is itself", () => {
  assertEquals(expandBraces("src/app.tsx"), ["src/app.tsx"]);
});

Deno.test("an unterminated group is left alone", () => {
  assertEquals(expandBraces("src/**/*.{tsx,ts"), ["src/**/*.{tsx,ts"]);
  assertEquals(expandBraces("src/**/*.tsx}"), ["src/**/*.tsx}"]);
});

Deno.test("the include filter admits examples data modules", () => {
  assert(isIncluded("pkg/alert.examples.ts", PIPELINE_INCLUDE));
  assert(isIncluded("src/app.tsx", PIPELINE_INCLUDE));
  assert(isIncluded("src/Page.svelte", PIPELINE_INCLUDE));
});

Deno.test("the include filter passes only scanned files to the generator", () => {
  const scan = ["src/app.tsx", "docs/readme.md", "assets/hero.png"];
  assertEquals(scan.filter((p) => isIncluded(p, PIPELINE_INCLUDE)), [
    "src/app.tsx",
    "docs/readme.md",
  ]);
});

Deno.test("an empty include list admits everything", () => {
  assert(isIncluded("anything.at.all", []));
});

Deno.test("scanning reads the files the globs name, keyed by path", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/a.examples.ts`, "A");
  await Deno.writeTextFile(`${dir}/app.tsx`, "APP");
  await Deno.writeTextFile(`${dir}/notes.txt`, "NOT SCANNED");
  const scanned = await scanContent(
    { filesystem: ["*.{tsx,ts}"], pipeline: { include: PIPELINE_INCLUDE } },
    dir,
  );
  assertEquals([...scanned.keys()].sort(), [
    `${dir}/a.examples.ts`,
    `${dir}/app.tsx`,
  ]);
  await Deno.remove(dir, { recursive: true });
});

Deno.test("a relative glob resolves against the root, not the cwd", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.mkdir(`${dir}/src`);
  await Deno.writeTextFile(`${dir}/src/index.ts`, "INDEX");
  const scanned = await scanContent({ filesystem: ["**/*.ts"] }, dir);
  assertEquals(scanned.get(`${dir}/src/index.ts`), "INDEX");
  await Deno.remove(dir, { recursive: true });
});

Deno.test("joining preserves walk order", () => {
  const files = new Map([
    ["b.ts", "B"],
    ["a.ts", "A"],
    ["c.ts", "C"],
  ]);
  assertEquals(joinContent(files), "B\nA\nC");
});
