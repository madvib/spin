/**
 * Field examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<input>` or `<textarea>` carries the base; the tag is the opt-in.
 * There is no `field` class on the control itself and never was one — the tag
 * carries the box. Every class used here resolves against the preset's own
 * catalog; the self-resolution test fails the suite if an example
 * demonstrates what the package cannot do.
 */

export interface FieldExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const fieldFixtureNote =
  "A text field works with no class: the tag carries the box and states are attributes. `aria-invalid` carries validity — unjudged, passed, failed.";

export const INPUT_EXAMPLES: readonly FieldExample[] = [
  {
    name: "Input · states",
    html: row(
      `          <label><input type="text" placeholder="Search services"><span>Search</span></label>
          <label><input type="text" value="checkout-api"><span>Service name</span></label>
          <label><input type="text" value="payments-worker" disabled><span>Locked by policy</span></label>
          <label><input type="text" value="v4.12.0" readonly><span>Version</span></label>`,
    ),
  },
  {
    name: "Input · validity",
    html: row(
      `          <label><input type="text" aria-invalid value="v4.12"><span>Unjudged</span></label>
          <label><input type="text" aria-invalid="false" value="v4.12.0"><span>Passed</span></label>
          <label><input type="text" aria-invalid="true" value="v4.12.0-rc1"><span>Failed</span></label>`,
    ),
  },
  {
    name: "Input · types",
    html: row(
      `          <label><input type="email" placeholder="priya@lodestar.dev"><span>Email</span></label>
          <label><input type="password" placeholder="••••••"><span>Password</span></label>
          <label><input type="search" placeholder="Find a service"><span>Search</span></label>
          <label><input type="number" value="12"><span>Instances</span></label>
          <label><input type="date" value="2026-10-19"><span>Date</span></label>`,
    ),
  },
];


export const textareaFixtureNote =
  "A multi-line box that wraps and resizes vertically, with a min height that keeps a one-row textarea a textarea.";

export const TEXTAREA_EXAMPLES: readonly FieldExample[] = [
  {
    name: "Textarea",
    html: row(
      `          <label><textarea rows="2" placeholder="Why are you rolling back?"></textarea><span>Reason</span></label>
          <label><textarea aria-invalid="true" rows="2"></textarea><span>Invalid</span></label>
          <label><textarea rows="2" disabled>Deploy blocked by failing health checks</textarea><span>Locked by policy</span></label>`,
    ),
  },
  {
    name: "Textarea · readonly",
    html: row(
      `          <label><textarea rows="2" readonly>Deployed at 09:14 UTC by Tomas Berg</textarea><span>Deployed by</span></label>`,
    ),
  },
  {
    name: "Textarea · one line at rest",
    html: row(
      `          <label><textarea rows="1" placeholder="What went wrong?"></textarea><span>Reason</span></label>`,
    ),
  },
];

export const FIELD_EXAMPLES: readonly FieldExample[] = [
  ...INPUT_EXAMPLES,
  ...TEXTAREA_EXAMPLES,
];
