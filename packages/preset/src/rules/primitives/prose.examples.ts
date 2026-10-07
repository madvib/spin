/**
 * Prose examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<h1>` is a heading, a bare `<p>` is a paragraph; the tag is the
 * contract. `<prose>` is the one opt-in — a container that constrains the
 * measure and closes the rhythm. Every class used here resolves against the
 * preset's own catalog; the self-resolution test fails the suite if an
 * example demonstrates what the package cannot do.
 */

export interface ProseExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const proseFixtureNote =
  "Headings, rhythm, lists, quotes and code, styled globally because the " +
  "tag IS the contract — and where we disagree with the platform on " +
  "purpose, we say so in a token rather than a utility. The prose " +
  "container only constrains measure.";

export const PROSE_EXAMPLES: readonly ProseExample[] = [
  {
    name: "Content tags",
    html: `<article>
          <h1>A heading</h1>
          <p>Body text with a <a href="#">link</a> and some <code>inline code</code>.</p>
          <ul><li>Unordered</li><li>Items</li></ul>
          <blockquote>A quotation.<footer>Attribution</footer></blockquote>
          <pre><code>preformatted</code></pre>
        </article>`,
  },
  {
    name: "A constrained measure",
    html: `<prose>
          <h2>Prose</h2>
          <p>The same content, at a comfortable measure. The container states
          nothing but width — every tag keeps whatever it does elsewhere.</p>
        </prose>`,
  },
  {
    name: "Inline text",
    html: `<p>A <a href="#">link</a>, <strong>strong</strong>, <em>em</em>, and <code>code</code>.</p>
        <p><kbd>Ctrl</kbd> + <kbd>C</kbd> to copy.</p>
        <p><mark>Marked</mark>, <ins>inserted</ins>, and <del>deleted</del>.</p>`,
  },
  {
    name: "Code",
    html: `<pre><code>function greet(name) {
  return "Hello, " + name + "!";
}</code></pre>`,
  },
  {
    name: "Media",
    html: `<figure>
          <img src="chart.png" alt="Q3 revenue chart" />
          <figcaption>Q3 revenue by region</figcaption>
        </figure>`,
  },
];
