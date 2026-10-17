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
// transform as a side effect. Same glob, no ?raw.
import.meta.glob(
  "../../../packages/components/src/spin-*/examples/*.html",
  { eager: true },
);

const recipeModules = import.meta.glob(
  "../../../packages/components/src/spin-*/spin-*.html",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const titleOf = (stem: string): string =>
  stem.split("-").map((word) =>
    word.length === 0 ? word : word[0]!.toUpperCase() + word.slice(1)
  ).join(" ");

const stripSpin = (dir: string): string =>
  dir.startsWith("spin-") ? dir.slice("spin-".length) : dir;

// `.../spin-tree-view/examples/basic.html` → `tree-view`: the examples
// dir sits between the machine dir and the file.
const exampleMachineOf = (path: string): string =>
  stripSpin(path.split("/").at(-3) ?? "");

// Recipes sit beside the machine dir: `.../spin-tree-view/spin-*.html`.
const recipeMachineOf = (path: string): string =>
  stripSpin(path.split("/").at(-2) ?? "");

const grouped = new Map<string, { examples: { name: string; html: string; source: string; onLoad?: string }[] }>();
for (const [path, html] of Object.entries(exampleSources)) {
  const machine = exampleMachineOf(path);
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
  const machine = recipeMachineOf(path);
  if (grouped.has(machine)) continue;
  grouped.set(machine, {
    examples: [{ name: `${titleOf(machine)} — Recipe`, html }],
  });
}

/** Mount glue a static file cannot carry: property functions. Keyed by
 * `machine/stem`. The loading example's `loadChildren` is what a consumer
 * writes in their own code (see the note in the example source). */
const EXAMPLE_ONLOAD: Record<string, string> = {
  "pagination/dropdown": `
    document.querySelectorAll("pagination-dropdown").forEach((pg) => {
      pg.querySelectorAll("[data-size]").forEach((btn) => {
        btn.addEventListener("click", () => {
          pg.setPageSize(Number(btn.getAttribute("data-size")));
        });
      });
    });`,
  "pagination/jump": `
    document.querySelectorAll("pagination-jump").forEach((pg) => {
      const input = pg.querySelector("[data-jump] input");
      pg.querySelector("[data-go]")?.addEventListener("click", () => {
        pg.setPage(Number(input.value));
      });
    });`,
  "tour/basic": `
    document.querySelectorAll("tour-basic").forEach((tour) => {
      tour.querySelector("[data-start]")?.addEventListener("click", () => {
        tour.start();
      });
    });`,
  "tree-view/loading": `
    document.querySelectorAll("tree-view-loading").forEach((tree) => {
      const t = tree;
      t.loadChildren = async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (value === "packages") {
          return [
            { value: "packages/components", label: "components" },
            { value: "packages/runtime", label: "runtime" },
          ];
        }
        return [];
      };
    });
  `,
};

export const COMPONENTS: readonly PrimitivePage[] = [...grouped.entries()]
  .map(([id, group]) => ({
    id: `component-${id}`,
    title: titleOf(id),
    kind: "machine",
    note: "",
    examples: [...group.examples].sort((a, b) => a.name.localeCompare(b.name)).map((e) => {
      const key = `${id}/${e.name.split(" — ")[1]?.toLowerCase().replace(/ /g, "-") ?? ""}`;
      const onLoad = EXAMPLE_ONLOAD[key];
      return onLoad !== undefined ? { ...e, onLoad } : e;
    }),
  }))
  .sort((a, b) => a.title.localeCompare(b.title));
