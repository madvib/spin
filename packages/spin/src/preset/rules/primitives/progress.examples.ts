/**
 * Progress examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<progress>` carries the base; the tag is the opt-in.
 * There is no `progress` class and never was one. Every class used here
 * resolves against the preset's own catalog; the self-resolution test fails
 * the suite if an example demonstrates what the package cannot do.
 */

import type { ClassDoc } from "./example.ts";

export const PROGRESS_CLASSES: readonly ClassDoc[] = [
  {
    name: "<progress>",
    kind: "Component",
    description: "Native bar for work with a known end",
  },
  {
    name: ".progress-indeterminate",
    kind: "Behavior",
    description: "Sweeping bar for work with no measurable end",
  },
];

export interface ProgressExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const progressFixtureNote =
  "A native bar with a real value and a real indeterminate state. An indeterminate bar sweeps, because a static empty bar reads as a failure to load.";

export const PROGRESS_EXAMPLES: readonly ProgressExample[] = [
  {
    name: "Values",
    html: `<div class="flex flex-col gap-2">
          <label><span>Fetched 12 of 12 images</span><progress value="100" max="100"></progress></label>
          <label><span>Rolled out to 6 of 12 regions</span><progress value="50" max="100"></progress></label>
          <label><span>Waiting for the canary verdict</span><progress></progress></label>
        </div>`,
  },
  {
    name: "Indeterminate · the class",
    html: row(
      `          <progress class="progress-indeterminate"></progress>`,
    ),
  },
];
