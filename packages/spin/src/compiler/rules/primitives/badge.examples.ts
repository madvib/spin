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

import type { ClassDoc } from "./example.ts";

export const BADGE_CLASSES: readonly ClassDoc[] = [
  {
    name: "<badge>",
    kind: "Component",
    description: "Smallest surface; spends a tone for counts and states",
  },
  {
    name: 'variant="*"',
    kind: "Color",
    description: "Tone fills the badge (also as class .badge-*)",
  },
  {
    name: 'variant="*-muted"',
    kind: "Color",
    description: "Quieter tone for states that wait",
  },
  {
    name: ".badge-sm",
    kind: "Size",
    description: "Compact badge for dense rows",
  },
  {
    name: ".badge-lg",
    kind: "Size",
    description: "Roomy badge for standalone counts",
  },
  {
    name: ".badge-close",
    kind: "Part",
    description: "Dismiss control inside a badge",
  },
];

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
  "The smallest component: a tag that carries the base and spends a tone. Tones are variants or classes, `-muted` suffixes are quieter, sm and lg change the size.";

export const BADGE_EXAMPLES: readonly BadgeExample[] = [
  {
    name: "Tones",
    html: row(
      `          <badge variant="accent">beta</badge>
          <badge variant="success">passing</badge>
          <badge variant="warning">degraded</badge>
          <badge variant="danger">failing</badge>
          <badge variant="primary">production</badge>
          <badge variant="secondary">staging</badge>
          <badge variant="neutral">paused</badge>`,
    ),
  },
  {
    name: "Muted tones",
    html: row(
      `          <badge variant="accent-muted">beta</badge>
          <badge variant="success-muted">passing</badge>
          <badge variant="warning-muted">degraded</badge>
          <badge variant="danger-muted">failing</badge>
          <badge variant="primary-muted">production</badge>
          <badge variant="secondary-muted">staging</badge>
          <badge variant="neutral-muted">paused</badge>`,
    ),
  },
  {
    name: "Sizes",
    html: row(
      `          <badge class="badge-sm">canary</badge>
          <badge>canary</badge>
          <badge class="badge-lg">canary</badge>`,
    ),
  },
  {
    name: "By class",
    html: row(
      `          <badge class="badge-primary">production</badge>
          <badge class="badge-accent">beta</badge>
          <badge class="badge-success">passing</badge>
          <badge class="badge-warning">degraded</badge>
          <badge class="badge-danger">failing</badge>
          <badge class="badge-neutral">paused</badge>
          <badge class="badge-secondary">staging</badge>`,
    ),
  },
  {
    name: "With content",
    html: row(
      `          <badge>required</badge>
          <badge class="badge-accent">canary at 10% of traffic</badge>`,
    ),
  },
  {
    name: "Empty",
    html: row(
      `          <badge class="badge-accent"></badge>
          <badge class="badge-success"></badge>`,
    ),
  },
  {
    name: "With a remove action",
    html: row(
      `          <badge>canary <button class="badge-close" aria-label="remove">×</button></badge>
          <badge class="badge-accent">preview <button class="badge-close" aria-label="remove">×</button></badge>`,
    ),
  },
  {
    name: "Close on a muted badge",
    html: row(
      `          <badge class="badge-accent-muted">canary <button class="badge-close" aria-label="remove">×</button></badge>
          <badge class="badge-danger-muted">failed <button class="badge-close" aria-label="remove">×</button></badge>`,
    ),
  },
  {
    name: "With an icon",
    html: row(
      `          <badge><i class="i-lucide-bell"></i>3 alerts</badge>
          <badge class="badge-accent"><i class="i-lucide-check"></i>Passed</badge>`,
    ),
  },
  {
    name: "In text",
    html:
      `<p>Every <badge class="badge-primary">required</badge> check must pass before the release continues.</p>`,
  },
  {
    name: "In a button",
    html: `<button>Alerts <badge class="badge-accent">3</badge></button>`,
  },
];
