import type { ClassDoc } from "./example.ts";
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

export const PROSE_CLASSES: readonly ClassDoc[] = [
  {
    name: ".prose",
    kind: "Component",
    description: "Long-form reading container: a 65ch measure with flush edges and document furniture.",
  },
  {
    name: ".prose > :first-child",
    kind: "Behavior",
    description: "Drops the leading block margin so the first block sits flush with the container.",
  },
  {
    name: ".prose > :last-child",
    kind: "Behavior",
    description: "Drops the trailing block margin so the last block sits flush with the container.",
  },
];

export const TYPOGRAPHY_CLASSES: readonly ClassDoc[] = [
  { name: "<a>", kind: "Component", description: "Link: themed ink and underline on hover." },
  { name: "<abbr>", kind: "Component", description: "Abbreviation: dotted underline signaling an expansion." },
  { name: "<b>", kind: "Component", description: "Bold run: heavier weight without semantic emphasis." },
  { name: "<blockquote>", kind: "Component", description: "Quotation: inset with a leading rule." },
  { name: "<code>", kind: "Component", description: "Inline code: monospace face at the code size." },
  { name: "<dd>", kind: "Component", description: "Description detail: indented under its term." },
  { name: "<del>", kind: "Component", description: "Deleted run: struck-through." },
  { name: "<dl>", kind: "Component", description: "Description list: term/detail pairs." },
  { name: "<dt>", kind: "Component", description: "Description term: bolded label." },
  { name: "<figcaption>", kind: "Component", description: "Figure caption: small muted line." },
  { name: "<figure>", kind: "Component", description: "Figure: spaced block with caption." },
  { name: "<h1>", kind: "Component", description: "Heading level 1: largest scale step." },
  { name: "<h2>", kind: "Component", description: "Heading level 2." },
  { name: "<h3>", kind: "Component", description: "Heading level 3." },
  { name: "<h4>", kind: "Component", description: "Heading level 4." },
  { name: "<h5>", kind: "Component", description: "Heading level 5." },
  { name: "<h6>", kind: "Component", description: "Heading level 6: smallest scale step." },
  { name: "<ins>", kind: "Component", description: "Inserted run: underlined." },
  { name: "<li>", kind: "Component", description: "List item: spaced row with marker." },
  { name: "<mark>", kind: "Component", description: "Highlighted run." },
  { name: "<ol>", kind: "Component", description: "Ordered list: numbered markers." },
  { name: "<p>", kind: "Component", description: "Paragraph: spaced block of body copy." },
  { name: "<pre>", kind: "Component", description: "Preformatted block: code chrome." },
  { name: "<samp>", kind: "Component", description: "Sample output: monospace." },
  { name: "<small>", kind: "Component", description: "Small text: smaller size, muted." },
  { name: "<strong>", kind: "Component", description: "Strong emphasis: heavier weight." },
  { name: "<sub>", kind: "Component", description: "Subscript: smaller, lowered." },
  { name: "<sup>", kind: "Component", description: "Superscript: smaller, raised." },
  { name: "<ul>", kind: "Component", description: "Unordered list: bulleted markers." },
];

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
            <pre><code>eu-west-1   p95: 42ms\nus-east-2   p95: 58ms</code></pre>
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
            <pre><code>eu-west-1   p95: 42ms\nus-east-2   p95: 58ms</code></pre>
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
  {
    name: "Paragraphs in a flex row",
    html: `<div class="flex gap-2">
          <p>Every instance returns to the previous release.</p>
          <p>The failed one stays in the history.</p>
        </div>`,
  },
  {
    name: "Paragraphs in a grid",
    html: `<div class="grid gap-2">
          <p>Every instance returns to the previous release.</p>
          <p>The failed one stays in the history.</p>
        </div>`,
  },
];

/**
 * The bare-document rhythm pair (Stage DEF): the same unclassed article
 * rendered against the old double-sided rhythm and the fixed single-sided
 * one. Read the two side by side — the after document keeps one rhythm unit
 * between every block, the before one doubles it above every heading and at
 * every rule.
 */
export const BARE_DOCUMENT_BEFORE_HTML = `<article>
  <h1>Rolling back a release</h1>
  <p>A rollback sends every instance back to the previous release. It takes under two minutes.</p>
  <h2>What changes</h2>
  <p>Every instance returns to the previous release. The failed one stays in the history.</p>
  <hr>
  <dl><dt>Rollback</dt><dd>Return to the previous release.</dd><dd>Keep the failed one in the history.</dd></dl>
  <p>The definitions above stacked flush before the fix: no block margin at all.</p>
</article>`;

export const BARE_DOCUMENT_AFTER_HTML = `<article>
  <h1>Rolling back a release</h1>
  <p>A rollback sends every instance back to the previous release. It takes under two minutes.</p>
  <h2>What changes</h2>
  <p>Every instance returns to the previous release. The failed one stays in the history.</p>
  <hr>
  <dl><dt>Rollback</dt><dd>Return to the previous release.</dd><dd>Keep the failed one in the history.</dd></dl>
  <p>The definitions above breathe a step apart now: the same reach as <code>li + li</code>.</p>
</article>`;

export const PROSE_EXAMPLES: readonly ProseExample[] = [
  ...TYPOGRAPHY_EXAMPLES,
  ...PROSE_DOC_EXAMPLES,
  {
    name: "Bare-document rhythm, before (double-sided)",
    html: BARE_DOCUMENT_BEFORE_HTML,
  },
  {
    name: "Bare-document rhythm, after (single-sided)",
    html: BARE_DOCUMENT_AFTER_HTML,
  },
];
