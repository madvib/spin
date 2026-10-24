import { COMPONENT_GROUPS, COMPONENT_ICONS, CONTROLLERS } from "@spin/components";
import { EXAMPLE_ONLOAD } from "@spin/kit";

import type { PrimitivePage } from "./primitives.ts";

export { COMPONENT_GROUPS, COMPONENT_ICONS };

/**
 * The machine components, beside the primitives. Examples are the files
 * each machine ships under `examples/` — the glob below IS the manifest
 * (stem = name, title derived), the same convention the RPC serves.
 * A machine with no examples yet renders its recipe as the single example.
 */
const exampleSources = import.meta.glob(
  "../../../packages/components/src/*/examples/*.html",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

// Compiled: each example is its own element, registered by the element
// transform as a side effect. Same glob, no ?raw.
import.meta.glob(
  "../../../packages/components/src/*/examples/*.html",
  { eager: true },
);

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

const grouped = new Map<
  string,
  {
    examples: { name: string; html: string; source: string; onLoad?: string }[];
  }
>();
for (const [path, html] of Object.entries(exampleSources)) {
  const machine = exampleMachineOf(path);
  const stem = path.split("/").at(-1)?.slice(0, -".html".length) ?? path;
  const group = grouped.get(machine) ?? { examples: [] };
  // Machine-qualified, always: a dashed stem (`media-player`) is not a
  // usable bare tag — the compiled element registers machine-stem, and
  // the mount must name the same element.
  const tag = `${machine}-${stem}`;
  group.examples.push({
    name: `${machine} — ${titleOf(stem)}`,
    html: `<${tag}></${tag}>`,
    source: html,
  });
  grouped.set(machine, group);
}
/** Mount glue a static file cannot carry: property functions. Keyed by
 * `machine/stem`. The loading example's `loadChildren` is what a consumer
 * writes in their own code (see the note in the example source). */

/** The dependency line the detail view shows: what a consumer must have
 * before the markup works. */
export const componentRequirement = (id: string): string => {
  const machine = id.startsWith("component-")
    ? id.slice("component-".length)
    : id;
  if ((CONTROLLERS as readonly string[]).includes(machine)) {
    return "Needs the controller glue (@spin/runtime, no statechart).";
  }
  return "Requires the runtime (@spin/runtime): markup drives a statechart.";
};

// A machine the groups and the icons both miss is a machine the rail
// cannot place — checked here, where all three are in view.
for (const entry of [...grouped.entries()].map(([id]) => id)) {
  if (
    !COMPONENT_GROUPS.some((g) =>
      (g.members as readonly string[]).includes(entry)
    )
  ) {
    throw new Error(`COMPONENT_GROUPS: ${entry} is in no group`);
  }
  if (COMPONENT_ICONS[entry] === undefined) {
    throw new Error(`COMPONENT_ICONS: ${entry} has no icon`);
  }
}

export const COMPONENTS: readonly PrimitivePage[] = [...grouped.entries()]
  .map(([id, group]) => ({
    id: `component-${id}`,
    title: titleOf(id),
    kind: "machine",
    note: "",
    examples: [...group.examples].sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => {
        const key = `${id}/${
          e.name.split(" — ")[1]?.toLowerCase().replace(/ /g, "-") ?? ""
        }`;
        const onLoad = EXAMPLE_ONLOAD[key];
        return onLoad !== undefined ? { ...e, onLoad } : e;
      }),
  }))
  .sort((a, b) => a.title.localeCompare(b.title));
