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
  "A text field works with no class at all: the tag carries the box, and " +
  "states are attributes on the tag. Disabled and readonly are platform " +
  "states; aria-invalid carries validity — unjudged, passed, failed. The " +
  "type is the platform's concern: email gets validation, search gets a " +
  "clear button, number gets a stepper.";

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
  "A select draws itself rather than wearing the platform's chrome, and it " +
  "carries the same box as a text field — one box per control kind, not " +
  "one class. Disabled is an attribute; the options are content.";

export const SELECT_EXAMPLES: readonly FieldExample[] = [
  {
    name: "Select",
    html: row(
      `          <label><select><option>One</option><option>Two</option></select><span>One choice</span></label>
          <label><select disabled><option>Unavailable</option></select><span>Disabled</span></label>`,
    ),
  },
];

export const textareaFixtureNote =
  "A textarea is a multi-line box that grows nowhere on its own: rows is " +
  "the platform's, the resize handle is the author's, and the box knows " +
  "aria-invalid like every other field.";

export const TEXTAREA_EXAMPLES: readonly FieldExample[] = [
  {
    name: "Textarea",
    html: row(
      `          <label><textarea rows="2" placeholder="Multi-line"></textarea><span>Default</span></label>
          <label><textarea aria-invalid="true" rows="2"></textarea><span>Invalid</span></label>
          <label><textarea rows="2" disabled>Cannot touch</textarea><span>Disabled</span></label>`,
    ),
  },
];

export const FIELD_EXAMPLES: readonly FieldExample[] = [
  ...INPUT_EXAMPLES,
  ...SELECT_EXAMPLES,
  ...TEXTAREA_EXAMPLES,
];
