/**
 * Pack the publishable packages: swap, pack, restore.
 *
 * `bun pm pack` packs `package.json` as written, and the workspace
 * manifests point at `src/` — so packing swaps each manifest to its
 * dist map first (`packManifestOf`), packs into the destination, and
 * restores the workspace manifests even when the pack fails. The tree
 * after a pack is the tree before it: `git status` shows no manifest
 * change.
 *
 * Usage: `bun run scripts/pack.ts [destination]`
 */

import { dirname, join, resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { packManifestOf } from "./build-dist.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES_DIR = join(REPO, "packages");

async function manifests(): Promise<{ dir: string; raw: Record<string, unknown> }[]> {
  const out: { dir: string; raw: Record<string, unknown> }[] = [];
  for (const entry of await readdir(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".dist-")) continue;
    const dir = join(PACKAGES_DIR, entry.name);
    const file = join(dir, "package.json");
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(await readFile(file, "utf8"));
    } catch {
      continue;
    }
    const publishExports = (raw["publishConfig"] as { exports?: unknown } | undefined)?.exports;
    if (publishExports === undefined) continue;
    out.push({ dir, raw });
  }
  return out;
}

async function main(): Promise<void> {
  const destination = resolve(REPO, process.argv[2] ?? "dist-tarballs");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(destination, { recursive: true });
  const packages = await manifests();
  if (packages.length === 0) throw new Error("no publishable packages found");
  const versions = new Map<string, string>();
  for (const { raw } of packages) {
    versions.set(raw["name"] as string, raw["version"] as string);
  }
  const saved = new Map<string, string>();
  for (const { dir, raw } of packages) {
    const next = packManifestOf(raw, versions);
    if (next === undefined) continue;
    const file = join(dir, "package.json");
    saved.set(file, await readFile(file, "utf8"));
    await writeFile(file, JSON.stringify(next, null, 2) + "\n");
  }
  try {
    for (const { dir, raw } of packages) {
      const { spawn } = await import("node:child_process");
      const code = await new Promise<number>((resolve, reject) => {
        const child = spawn(
          "bun",
          ["pm", "pack", "--destination", destination],
          { cwd: dir, stdio: "inherit" },
        );
        child.on("error", reject);
        child.on("close", (c) => resolve(c ?? 1));
      });
      if (code !== 0) {
        throw new Error(`pack failed for ${raw["name"] as string}`);
      }
    }
  } finally {
    for (const [file, text] of saved) await writeFile(file, text);
  }
}

if (import.meta.main) {
  await main();
}
