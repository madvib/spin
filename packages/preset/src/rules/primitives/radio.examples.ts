/**
 * Radio examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<radio>` or `<input type="radio">` carries the base; the tag is
 * the opt-in and the platform's spelling is the same control to the rule.
 * There are no variant classes — the control draws itself. Every class
 * used here resolves against the preset's own catalog; the self-resolution
 * test fails the suite if an example demonstrates what the package cannot
 * do.
 */

export interface RadioExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const radioFixtureNote =
  "A radio is a working radio with no class at all: the tag carries the " +
  'base, and `<radio>` and `<input type="radio">` reach the same rule. A ' +
  "group is a radiogroup of labelled inputs sharing a name; checked and " +
  "disabled are states the browser owns, so they are real on the " +
  "platform's spelling.";

export const RADIO_EXAMPLES: readonly RadioExample[] = [
  {
    name: "Both spellings",
    html: row(
      `          <label><radio name="spell"> tag</label>
          <label><input type="radio" name="spell" checked> input</label>`,
    ),
  },
  {
    name: "A group",
    html: `        <div role="radiogroup" aria-label="Choice">
          <label><input type="radio" name="choice" checked> First</label>
          <label><input type="radio" name="choice"> Second</label>
          <label><input type="radio" name="choice" disabled> Disabled</label>
        </div>`,
  },
  {
    name: "Disabled",
    html: row(
      `          <label><input type="radio" name="d" checked disabled> Disabled, checked</label>
          <label><input type="radio" name="d" disabled> Disabled</label>`,
    ),
  },
];
