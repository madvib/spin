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

import type { ClassDoc } from "./example.ts";
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
  "A working label with no class: the caption above the control it names.";

export const LABEL_CLASSES: readonly ClassDoc[] = [
  {
    name: "<label>",
    kind: "Component",
    description: "Bare label as a captioned control",
  },
];

export const LABEL_EXAMPLES: readonly LabelExample[] = [
  {
    name: "Naming a control",
    html: row(
      `          <label><span>Release tag</span><input type="text" placeholder="v4.12.0"></label>
          <label><span>Service name</span><input type="text" value="checkout-api"></label>
          <label><span>Locked by policy</span><input type="text" value="payments-worker" disabled></label>`,
    ),
  },
  {
    name: "With a select",
    html: row(
      `          <label><span>Target</span><select><option>production</option><option>staging</option></select></label>
          <label><select disabled><option>preview</option></select><span>Locked by policy</span></label>`,
    ),
  },
  {
    name: "With a textarea",
    html: row(
      `          <label><span>Reason</span><textarea rows="2" placeholder="Why are you rolling back?"></textarea></label>
          <label><span>Locked by policy</span><textarea rows="2" disabled>Deploy blocked by failing health checks</textarea></label>`,
    ),
  },
];
