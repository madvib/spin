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
    html: `<p>One thought ends here.</p>
<hr>
<p>The next begins.</p>`,
  },
  {
    name: "Between sections",
    html: `<article>
  <h2>Overview</h2>
  <p>The first section.</p>
  <hr>
  <h2>Details</h2>
  <p>The second section.</p>
</article>`,
  },
  {
    name: "Between groups",
    html: `<ul>
  <li>Alpha</li>
  <li>Bravo</li>
</ul>
<hr>
<ul>
  <li>Charlie</li>
  <li>Delta</li>
</ul>`,
  },
  {
    name: "Vertical",
    html: `<div class="flex items-center">
  <span>Overview</span>
  <hr class="divider-vertical">
  <span>Details</span>
</div>`,
  },
  {
    name: "Dashed",
    html: `<p>One thought ends here.</p>
<hr class="divider-dashed">
<p>The next begins.</p>`,
  },
];
