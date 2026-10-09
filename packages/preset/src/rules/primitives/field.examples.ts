/**
 * Field examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<input>`, `<select>` or `<textarea>` carries the base; the tag is
 * the opt-in. There is no `field` class on the control itself and never was
 * one — the tag carries the box. Every class used here resolves against the
 * preset's own catalog; the self-resolution test fails the suite if an
 * example demonstrates what the package cannot do.
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
      `          <label><input type="text" placeholder="Empty"><span>Empty</span></label>
          <label><input type="text" value="Hello"><span>Filled</span></label>
          <label><input type="text" value="Cannot touch" disabled><span>Disabled</span></label>
          <label><input type="text" value="Read only" readonly><span>Readonly</span></label>`,
    ),
  },
  {
    name: "Input · validity",
    html: row(
      `          <label><input type="text" aria-invalid value="x"><span>Unjudged</span></label>
          <label><input type="text" aria-invalid="false" value="x"><span>Passed</span></label>
          <label><input type="text" aria-invalid="true" value="x"><span>Failed</span></label>`,
    ),
  },
  {
    name: "Input · types",
    html: row(
      `          <label><input type="email" placeholder="you@example.com"><span>Email</span></label>
          <label><input type="password" placeholder="••••••"><span>Password</span></label>
          <label><input type="search" placeholder="Find"><span>Search</span></label>
          <label><input type="number" value="42"><span>Number</span></label>
          <label><input type="date"><span>Date</span></label>`,
    ),
  },
];

export const selectFixtureNote =
  "A select draws itself rather than wearing the platform's chrome, on the same box a text field takes.";

export const SELECT_EXAMPLES: readonly FieldExample[] = [
  {
    name: "Select",
    html: row(
      `          <label><select><option>One</option><option>Two</option></select><span>One choice</span></label>
          <label><select disabled><option>Unavailable</option></select><span>Disabled</span></label>`,
    ),
  },
  {
    name: "Select · validity",
    html: row(
      `          <label><select><option>Unjudged</option></select><span>Unjudged</span></label>
          <label><select aria-invalid="false"><option>Passed</option></select><span>Passed</span></label>
          <label><select aria-invalid="true"><option>Failed</option></select><span>Failed</span></label>`,
    ),
  },
  {
    name: "Select · grouped options",
    html: row(
      `          <label><select>
            <optgroup label="Fruit"><option>Apple</option><option>Pear</option></optgroup>
            <optgroup label="Vegetable"><option>Beet</option></optgroup>
          </select><span>Groups are the platform's</span></label>`,
    ),
  },
  {
    name: "Select · multiple",
    html: row(
      `          <label><select multiple size="4">
            <option selected>Alpha</option><option>Bravo</option>
            <option>Charlie</option><option>Delta</option>
          </select><span>Size, not classes</span></label>`,
    ),
  },
];

export const textareaFixtureNote =
  "A multi-line box that wraps and resizes vertically, with a min height that keeps a one-row textarea a textarea.";

export const TEXTAREA_EXAMPLES: readonly FieldExample[] = [
  {
    name: "Textarea",
    html: row(
      `          <label><textarea rows="2" placeholder="Multi-line"></textarea><span>Default</span></label>
          <label><textarea aria-invalid="true" rows="2"></textarea><span>Invalid</span></label>
          <label><textarea rows="2" disabled>Cannot touch</textarea><span>Disabled</span></label>`,
    ),
  },
  {
    name: "Textarea · readonly",
    html: row(
      `          <label><textarea rows="2" readonly>Cannot touch</textarea><span>Read only, still selectable</span></label>`,
    ),
  },
  {
    name: "Textarea · one line at rest",
    html: row(
      `          <label><textarea rows="1" placeholder="Grows by the author's drag, never by content"></textarea><span>Min height keeps it a textarea</span></label>`,
    ),
  },
];

export const FIELD_EXAMPLES: readonly FieldExample[] = [
  ...INPUT_EXAMPLES,
  ...SELECT_EXAMPLES,
  ...TEXTAREA_EXAMPLES,
];
