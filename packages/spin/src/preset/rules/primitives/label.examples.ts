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
  "A working label with no class: the control it names is a child, and the label inherits the type beside it.";

export const LABEL_EXAMPLES: readonly LabelExample[] = [
  {
    name: "Naming a control",
    html: row(
      `          <label><input type="text" placeholder="v4.12.0"><span>Release tag</span></label>
          <label><input type="text" value="checkout-api"><span>Service name</span></label>
          <label><input type="text" value="payments-worker" disabled><span>Locked by policy</span></label>`,
    ),
  },
  {
    name: "With a select",
    html: row(
      `          <label><select><option>production</option><option>staging</option></select><span>Target</span></label>
          <label><select disabled><option>preview</option></select><span>Locked by policy</span></label>`,
    ),
  },
  {
    name: "With a textarea",
    html: row(
      `          <label><textarea rows="2" placeholder="Why are you rolling back?"></textarea><span>Reason</span></label>
          <label><textarea rows="2" disabled>Deploy blocked by failing health checks</textarea><span>Locked by policy</span></label>`,
    ),
  },
];
