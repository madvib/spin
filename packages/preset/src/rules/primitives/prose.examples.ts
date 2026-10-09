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
  "Document composition: an article states nothing — its tags carry headings, lists, quotes and code. `prose` only constrains the measure.";

export const PROSE_DOC_EXAMPLES: readonly ProseExample[] = [
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

export const typographyFixtureNote =
  "Text at scale: h1 through h6 are one ladder of sizes and weights, not classes.";

export const TYPOGRAPHY_EXAMPLES: readonly ProseExample[] = [
  {
    name: "Heading scale",
    html: `<h1>Heading 1</h1>
        <h2>Heading 2</h2>
        <h3>Heading 3</h3>
        <h4>Heading 4</h4>
        <h5>Heading 5</h5>
        <h6>Heading 6</h6>`,
  },
  {
    name: "Inline text",
    html:
      `<p>A <a href="#">link</a>, <strong>strong</strong>, <em>em</em>, and <code>code</code>.</p>
        <p><kbd>Ctrl</kbd> + <kbd>C</kbd> to copy.</p>
        <p><mark>Marked</mark>, <ins>inserted</ins>, and <del>deleted</del>.</p>`,
  },
];

export const PROSE_EXAMPLES: readonly ProseExample[] = [
  ...TYPOGRAPHY_EXAMPLES,
  ...PROSE_DOC_EXAMPLES,
];
