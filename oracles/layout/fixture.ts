/**
 * Fixture pages. Each route replays the reference's own example markup —
 * imported from the package, not transcribed — inside the same preview panel
 * the reference wraps it in, inside the same app shell. If an example's
 * markup changes, the oracle follows; if the shell's panel changes, the
 * oracle's geometry is measuring the old shell and that is the point of
 * keeping them adjacent.
 *
 * The page header (title, kind, "N examples" badge) and the rail's link list
 * are omitted: they carry no asserted geometry, and the rail's width is all
 * of it that the fixture keeps.
 */

import { TABLE_EXAMPLES } from "@spin/preset/rules/primitives/table.examples.ts";
import { AVATAR_EXAMPLES } from "@spin/preset/rules/primitives/avatar.examples.ts";
import { AVATAR_GROUP_EXAMPLES } from "@spin/preset/rules/primitives/avatar-group.examples.ts";
import { JOIN_EXAMPLES } from "@spin/preset/rules/primitives/join.examples.ts";

export interface Route {
  readonly id: string;
  readonly title: string;
  /** Example markup, exactly as the package publishes it. */
  readonly examples: readonly string[];
}

/** The preview panel every example renders in, class for class. */
const PANEL =
  "rounded-md border border-dashed border-solid border-border bg-surface-raised p-4";

export const ROUTES: readonly Route[] = [
  { id: "table", title: "Table", examples: TABLE_EXAMPLES.map((e) => e.html) },
  {
    id: "avatar",
    title: "Avatar",
    examples: AVATAR_EXAMPLES.map((e) => e.html),
  },
  {
    id: "avatar-group",
    title: "Avatar group",
    examples: AVATAR_GROUP_EXAMPLES.map((e) => e.html),
  },
  { id: "join", title: "Join", examples: JOIN_EXAMPLES.map((e) => e.html) },
];

export function routeFor(id: string): Route {
  const route = ROUTES.find((r) => r.id === id);
  if (route === undefined) {
    throw new Error(
      `layout oracle: unknown route "${id}" (have ${
        ROUTES.map((r) => r.id).join(", ")
      })`,
    );
  }
  return route;
}

/** The fixture page as markup: the reference's shell around the examples. */
export function fixtureHtml(routeId: string): string {
  const route = routeFor(routeId);
  const sections = route.examples
    .map((html) =>
      `<section class="mb-10"><div class="${PANEL}">${html}</div></section>`
    )
    .join("\n");
  return `<div class="flex min-h-screen">
  <nav class="sticky top-0 flex max-h-screen w-1/4 shrink-0 flex-col gap-1 self-start overflow-y-auto border-e border-solid border-border p-4"></nav>
  <main class="min-w-0 flex-1 p-8 pb-16">
${sections}
  </main>
</div>`;
}
