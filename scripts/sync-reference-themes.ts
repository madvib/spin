/**
 * Reference theme sync: package starters are the SSOT.
 *
 * A spin app owns its themes on disk (`spin/*.json`), so the reference
 * app carries working copies — but those copies must track the shipped
 * starters, or a starter fix lands in one place and verifies in another
 * (the squared-radius commit edited both by hand). This script copies
 * the three starters over the reference fork. Run it after any starter
 * change. It never touches `examples/` — demo projects own their themes
 * the way real apps do.
 *
 * Studio edits are in-memory overlay until saved; a save writes the
 * reference fork, which this script will overwrite on its next run.
 * That is the point: the fork is a cache of the starters plus unsaved
 * studio work, not a second source of truth.
 */
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const name of ["default", "neobrut", "console"]) {
  copyFileSync(
    join(root, "packages/theme/src/themes", `${name}.json`),
    join(root, "apps/reference/spin", `${name}.json`),
  );
}
console.log("reference themes synced from starters");
