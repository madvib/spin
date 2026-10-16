import type { PrimitivePage } from "./primitives.ts";

/**
 * The machine components, beside the primitives. Examples are the files
 * each machine ships under `examples/` — the glob below IS the manifest
 * (stem = name, title derived), the same convention the RPC serves.
 * A machine with no examples yet renders its recipe as the single example.
 */
const exampleSources = import.meta.glob(
  "../../../packages/components/src/spin-*/examples/*.html",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

// Compiled: each example is its own element, registered by the element
// transform. The component tab mounts the tag. One static import per
// machine keeps the glob (which vite must see literally) auditable.
import "../../../packages/components/src/spin-tree-view/examples/basic.html";
import "../../../packages/components/src/spin-tree-view/examples/async-loading.html";

const recipeModules = import.meta.glob(
  "../../../packages/components/src/spin-*/spin-*.html",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const titleOf = (stem: string): string =>
  stem.split("-").map((word) =>
    word.length === 0 ? word : word[0]!.toUpperCase() + word.slice(1)
  ).join(" ");

const machineOf = (path: string): string => {
  // `.../spin-tree-view/examples/basic.html` → `tree-view`: the examples
  // dir sits between the machine dir and the file.
  const segs = path.split("/");
  const dir = segs.at(-3) ?? "";
  return dir.startsWith("spin-") ? dir.slice("spin-".length) : dir;
};

const grouped = new Map<string, { examples: { name: string; html: string; source: string }[] }>();
for (const [path, html] of Object.entries(exampleSources)) {
  const machine = machineOf(path);
  const stem = path.split("/").at(-1)?.slice(0, -".html".length) ?? path;
  const group = grouped.get(machine) ?? { examples: [] };
  const tag = stem.includes("-") ? stem : `${machine}-${stem}`;
  group.examples.push({
    name: `${machine} — ${titleOf(stem)}`,
    html: `<${tag}></${tag}>`,
    source: html,
  });
  grouped.set(machine, group);
}
for (const [path, html] of Object.entries(recipeModules)) {
  const machine = machineOf(path);
  if (grouped.has(machine)) continue;
  grouped.set(machine, {
    examples: [{ name: `${titleOf(machine)} — Recipe`, html }],
  });
}

export const COMPONENTS: readonly PrimitivePage[] = [...grouped.entries()]
  .map(([id, group]) => ({
    id: `component-${id}`,
    title: titleOf(id),
    kind: "machine",
    note: "",
    examples: [...group.examples].sort((a, b) => a.name.localeCompare(b.name)),
  }))
  .sort((a, b) => a.title.localeCompare(b.title));
