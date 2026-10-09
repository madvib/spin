/**
 * Hr examples — the markup a consumer writes, beside the rule that styles it.
 *
 * A divider is a bare `<hr>`: one tag and no class, drawn from the theme's
 * border tokens and spaced by the scale. It sits between blocks — paragraphs,
 * sections, groups of items — and takes its weight from the theme rather than
 * a heavy default. The self-resolution test fails the suite if an example
 * demonstrates what the package cannot do.
 */

export interface HrExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const hrFixtureNote =
  "A divider is a bare `<hr>`: a rule drawn from the theme's border token — " +
  "a theme that thickens borders thickens its dividers — and spaced by the " +
  "scale through margin-block.";

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
];
