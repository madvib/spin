/**
 * Alert examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<alert>` carries the base; tones are variant attributes on the
 * tag. There is no `alert` class and never was one — the tag is the opt-in.
 * Every variant used here resolves against the preset's own catalog; the
 * self-resolution test fails the suite if an example demonstrates what the
 * package cannot do.
 */

import type { ClassDoc } from "./example.ts";
import { sample } from "./sample-copy.ts";

export interface AlertExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const ALERT_CLASSES: readonly ClassDoc[] = [
  {
    name: "<alert>",
    kind: "Component",
    description: "Surface with a strong edge in its tone",
  },
  {
    name: 'role="status"',
    kind: "Behavior",
    description: "Advisory edge for notices that need no action",
  },
  {
    name: 'role="alert"',
    kind: "Behavior",
    description: "Heavier edge for failures that demand attention",
  },
  {
    name: 'variant="*"',
    kind: "Color",
    description: "Tone marks the edge; the surface stays the surface",
  },
  {
    name: 'variant="*-muted"',
    kind: "Color",
    description: "Quieter tone that tints the surface instead",
  },
];

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center justify-center gap-2">
${inner}
        </div>`;

export const alertFixtureNote =
  "A surface with a strong edge in its tone — the tone marks the alert, the surface stays the surface. `role=alert` takes a heavier edge than `role=status`.";

export const ALERT_EXAMPLES: readonly AlertExample[] = [
  {
    name: "Tones",
    html: row(
      `          <alert role="status" variant="accent">Canary is at 10% of traffic</alert>
          <alert role="status" variant="success">Deploy #4821 finished in 4m 12s</alert>
          <alert role="status" variant="warning">p95 latency is 812 ms in eu-west-1</alert>
          <alert role="alert" variant="danger">Deploy #4820 failed 4 health checks</alert>
          <alert role="status" variant="primary">Maintenance window at 02:00 UTC</alert>
          <alert role="status" variant="secondary">v4.11.2 is ready to roll back to</alert>
          <alert role="status" variant="neutral">3 regions are running v4.12.0</alert>`,
    ),
  },
  {
    name: "Muted tones",
    html: row(
      `          <alert role="status" variant="accent-muted">Canary is at 10% of traffic</alert>
          <alert role="status" variant="success-muted">Deploy #4821 finished in 4m 12s</alert>
          <alert role="status" variant="warning-muted">p95 latency is 812 ms in eu-west-1</alert>
          <alert role="alert" variant="danger-muted">Deploy #4820 failed 4 health checks</alert>
          <alert role="status" variant="primary-muted">Maintenance window at 02:00 UTC</alert>
          <alert role="status" variant="secondary-muted">v4.11.2 is ready to roll back to</alert>
          <alert role="status" variant="neutral-muted">3 regions are running v4.12.0</alert>`,
    ),
  },
  {
    name: "Roles",
    html: row(
      `          <alert role="status">The rollout is at 10% of traffic</alert>
          <alert role="alert">checkout-api is returning 503</alert>`,
    ),
  },
  {
    name: "Title and description",
    html: row(
      `          <alert role="status" variant="accent">
            <strong>${sample.note.title}</strong>
            <p>${sample.note.body}</p>
          </alert>`,
    ),
  },
  {
    name: "Layout · horizontal",
    html: row(
      `          <alert role="status" variant="accent" class="flex items-center gap-2">
            <i class="i-lucide-info"></i>
            <span>${sample.note.body}</span>
          </alert>`,
    ),
  },
];
