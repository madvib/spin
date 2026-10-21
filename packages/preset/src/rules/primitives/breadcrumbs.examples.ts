/**
 * Breadcrumbs examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A trail is a class-entry composite: `breadcrumbs` on the `<nav>`,
 * `breadcrumbs-list` on its `<ol>`. The claim is a class because a bare
 * `<nav>` or `<ol>` is generic — no tag genuinely means "breadcrumb trail",
 * so the class is the opt-in. Every earlier step is a link; the last step is
 * the page the reader is on, so it carries `aria-current="page"` and is not
 * a link. The separator is typed content, not a palette choice. Every class
 * used here resolves against the preset's own catalog; the self-resolution
 * test fails the suite if an example demonstrates what the package cannot
 * do.
 */

export interface BreadcrumbsExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const breadcrumbsFixtureNote =
  "A trail of links; the last step is `aria-current`, not a link. The separator is content, not a component.";

const trail = (
  indent: string,
  ...steps: readonly string[]
): string =>
  `${indent}<nav class="breadcrumbs" aria-label="Breadcrumb">
${indent}  <ol class="breadcrumbs-list">
${steps.map((step) => `${indent}    <li>${step}</li>`).join("\n")}
${indent}  </ol>
${indent}</nav>`;

const link = (href: string, label: string): string =>
  `<a href="${href}">${label}</a>`;

const current = (label: string): string =>
  `<span aria-current="page">${label}</span>`;

export const BREADCRUMBS_EXAMPLES: readonly BreadcrumbsExample[] = [
  {
    name: "Boxed",
    html: `<nav class="breadcrumbs breadcrumbs-box" aria-label="Breadcrumb">
  <ol class="breadcrumbs-list">
    <li><a href="#">Lodestar</a></li>
    <li><a href="#">checkout-api</a></li>
    <li><a href="#" aria-current="page">Deploy #4821</a></li>
  </ol>
</nav>`,
  },
  {
    name: "Arrows",
    html: `<nav class="breadcrumbs breadcrumbs-arrow" aria-label="Breadcrumb">
  <ol class="breadcrumbs-list">
    <li><a href="#">Lodestar</a></li>
    <li><a href="#">checkout-api</a></li>
    <li><a href="#" aria-current="page">Deploy #4821</a></li>
  </ol>
</nav>`,
  },
  {
    name: "Breadcrumbs · three steps",
    html: trail(
      "        ",
      link("/", "Lodestar"),
      link("/services/checkout-api", "checkout-api"),
      current("Deploy #4821"),
    ),
  },
  {
    name: "Breadcrumbs · a trail that wraps",
    html: trail(
      "        ",
      link("/", "Lodestar"),
      link("/services", "Services"),
      link("/services/checkout-api", "checkout-api"),
      link("/services/checkout-api/deploys", "Deployments"),
      link("/services/checkout-api/deploys/4821", "4821"),
      link("/services/checkout-api/deploys/4821/logs", "Runtime logs"),
      current("Build output"),
    ),
  },
  {
    name: "Breadcrumbs · in a page header",
    html: `        <header>
          <h2>Rollout settings</h2>
${
      trail(
        "          ",
        link("/", "Lodestar"),
        link("/services/checkout-api", "checkout-api"),
        current("Rollout settings"),
      )
    }
        </header>`,
  },
];
