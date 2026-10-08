/**
 * Badge examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<badge>` carries the base; tones are variant attributes or
 * classes on the tag. There is no `badge` class and never was one — the
 * tag is the opt-in. Every class used here resolves against the preset's
 * own catalog; the self-resolution test fails the suite if an example
 * demonstrates what the package cannot do.
 */

export interface BadgeExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const badgeFixtureNote =
  "A badge is the smallest component there is: a tag that carries the " +
  "base, and a tone it spends. The tone is a variant attribute or a " +
  "class on the tag — both resolve against the same catalog. Muted " +
  "tones are quieter; small and large change the size; close is a " +
  "remove action, not a tone.";

export const BADGE_EXAMPLES: readonly BadgeExample[] = [
  {
    name: "Tones",
    html: row(
      `          <badge variant="accent">accent</badge>
          <badge variant="success">success</badge>
          <badge variant="warning">warning</badge>
          <badge variant="danger">danger</badge>
          <badge variant="primary">primary</badge>
          <badge variant="secondary">secondary</badge>
          <badge variant="neutral">neutral</badge>`,
    ),
  },
  {
    name: "Muted tones",
    html: row(
      `          <badge variant="accent-muted">accent</badge>
          <badge variant="success-muted">success</badge>
          <badge variant="warning-muted">warning</badge>
          <badge variant="danger-muted">danger</badge>
          <badge variant="primary-muted">primary</badge>
          <badge variant="secondary-muted">secondary</badge>
          <badge variant="neutral-muted">neutral</badge>`,
    ),
  },
  {
    name: "Sizes",
    html: row(
      `          <badge class="badge-sm">small</badge>
          <badge>medium</badge>
          <badge class="badge-lg">large</badge>`,
    ),
  },
  {
    name: "By class",
    html: row(
      `          <badge class="badge-primary">primary</badge>
          <badge class="badge-accent">accent</badge>
          <badge class="badge-success">success</badge>
          <badge class="badge-warning">warning</badge>
          <badge class="badge-danger">danger</badge>
          <badge class="badge-neutral">neutral</badge>
          <badge class="badge-secondary">secondary</badge>`,
    ),
  },
  {
    name: "With content",
    html: row(
      `          <badge>New</badge>
          <badge class="badge-accent">3 items</badge>`,
    ),
  },
  {
    name: "With a remove action",
    html: row(
      `          <badge>Item <button class="badge-close" aria-label="remove">×</button></badge>
          <badge class="badge-accent">Tag <button class="badge-close" aria-label="remove">×</button></badge>`,
    ),
  },
  {
    name: "With an icon",
    html: row(
      `          <badge><i class="i-lucide-bell"></i>Notifications</badge>
          <badge class="badge-accent"><i class="i-lucide-check"></i>Done</badge>`,
    ),
  },
  {
    name: "In text",
    html:
      `<p>Press the <badge class="badge-primary">New</badge> button to continue.</p>`,
  },
  {
    name: "In a button",
    html:
      `<button>Inbox <badge class="badge-accent">3</badge></button>`,
  },
];
