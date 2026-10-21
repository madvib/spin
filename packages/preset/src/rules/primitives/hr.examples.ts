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

export interface HrExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const hrFixtureNote =
  "A bare `<hr>` drawn from the theme's border token — thicken the borders and the divider thickens with them. `divider-vertical` turns the rule on its side; `divider-dashed` breaks it.";

export const HR_EXAMPLES: readonly HrExample[] = [
  {
    name: "Between paragraphs",
    html: `<p>The rollout is paused at 10% of traffic.</p>
<hr>
<p>The on-call engineer was notified 90 seconds later.</p>`,
  },
  {
    name: "Between sections",
    html: `<article>
  <h2>Rollout</h2>
  <p>Ten per cent of traffic is on v4.12.0 in eu-west-1.</p>
  <hr>
  <h2>Rollback</h2>
  <p>A rollback returns every instance to v4.11.2 in under two minutes.</p>
</article>`,
  },
  {
    name: "Between groups",
    html: `<ul>
  <li>checkout-api</li>
  <li>payments-worker</li>
</ul>
<hr>
<ul>
  <li>search-indexer</li>
  <li>webhooks-relay</li>
</ul>`,
  },
  {
    name: "Vertical",
    html: `<div class="flex items-center">
  <span>production</span>
  <hr class="divider-vertical">
  <span>staging</span>
</div>`,
  },
  {
    name: "Dashed",
    html: `<p>The rollout is paused at 10% of traffic.</p>
<hr class="divider-dashed">
<p>The on-call engineer was notified 90 seconds later.</p>`,
  },
];
