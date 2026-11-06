import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveProjectDir } from "./resolve-dir.ts";

/**
 * A project's directories, where they live.
 *
 * The configuration names a local path; what the readers need is a
 * filesystem path. These are the rules that turn one into the other —
 * and the refusal a specifier earns, redirecting it to `extends`.
 */

/** A root with a local tree and a fixture package beneath it. */
async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "spin-resolve-"));
  await mkdir(join(root, "spin"), { recursive: true });
  await mkdir(join(root, "node_modules/@acme/kit/themes"), { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "probe" }));
  await writeFile(
    join(root, "node_modules/@acme/kit/package.json"),
    JSON.stringify({ name: "@acme/kit" }),
  );
  await writeFile(join(root, "spin/acme.json"), "{}");
  await writeFile(join(root, "spin/single.json"), "{}");
  return root;
}

test("a local path joins the root", async () => {
  const root = await fixture();
  deepStrictEqual(await resolveProjectDir(root, "spin", "themes"), {
    path: join(root, "spin"),
    file: false,
  });
  deepStrictEqual(
    await resolveProjectDir(root, "src/lib/components", "components"),
    { path: join(root, "src/lib/components"), file: false },
  );
});

test("a local file resolves to the file", async () => {
  const root = await fixture();
  deepStrictEqual(
    await resolveProjectDir(root, "spin/single.json", "themes"),
    { path: join(root, "spin/single.json"), file: true },
  );
});

test("a specifier is refused with the redirect to extends", async () => {
  const root = await fixture();
  for (const value of ["@acme/kit/themes", "@acme/kit/theme.json"]) {
    let message = "";
    try {
      await resolveProjectDir(root, value, "themes");
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    deepStrictEqual(
      message,
      `[spin] shared trees arrive through extends, not paths: '${value}'`,
    );
  }
});
