/**
 * Progress examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<progress>` or `<meter>` carries the base; the tag is the opt-in.
 * There is no `progress` class and never was one. Every class used here
 * resolves against the preset's own catalog; the self-resolution test fails
 * the suite if an example demonstrates what the package cannot do.
 */

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
  "A progress bar is a native element with a real value and a real " +
  "indeterminate state — no JavaScript. The track is a surface with a lit " +
  "inner edge, the same inset depth a control gets. An indeterminate bar " +
  "gets motion: a static bar with no fill reads as a bar that failed to " +
  "load.";

export const PROGRESS_EXAMPLES: readonly ProgressExample[] = [
  {
    name: "Values",
    html: row(
      `          <progress value="100" max="100"></progress>
          <progress value="50" max="100"></progress>
          <progress></progress>`,
    ),
  },
  {
    name: "A meter · a value in a known range",
    html: row(
      `          <meter value="0.4" min="0" max="1" low="0.3" high="0.8"></meter>`,
    ),
  },
  {
    name: "Indeterminate · the class",
    html: row(
      `          <progress class="progress-indeterminate"></progress>`,
    ),
  },
];
