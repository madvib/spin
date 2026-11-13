import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { checkClosedVocabulary, type ClassFacts, type Facts } from "../src/core.ts";
import { fallbackAnswers } from "../src/engine-types.ts";
import { factsForFile, forgetFacts, judgedRoot } from "../src/provider.ts";
import { candidatesIn, warmVocabulary } from "../src/generated.ts";

/**
 * A brand that declares its icon set holds icon classes to it.
 *
 * Glyphs come from the icon preset, not the token vocabulary — so a
 * project that names no collection spends whatever resolves. A project
 * that declares one in a brand's `brand.json` (or the project's
 * `config.json`) holds every `i-*` class to that set: a glyph from
 * another collection is outside the icon set, and the rule says so.
 * A glyph the project saved to `spin/icons/` passes by its exact name,
 * whatever set it came from.
 */

/** A project with a brand declaring the lucide set. */
async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  await mkdir(join(root, "spin", "acme"), { recursive: true });
  await writeFile(
    join(root, "spin", "acme", "tokens.json"),
    JSON.stringify({ $extends: "minimal", modes: ["light", "dark"] }),
  );
  await writeFile(
    join(root, "spin", "acme", "brand.json"),
    JSON.stringify({ name: "acme", icons: { collection: "lucide" } }),
  );
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "page.tsx"), `export const x = 1;\n`);
  return root;
}

/** The findings the rule reports for one element. */
function reported(facts: Facts, classes: string): string[] {
  const node: ClassFacts = {
    tag: "i",
    classes: classes.split(/\s+/).filter(Boolean),
    position: { line: 1, column: 1 },
  };
  return checkClosedVocabulary(facts, node).map((finding) =>
    finding.data["cls"] ?? ""
  );
}

/** The facts for a project's page, warmed the way the service warms. */
async function factsOf(root: string): Promise<Facts> {
  const file = join(root, "src", "page.tsx");
  await warmVocabulary(judgedRoot(file), await candidatesIn([file]));
  forgetFacts(judgedRoot(file));
  return factsForFile(file, fallbackAnswers());
}

test("a glyph outside the declared set is reported, a glyph inside passes", async () => {
  const root = await project();
  try {
    const facts = await factsOf(root);
    deepStrictEqual(reported(facts, "i-tabler-home i-lucide-home"), ["i-tabler-home"]);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a saved glyph passes by its exact name, whatever set it came from", async () => {
  const root = await project();
  try {
    await mkdir(join(root, "spin", "icons"));
    await writeFile(
      join(root, "spin", "icons", "star.json"),
      JSON.stringify({
        markup: "<svg></svg>",
        attribution: { collection: "tabler", author: null, license: null },
      }),
    );
    const facts = await factsOf(root);
    deepStrictEqual(reported(facts, "i-tabler-star i-tabler-home"), ["i-tabler-home"]);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a project that declares no set spends whatever resolves", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(join(root, "spin", "acme"), { recursive: true });
    await writeFile(
      join(root, "spin", "acme", "tokens.json"),
      JSON.stringify({ $extends: "minimal", modes: ["light", "dark"] }),
    );
    await writeFile(
      join(root, "spin", "acme", "brand.json"),
      JSON.stringify({ name: "acme" }),
    );
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "page.tsx"), `export const x = 1;\n`);
    const facts = await factsOf(root);
    deepStrictEqual(reported(facts, "i-tabler-home i-lucide-home not-a-glyph"), ["not-a-glyph"]);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("the project's config names the default set", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(join(root, "spin", "acme"), { recursive: true });
    await writeFile(
      join(root, "spin", "acme", "tokens.json"),
      JSON.stringify({ $extends: "minimal", modes: ["light", "dark"] }),
    );
    await writeFile(
      join(root, "spin", "acme", "brand.json"),
      JSON.stringify({ name: "acme" }),
    );
    await writeFile(
      join(root, "spin", "config.json"),
      JSON.stringify({ brand: "acme", icons: { collection: "tabler" } }),
    );
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "page.tsx"), `export const x = 1;\n`);
    const facts = await factsOf(root);
    deepStrictEqual(reported(facts, "i-tabler-home i-lucide-home"), ["i-lucide-home"]);
  } finally {
    await rm(root, { recursive: true });
  }
});
