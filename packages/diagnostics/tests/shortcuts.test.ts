import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { readProjectShortcutsFile } from "@spinjs/server/project";
import { designLanguages } from "@spinjs/theme";
import {
  checkClosedVocabulary,
  type ClassFacts,
  type Facts,
} from "../src/core.ts";
import { engineAnswers } from "@spinjs/preset";
import { fallbackAnswers } from "../src/engine-types.ts";
import { factsFor } from "../src/project-vocabulary.ts";
import { factsForFile, forgetFacts, judgedRoot } from "../src/provider.ts";
import { candidatesIn, warmVocabulary } from "../src/generated.ts";
import { noShortcuts, readProjectShortcuts } from "../src/shortcuts.ts";

/**
 * A project's own shortcuts are vocabulary.
 *
 * The lint knows a project's themes because it reads them; it knows the
 * project's compositions because it reads `shortcuts.json` beside them —
 * the one table the build compiles. A class the project declared is a
 * class the project produces, so the closed-vocabulary rule must not
 * call it unknown.
 *
 * The table itself is read by the project, which owns the file it is
 * written in; what is held to here is the lint's own answer to it.
 */

/** The classes of an element, as the core reads them. */
function element(classes: string): ClassFacts {
  return {
    tag: "div",
    classes: classes.split(/\s+/).filter(Boolean),
    position: { line: 1, column: 1 },
  };
}

/** The findings the rule reports for one element. */
function reported(facts: Facts, classes: string): string[] {
  return checkClosedVocabulary(facts, element(classes)).map((finding) =>
    finding.data["cls"] ?? ""
  );
}

/** A themes directory holding the given `shortcuts.json` text. */
async function themesDir(text: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  await mkdir(join(root, "spin"));
  await writeFile(join(root, "spin", "shortcuts.json"), text);
  return join(root, "spin");
}

const TABLE = JSON.stringify({
  "my-stack": "flex flex-col gap-4",
  "my-panel": "bg-surface-raised border border-strong rounded-md p-6",
});

test("a class the project declares passes while undeclared classes are reported", async () => {
  const facts = factsFor(
    Object.values(designLanguages),
    engineAnswers(Object.values(designLanguages)),
    new Set(),
    readProjectShortcutsFile(await themesDir(TABLE)),
  );
  deepStrictEqual(reported(facts, "my-stack my-panel not-a-shortcut"), ["not-a-shortcut"]);
});
test("a class the project does not declare is still reported", async () => {
  const facts = factsFor(
    Object.values(designLanguages),
    engineAnswers(Object.values(designLanguages)),
    new Set(),
    readProjectShortcutsFile(await themesDir(TABLE)),
  );
  deepStrictEqual(reported(facts, "not-a-shortcut"), ["not-a-shortcut"]);
});

test("a bare composition name the project does not declare is unknown", () => {
  // The preset ships no compositions: `stack` in a project that declares no
  // shortcuts is an unknown class, and the rule carries the removal edit
  // when the adapter supplies token offsets.
  const facts = factsFor(
    Object.values(designLanguages),
    engineAnswers(Object.values(designLanguages)),
    new Set(),
    noShortcuts(),
  );
  const findings = checkClosedVocabulary(facts, {
    tag: "div",
    classes: ["stack"],
    position: { line: 1, column: 1 },
    tokens: [
      { name: "stack", range: [13, 18], spaceAfter: false, spaceBefore: false },
    ],
  });
  deepStrictEqual(
    findings.map((finding) => finding.data["cls"] ?? ""),
    ["stack"],
  );
  deepStrictEqual(findings[0]?.fix, { range: [13, 18], text: "" });
});

test("a shortcut that spends a class the theme cannot make is reported", async () => {
  // `gap-72` is a step no theme carries: the shortcut would style nothing,
  // and that is worth saying where the shortcut is used.
  const facts = factsFor(
    Object.values(designLanguages),
    engineAnswers(Object.values(designLanguages)),
    new Set(),
    readProjectShortcutsFile(
      await themesDir(JSON.stringify({ stack: "flex flex-col gap-72" })),
    ),
  );
  deepStrictEqual(reported(facts, "stack"), ["gap-72"]);
});

test("a project that declares unreadable shortcuts marks unreadable true", async () => {
  const declaration = readProjectShortcutsFile(await themesDir("{ not json"));
  deepStrictEqual(declaration.unreadable, true);
});

test("the lint learns the shortcuts of the project a file belongs to", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(join(root, "spin"));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "spin", "shortcuts.json"), TABLE);
    await writeFile(join(root, "src", "page.tsx"), `export const x = 1;\n`);
    // The service warms before it judges — declared classes plus the
    // expansions the file declares — so the direct read does the same.
    const file = join(root, "src", "page.tsx");
    const declared = await candidatesIn([file]);
    for (const part of "flex flex-col gap-4 bg-surface-raised border border-strong rounded-md p-6".split(" ")) {
      declared.add(part);
    }
    await warmVocabulary(judgedRoot(file), declared);
    forgetFacts(judgedRoot(file));
    const facts = factsForFile(file, fallbackAnswers());
    deepStrictEqual(reported(facts, "my-stack my-panel not-a-shortcut"), ["not-a-shortcut"]);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a custom themesDir is judged where it lives", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(join(root, "packages", "ui", "spin"), { recursive: true });
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "packages", "ui", "spin", "shortcuts.json"),
      JSON.stringify({ "my-stack": "flex flex-col gap-4" }),
    );
    await writeFile(
      join(root, "vite.config.ts"),
      `import { spin } from "@spinjs/dev/vite";\nexport default { plugins: [spin.vite({ themesDir: "packages/ui/spin" })] };\n`,
    );
    await writeFile(join(root, "src", "page.tsx"), `export const x = 1;\n`);
    const file = join(root, "src", "page.tsx");
    const declared = await candidatesIn([file]);
    for (const part of "flex flex-col gap-4".split(" ")) declared.add(part);
    await warmVocabulary(judgedRoot(file), declared);
    forgetFacts(judgedRoot(file));
    const facts = factsForFile(file, fallbackAnswers());
    deepStrictEqual(reported(facts, "my-stack not-a-shortcut"), ["not-a-shortcut"]);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a project that declares no shortcuts adds no vocabulary", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(join(root, "spin"));
    await mkdir(join(root, "src"));
    deepStrictEqual(Object.keys(readProjectShortcuts(join(root, "spin")).shortcuts).length, 0);
    const facts = factsForFile(join(root, "src", "page.tsx"), fallbackAnswers());
    // Nothing declared, nothing added: a composition name is unknown.
    deepStrictEqual(reported(facts, "stack"), ["stack"]);
    deepStrictEqual(reported(facts, "not-a-shortcut"), ["not-a-shortcut"]);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a project with no themes directory at all declares nothing", () => {
  deepStrictEqual(
    Object.keys(readProjectShortcuts(undefined).shortcuts).length,
    0,
  );
  deepStrictEqual(noShortcuts().unreadable, false);
});
