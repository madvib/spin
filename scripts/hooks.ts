/**
 * The git hooks — the gate, enforced where code enters.
 *
 * Pre-commit runs the fast gate (types + lint over the whole tree);
 * pre-push runs the full gate (types + lint + unit suites). Both are the
 * same unbiased commands the product ships: no path lists to drift, no
 * directory bias to forget. A hook that fails blocks the push, and says
 * which command to re-run.
 *
 * Usage: `bun run hooks` (installs both). Hooks are local-only: clones
 * run this once, and CI runs the same commands.
 */

import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const HOOKS = join(ROOT, ".git", "hooks");

const PRE_COMMIT = `#!/bin/sh
# Installed by \`bun run hooks\`. The fast gate over the whole tree.
set -e
bun run check
`;

const PRE_PUSH = `#!/bin/sh
# Installed by \`bun run hooks\`. The full gate: types, lint, and suites.
set -e
bun run check
bun run test
`;

await writeFile(join(HOOKS, "pre-commit"), PRE_COMMIT);
await writeFile(join(HOOKS, "pre-push"), PRE_PUSH);
await chmod(join(HOOKS, "pre-commit"), 0o755);
await chmod(join(HOOKS, "pre-push"), 0o755);
console.log("installed pre-commit (bun run check) and pre-push (bun run check && bun run test)");
