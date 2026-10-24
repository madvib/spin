/**
 * Prose examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * Two surfaces, and they are two different owners.
 *
 * The TYPOGRAPHY is spin's own for the whole application: a heading, a
 * paragraph, a list, a link, a code run, a bold run, a small label and a
 * caption each get their type and their spacing from the theme, wherever they
 * are written. Those examples are bare — no wrapper — because a page's
 * paragraphs are not waiting for a document column to look like typography.
 *
 * The DOCUMENT treatment is `<prose>`'s: the quotation's inset, the figure
 * and its caption, the media's box, the code block's chrome, the highlight,
 * the inserted and deleted runs. Those are a long-form column's furniture,
 * and the examples that show them are wrapped in the column they belong to.
 *
 * Every class used here resolves against the preset's own catalog; the
 * self-resolution test fails the suite if an example demonstrates what the
 * package cannot do.
 */

export interface ProseExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const proseFixtureNote =
  "The document column: a `<prose>` states nothing about type — it adds the furniture of a long-form read: the quotation's inset, the media's box, the code block's chrome, the marks.";

export const typographyFixtureNote =
  "The theme's typography, everywhere: h1 through h6 are one ladder of sizes and weights, and a paragraph, a list, a quotation and a code block read the same in a page as in a document.";

export const TYPOGRAPHY_EXAMPLES: readonly ProseExample[] = [
  {
    name: "Heading scale",
    html: `<h1>Release 4.12.0</h1>
        <h2>Rollout status</h2>
        <h3>Health checks</h3>
        <h4>eu-west-1</h4>
        <h5>09:14 UTC</h5>
        <h6>12 of 12 passed</h6>`,
  },
  {
    name: "Body copy",
    html: `<h2>Rolling back</h2>
        <p>A rollback sends every instance back to the previous release and keeps the failed one in the history. It takes under two minutes.</p>
        <ul><li>Every instance returns to the previous release</li><li>The failed one stays in the history</li></ul>`,
  },
  {
    name: "Inline text",
    html:
      `<p>A <a href="#">runbook</a>, <strong>deployed</strong>, <em>paused</em>, and <code>rollback</code>. <small>Updated 09:14 UTC.</small></p>
        <p><kbd>Ctrl</kbd> + <kbd>Enter</kbd> to deploy.</p>`,
  },
  {
    name: "A quotation in a page",
    html:
      `<blockquote>The canary looked clean for ten minutes, which is exactly how long the last failure took.</blockquote>`,
  },
  {
    name: "A code block in a page",
    html: `<pre><code>deploy status --service checkout-api</code></pre>`,
  },
  {
    name: "A figure in a page",
    html: `<figure>
            <img src="chart.png" alt="Latency by region over 24 hours" />
            <figcaption>p95 latency by region, last 24 hours</figcaption>
          </figure>`,
  },
];

export const PROSE_DOC_EXAMPLES: readonly ProseExample[] = [
  {
    name: "A constrained measure",
    html: `<prose>
          <h2>Rolling back</h2>
          <p>A rollback sends every instance back to the previous release and keeps the failed one in the history. It takes under two minutes.</p>
        </prose>`,
  },
  {
    name: "The furniture of a document",
    html: `<prose>
          <blockquote>The canary looked clean for ten minutes, which is exactly how long the last failure took.<footer>Tomas Berg, release manager</footer></blockquote>
          <figure>
            <img src="chart.png" alt="Latency by region over 24 hours" />
            <figcaption>p95 latency by region, last 24 hours</figcaption>
          </figure>
          <pre><code>deploy status --service checkout-api</code></pre>
        </prose>`,
  },
  {
    name: "The marks of a document",
    html: `<prose>
          <p><mark>Canary</mark>, <ins>eu-west-1</ins>, and <del>us-east-2</del>.</p>
        </prose>`,
  },
];

export const PROSE_EXAMPLES: readonly ProseExample[] = [
  ...TYPOGRAPHY_EXAMPLES,
  ...PROSE_DOC_EXAMPLES,
];
