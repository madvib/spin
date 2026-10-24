import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { shortcutsIn } from "../../src/project/index.ts";
import { starterThemes } from "../../src/theme/themes/index.ts";
import {
  checkClosedVocabulary,
  type ClassFacts,
  type Facts,
} from "../../src/diagnostics/core.ts";
import { factsFor } from "../../src/diagnostics/facts.ts";
import { factsForFile } from "../../src/diagnostics/provider.ts";
import { noShortcuts, readProjectShortcuts } from "../../src/diagnostics/shortcuts.ts";

/**
 * A project's own shortcuts are vocabulary.
 *
 * The lint knows a project's themes because it reads them; it knows the
 * project's compositions because it reads them from the same place the
 * project declares them — the build configuration. A class the project
 * declared is a class the project produces, so the closed-vocabulary rule
 * must not call it unknown.
 *
 * The declaration itself is read by the project, which owns the file it is
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

const CONFIG = `
import { spin } from "../../src/preset/index.ts";

export default {
  plugins: [
    spin.vite({
      shortcuts: {
        "my-stack": "flex flex-col gap-4",
        "my-panel": "bg-surface-raised border border-border rounded-md p-6",
      },
    }),
  ],
};
`;

test("a class the project declares is not reported", () => {
  const facts = factsFor(
    Object.values(starterThemes),
    new Set(),
    shortcutsIn(CONFIG),
  );
  deepStrictEqual(reported(facts, "my-stack my-panel"), []);
});

test("a class the project does not declare is still reported", () => {
  const facts = factsFor(
    Object.values(starterThemes),
    new Set(),
    shortcutsIn(CONFIG),
  );
  deepStrictEqual(reported(facts, "not-a-shortcut"), ["not-a-shortcut"]);
});

test("a shortcut that spends a class the theme cannot make is reported", () => {
  // `gap-72` is a step no theme carries: the shortcut would style nothing,
  // and that is worth saying where the shortcut is used.
  const facts = factsFor(
    Object.values(starterThemes),
    new Set(),
    shortcutsIn(`spin.vite({ shortcuts: { stack: "flex flex-col gap-72" } })`),
  );
  deepStrictEqual(reported(facts, "stack"), ["gap-72"]);
});

test("a project that declares shortcuts the lint cannot read says nothing", () => {
  // The vocabulary cannot be read in full, so the rule that asks "can this
  // be produced?" stands down — and only that rule.
  const facts = factsFor(
    Object.values(starterThemes),
    new Set(),
    shortcutsIn(`spin.vite({ shortcuts: studioShortcuts })`),
  );
  deepStrictEqual(reported(facts, "my-stack bg-primary"), []);
});

test("the lint learns the shortcuts of the project a file belongs to", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(`${root}/src`);
    await writeFile(`${root}/vite.config.ts`, CONFIG);
    const facts = factsForFile(`${root}/src/page.tsx`);
    deepStrictEqual(reported(facts, "my-stack my-panel"), []);
    deepStrictEqual(reported(facts, "not-a-shortcut"), ["not-a-shortcut"]);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a table the configuration keeps in a constant is read", async () => {
  // The ordinary way to write one: a table of a dozen lines, named, and
  // handed to the plugin by name.
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(`${root}/src`);
    await writeFile(
      `${root}/vite.config.ts`,
      `const studioShortcuts = { "my-stack": "flex flex-col gap-4" };
spin.vite({ shortcuts: studioShortcuts });`,
    );
    const facts = factsForFile(`${root}/src/page.tsx`);
    deepStrictEqual(reported(facts, "my-stack"), []);
    deepStrictEqual(reported(facts, "not-a-shortcut"), ["not-a-shortcut"]);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a project that declares no shortcuts adds nothing to the product's set", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(`${root}/src`);
    await writeFile(
      `${root}/vite.config.ts`,
      `export default { plugins: [] };`,
    );
    deepStrictEqual(Object.keys(readProjectShortcuts(root).shortcuts).length, 0);
    const facts = factsForFile(`${root}/src/page.tsx`);
    // The standard compositions ship with the preset; the project added none.
    deepStrictEqual(reported(facts, "stack panel"), []);
    deepStrictEqual(reported(facts, "not-a-shortcut"), ["not-a-shortcut"]);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a project with no configuration at all declares nothing", () => {
  deepStrictEqual(
    Object.keys(readProjectShortcuts(undefined).shortcuts).length,
    0,
  );
  deepStrictEqual(noShortcuts().unreadable, false);
});
