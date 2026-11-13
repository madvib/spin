import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeProjectComponentsDts } from "./components.ts";

/**
 * The component types a project is written in: the frameworks its manifest
 * spends, and nothing else.
 *
 * The DOM map always ships; each spent framework gets its own module
 * augmentation beside it. A React project never sees a `solid-js` module
 * it did not install, and a project whose manifest names no framework
 * falls back to React and Solid.
 */

/** A project root with a manifest and one component. */
async function project(manifest: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "spin-dts-"));
  await mkdir(join(root, "src", "lib", "components", "greet"), { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await writeFile(
    join(root, "src", "lib", "components", "greet", "basic.html"),
    "<button>Hi</button>\n",
  );
  return root;
}

function declaredModules(dts: string): string[] {
  return [...dts.matchAll(/^declare module "([^"]+)" \{/gm)].map((m) => m[1]!);
}

test("a React project is typed for React, not Solid", async () => {
  const root = await project({
    name: "probe",
    dependencies: { react: "^19.0.0" },
  });
  await writeProjectComponentsDts(root);
  const dts = await readFile(join(root, "src", "spin-components.d.ts"), "utf8");
  deepStrictEqual(declaredModules(dts), ["react"]);
  deepStrictEqual(dts.includes("HTMLElementTagNameMap"), true);
});

test("a Solid project keeps its Solid JSX", async () => {
  const root = await project({
    name: "probe",
    dependencies: { "solid-js": "^1.9.3" },
  });
  await writeProjectComponentsDts(root);
  const dts = await readFile(join(root, "src", "spin-components.d.ts"), "utf8");
  deepStrictEqual(declaredModules(dts), ["solid-js"]);
});

test("a manifest that names no framework falls back to React and Solid", async () => {
  const root = await project({ name: "probe" });
  await writeProjectComponentsDts(root);
  const dts = await readFile(join(root, "src", "spin-components.d.ts"), "utf8");
  deepStrictEqual(declaredModules(dts), ["react", "solid-js"]);
});
