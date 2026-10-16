/**
 * Implements {@link componentsContract}. Each handler is a thin wrapper
 * over the vendored `*.variants.ts` modules — pure, no fs, except `copy`
 * which writes into the caller's project the way `project.init` does.
 */

import { implement } from "@orpc/server";

import { TREE_VIEW_VARIANTS } from "./spin-tree-view/tree-view.variants.ts";
import { componentsContract } from "./components-contract.ts";

export { componentsContract };

const VARIANTS: Record<string, readonly { name: string; title: string; html: string }[]> = {
  "tree-view": TREE_VIEW_VARIANTS,
};

const os = implement(componentsContract);

const list = os.components.list.handler(() => {
  return Object.entries(VARIANTS).map(([name, rows]) => ({
    name,
    variants: rows.map((row) => row.name),
  }));
});

const variants = os.components.variants.handler(({ input }) => {
  const rows = VARIANTS[input.name] ?? [];
  return { variants: rows.map((row) => ({ ...row })) };
});

const copy = os.components.copy.handler(async ({ input }) => {
  const rows = VARIANTS[input.name] ?? [];
  const found = rows.find((row) => row.name === input.variant);
  if (found === undefined) {
    return { file: null, error: `Unknown variant: ${input.name}/${input.variant}` };
  }
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    // The caller's project, or the daemon's own — one process serves many
  // projects, so the root rides the call the way project.* carries it.
    const root = input.root ?? ".";
    const file = join("spin", input.name, `${input.variant}.html`);
    await mkdir(join(root, "spin", input.name), { recursive: true });
    await writeFile(join(root, file), found.html, "utf8");
    return { file, error: null };
  } catch (err) {
    return { file: null, error: err instanceof Error ? err.message : String(err) };
  }
});
export const componentsRouter = os.router({
  components: {
    list,
    variants,
    copy,
  },
});
