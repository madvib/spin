import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import {
  candidatesIn,
  resolveWind4Tokens,
  vocabularyOf,
  warmArgvScope,
} from "../src/generated.ts";
import { judgedRoot } from "../src/provider.ts";
import { projectRootFor } from "../src/project.ts";

/**
 * The generated vocabulary is resolved per scope, never walked to.
 *
 * The resolver answers for the candidates it is given — the tokens a
 * linted file wears — and caches them per project root. The scope a
 * linter warms is the scope it was asked to lint: the command line's own
 * paths. The tree around those paths is never read.
 */

test("the resolver answers for the candidates it is given and keeps them", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const first = await resolveWind4Tokens(root, new Set(["w-[19rem]", "not-a-class"]));
    deepStrictEqual([...first].filter((c) => c === "w-[19rem]" || c === "not-a-class"), ["w-[19rem]"]);
    const second = await resolveWind4Tokens(root, new Set(["bg-surface/80"]));
    deepStrictEqual(second.has("w-[19rem]"), true);
    deepStrictEqual(second.has("bg-surface/80"), true);
    deepStrictEqual(vocabularyOf(root), second);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a file under the tool's tree is rooted at its own spin directory", async () => {
  const probe = join(process.cwd(), `.tmp-ceiling-${process.pid}`);
  try {
    await mkdir(join(probe, "spin", "src"), { recursive: true });
    await writeFile(join(probe, "spin", "src", "page.tsx"), "export const x = 1;\n");
    deepStrictEqual(
      projectRootFor(join(probe, "spin", "src", "page.tsx")),
      probe,
    );
  } finally {
    await rm(probe, { recursive: true, force: true });
  }
});

test("a file outside the tool's tree walks unbounded, as before", async () => {
  const outer = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(join(outer, "spin", "src"), { recursive: true });
    await writeFile(join(outer, "spin", "src", "page.tsx"), "export const x = 1;\n");
    deepStrictEqual(
      projectRootFor(join(outer, "spin", "src", "page.tsx")),
      outer,
    );
  } finally {
    await rm(outer, { recursive: true });
  }
});

test("warming a scope resolves the named files and nothing beside them", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(join(root, "src"));
    const named = join(root, "src", "named.tsx");
    const beside = join(root, "src", "beside.tsx");
    await writeFile(named, `export const A = () => <div className="w-[19rem]" />;\n`);
    await writeFile(beside, `export const B = () => <div className="w-[23rem]" />;\n`);
    const seen = await candidatesIn([named]);
    deepStrictEqual([...seen].sort(), ["w-[19rem]"]);
    await warmArgvScope([named]);
    const judged = judgedRoot(named);
    deepStrictEqual(
      [...(vocabularyOf(judged) ?? [])].filter((c) => c.startsWith("w-[")).sort(),
      ["w-[19rem]"],
    );
  } finally {
    await rm(root, { recursive: true });
  }
});
