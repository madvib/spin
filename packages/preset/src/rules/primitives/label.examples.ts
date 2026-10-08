/**
 * Label examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<label>` carries the base; the tag is the opt-in. There is no
 * `label` class and never was one — the tag is the opt-in. Every class
 * used here resolves against the preset's own catalog; the
 * self-resolution test fails the suite if an example demonstrates what
 * the package cannot do.
 */

export interface LabelExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const labelFixtureNote =
  "A label is a working label with no class at all: the tag carries the " +
  "base, and the control it names is a child. The label inherits the type " +
  "it sits beside rather than stating a size of its own.";

export const LABEL_EXAMPLES: readonly LabelExample[] = [
  {
    name: "Naming a control",
    html: row(
      `          <label><input type="text" placeholder="you@example.com"><span>Email address</span></label>
          <label><input type="text" value="Hello"><span>Name</span></label>
          <label><input type="text" value="Cannot touch" disabled><span>Disabled</span></label>`,
    ),
  },
  {
    name: "With a select",
    html: row(
      `          <label><select><option>One</option><option>Two</option></select><span>Choice</span></label>
          <label><select disabled><option>Unavailable</option></select><span>Disabled</span></label>`,
    ),
  },
  {
    name: "With a textarea",
    html: row(
      `          <label><textarea rows="2" placeholder="Multi-line"></textarea><span>Message</span></label>
          <label><textarea rows="2" disabled>Cannot touch</textarea><span>Disabled</span></label>`,
    ),
  },
];
