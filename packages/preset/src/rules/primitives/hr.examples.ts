/**
 * Hr examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A divider is a bare `<hr>`: one tag and no class, drawn from the theme's
 * border tokens and spaced by the scale. It sits between blocks — paragraphs,
 * sections, groups of items — and takes its weight from the theme rather than
 * a heavy default. Two variants give the divider its range: `divider-vertical`
 * turns the same rule on its side for a row of items, and `divider-dashed`
 * keeps the line but breaks it, which reads as continuation where the solid
 * rule reads as a stop. Every class used here resolves against the preset's
 * own catalog; the self-resolution test fails the suite if an example
 * demonstrates what the package cannot do.
 */
import type { ClassDoc } from "./example.ts";

export interface HrExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const hrFixtureNote =
  "A bare `<hr>` drawn from the theme's border token — thicken the borders and the divider thickens with them. `divider-vertical` turns the rule on its side; `divider-dashed` breaks it.";

export const HR_CLASSES: readonly ClassDoc[] = [
  {
    name: "<hr>",
    kind: "Component",
    description: "Rule between blocks; zero height with the theme's border on the block-start edge",
  },
  {
    name: ".divider-vertical",
    kind: "Modifier",
    description: "Turns the rule on its side for a row of items; length from the spacing scale",
  },
  {
    name: ".divider-dashed",
    kind: "Modifier",
    description: "Breaks the line; reads as continuation where the solid rule reads as a stop",
  },
];

export const HR_EXAMPLES: readonly HrExample[] = [
  {
    name: "Between paragraphs",
    html: `<p><i class="i-lucide-rocket" aria-hidden="true"></i>The rollout is paused at 10% of traffic.</p>
<hr>
<p><i class="i-lucide-bell" aria-hidden="true"></i>The on-call engineer was notified 90 seconds later.</p>`,
  },
  {
    name: "Between sections",
    html: `<article>
  <h2>Rollout</h2>
  <p>Ten per cent of traffic is on v4.12.0 in eu-west-1.</p>
  <hr class="divider-dashed">
  <h2>Rollback</h2>
  <p>A rollback returns every instance to v4.11.2 in under two minutes.</p>
</article>`,
  },
  {
    name: "Status row",
    html: `<div class="flex items-center">
  <badge variant="success">live</badge>
  <hr class="divider-vertical">
  <span>production</span>
  <hr class="divider-vertical">
  <badge variant="warning">canary</badge>
  <span>staging</span>
</div>`,
  },
];
