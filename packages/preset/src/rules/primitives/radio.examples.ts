/**
 * Radio examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * An `<input type="radio">` carries the base; there are no variant classes
 * and no custom tags — the control draws itself. Every class used here
 * resolves against the preset's own catalog; the self-resolution test fails
 * the suite if an example demonstrates what the package cannot do.
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
  "A radio is a working radio with no class at all: the input carries the " +
  "base. A group is a radiogroup of labelled inputs sharing a name; " +
  "checked and disabled are states the browser owns.";

export const RADIO_EXAMPLES: readonly RadioExample[] = [
  {
    name: "A group",
    html: `        <div role="radiogroup" aria-label="Choice">
          <label><input type="radio" name="choice" checked> First</label>
          <label><input type="radio" name="choice"> Second</label>
          <label><input type="radio" name="choice" disabled> Disabled</label>
        </div>`,
  },
  {
    name: "States",
    html: row(
      `          <label><input type="radio" name="s" checked> Checked</label>
          <label><input type="radio" name="s"> Unchecked</label>
          <label><input type="radio" name="s" disabled> Disabled</label>`,
    ),
  },
  {
    name: "Stacked",
    html: `        <div role="radiogroup" aria-label="Stacked" class="flex flex-col items-start gap-2">
          <label><input type="radio" name="stack" checked> First</label>
          <label><input type="radio" name="stack"> Second</label>
          <label><input type="radio" name="stack"> Third</label>
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
