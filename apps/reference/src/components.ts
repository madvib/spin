import { COMPONENT_GROUPS, COMPONENT_ICONS, CONTROLLERS } from "@spinjs/components";
import { exampleSources, mountTag } from "@spinjs/components/examples";
import "@spinjs/components/examples";
import { EXAMPLE_ONLOAD } from "@spinjs/spin/kit";

import type { PrimitivePage } from "./primitives.ts";

export { COMPONENT_GROUPS, COMPONENT_ICONS };

/**
 * The machine components, beside the primitives. The gallery module IS the
 * manifest (machine → stems, title derived), the same convention the RPC
 * serves. A machine with no examples yet renders its recipe as the single
 * example.
 */
const titleOf = (stem: string): string =>
  stem.split("-").map((word) =>
    word.length === 0 ? word : word[0]!.toUpperCase() + word.slice(1)
  ).join(" ");

const grouped = new Map<
  string,
  {
    examples: { name: string; html: string; source: string; onLoad?: string }[];
  }
>();
for (const [machine, sources] of exampleSources()) {
  const group = grouped.get(machine) ?? { examples: [] };
  for (const { stem, html } of sources) {
    const tag = mountTag(machine, stem);
    const key = `${machine}/${stem}`;
    const onLoad = EXAMPLE_ONLOAD[key];
    group.examples.push({
      name: titleOf(stem),
      html: `<${tag} class="flex w-full min-w-0 flex-col items-center"></${tag}>`,
      source: html,
      ...(onLoad !== undefined ? { onLoad } : {}),
    });
  }
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
    return "Needs the controller glue (@spinjs/runtime, no statechart).";
  }
  return "Requires the runtime (@spinjs/runtime): markup drives a statechart.";
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
    examples: [...group.examples].sort((a, b) => a.name.localeCompare(b.name)),
  }))
  .sort((a, b) => a.title.localeCompare(b.title));
