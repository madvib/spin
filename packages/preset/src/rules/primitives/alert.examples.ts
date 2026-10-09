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

export interface AlertExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const alertFixtureNote =
  "An alert is a surface with a strong edge in the tone, not a fill. The " +
  "tone marks the alert; the surface stays the surface. role=alert gets a " +
  "heavier edge than role=status because an assertion interrupts and a " +
  "status does not.";

export const ALERT_EXAMPLES: readonly AlertExample[] = [
  {
    name: "Tones",
    html: row(
      `          <alert role="status" variant="accent">accent</alert>
          <alert role="status" variant="success">success</alert>
          <alert role="status" variant="warning">warning</alert>
          <alert role="alert" variant="danger">danger</alert>
          <alert role="status" variant="primary">primary</alert>
          <alert role="status" variant="secondary">secondary</alert>
          <alert role="status" variant="neutral">neutral</alert>`,
    ),
  },
  {
    name: "Muted tones",
    html: row(
      `          <alert role="status" variant="accent-muted">accent</alert>
          <alert role="status" variant="success-muted">success</alert>
          <alert role="status" variant="warning-muted">warning</alert>
          <alert role="alert" variant="danger-muted">danger</alert>
          <alert role="status" variant="primary-muted">primary</alert>
          <alert role="status" variant="secondary-muted">secondary</alert>
          <alert role="status" variant="neutral-muted">neutral</alert>`,
    ),
  },
  {
    name: "Roles",
    html: row(
      `          <alert role="status">status</alert>
          <alert role="alert">alert</alert>`,
    ),
  },
  {
    name: "Title and description",
    html: row(
      `          <alert role="status" variant="accent">
            <strong>Backup complete</strong>
            <p>Your files were saved to the cloud.</p>
          </alert>`,
    ),
  },
  {
    name: "Layout · horizontal",
    html: row(
      `          <alert role="status" variant="accent" class="flex items-center gap-2">
            <i class="i-lucide-info"></i>
            <span>Your files were saved to the cloud.</span>
          </alert>`,
    ),
  },
];
