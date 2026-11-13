import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { findProjectRoot, readProjectThemes } from "../src/project.ts";

/**
 * The project is found the way the rest of the system finds it.
 *
 * A spin project is marked by a `spin/` directory at its root — the same
 * marker the daemon reads. The lint walks up from the file being linted and
 * takes the nearest ancestor that holds one, so a file in a project is
  * judged by that project's theme and a file outside every project falls
  * back to the languages.
 */

test("the nearest ancestor holding a spin directory is the project", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(`${root}/spin`);
    await mkdir(`${root}/src/pages`, { recursive: true });
    deepStrictEqual(findProjectRoot(`${root}/src/pages/page.tsx`), root);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a file outside every project has no root", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(`${root}/src`, { recursive: true });
    deepStrictEqual(findProjectRoot(`${root}/src/page.tsx`), undefined);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("the project's themes are read by name", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(`${root}/spin/acme`, { recursive: true });
    await writeFile(
      `${root}/spin/acme/tokens.json`,
      JSON.stringify({ color: { primary: { $value: "#c8102e" } } }),
    );
    const themes = readProjectThemes(root);
    deepStrictEqual(Object.keys(themes), ["acme"]);
    deepStrictEqual(themes["acme"], {
      color: { primary: { $value: "#c8102e" } },
    });
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a theme that does not parse is skipped, not thrown on", async () => {
  // A half written theme in an editor must not cost the lint the themes
  // the project has.
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(`${root}/spin/broken`, { recursive: true });
    await writeFile(`${root}/spin/broken/tokens.json`, "{ not json");
    await mkdir(`${root}/spin/acme`, { recursive: true });
    await writeFile(
      `${root}/spin/acme/tokens.json`,
      JSON.stringify({ color: { primary: { $value: "#c8102e" } } }),
    );
    deepStrictEqual(Object.keys(readProjectThemes(root)), ["acme"]);
  } finally {
    await rm(root, { recursive: true });
  }
});
