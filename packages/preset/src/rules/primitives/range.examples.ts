/**
 * Range examples — the markup a consumer writes, beside the rule that styles
 * it.
 *
 * A bare `<input type="range">` carries the base; the `type` attribute is the
 * opt-in, and there is no `range` class and never was one — the field box
 * owns the bare `input` token, and the type extractor is what makes a slider
 * its own thing. Every class used here resolves against the preset's own
 * vocabulary; the self-resolution test fails the suite if an example
 * demonstrates what the package cannot do.
 */

export interface RangeExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const rangeFixtureNote =
  "A slider with no class: `type=range` is the opt-in. Track and thumb are pseudo-elements, stated for both engines; the fill follows `--range-progress`, the share of the travel the value has covered; `disabled` dims the control.";

export const RANGE_EXAMPLES: readonly RangeExample[] = [
  {
    name: "Range · min, max, step and a value",
    html: row(
      `          <input type="range" min="0" max="100" step="5" value="40" style="--range-progress: 40%">`,
    ),
  },
  {
    name: "Range · disabled",
    html: row(
      `          <input type="range" min="0" max="10" step="1" value="3" disabled style="--range-progress: 30%">`,
    ),
  },
  {
    name: "Range · labelled, the value as plain text",
    html: row(
      `          <label><input type="range" min="0" max="100" value="40" style="--range-progress: 40%"><span>40%</span></label>`,
    ),
  },
  {
    name: "Range · a non-default span",
    html: row(
      `          <input type="range" min="20" max="80" value="60" style="--range-progress: 66%">`,
    ),
  },
];
