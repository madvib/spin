/**
 * Checkbox and switch examples — the markup a consumer writes, beside the
 * rules that style them.
 *
 * An `<input type="checkbox">` carries the base, and `role="switch"` on one
 * is a toggle. There are no variant classes and no custom tags: the platform
 * owns the control and its state, so the rule styles what the browser
 * renders. Both draw themselves rather than using the platform's rendering,
 * so a tick cannot be the platform's blue and a switch cannot be a tinted
 * box.
 */

export interface ControlExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

const inputCheckbox = (attrs: string, label: string): string =>
  `<label><input type="checkbox"${attrs ? ` ${attrs}` : ""}> ${label}</label>`;

const inputSwitch = (attrs: string, label: string): string =>
  `<label><input type="checkbox" role="switch"${
    attrs ? ` ${attrs}` : ""
  }> ${label}</label>`;

export const controlFixtureNote =
  "A working checkbox with no class: the input carries the base and draws its own tick. `checked` and `disabled` are attributes; indeterminate is `data-mixed`.";

export const CHECKBOX_EXAMPLES: readonly ControlExample[] = [
  {
    name: "Checkbox · states",
    html: row(
      `          ${inputCheckbox("", "unchecked")}
          ${inputCheckbox("checked", "checked")}
          ${inputCheckbox("data-mixed", "indeterminate")}
          ${inputCheckbox("disabled", "disabled")}
          ${inputCheckbox("checked disabled", "disabled, checked")}`,
    ),
  },
  {
    name: "Checkbox · stacked",
    html: `        <div class="flex flex-col items-start gap-2">
          ${inputCheckbox("checked", "First")}
          ${inputCheckbox("", "Second")}
          ${inputCheckbox("disabled", "Disabled")}
        </div>`,
  },
];

export const switchFixtureNote =
  'A checkbox wearing `role="switch"`: same input, same states, a track instead of a box. The label carries the state word.';

export const SWITCH_EXAMPLES: readonly ControlExample[] = [
  {
    name: "Switch · states",
    html: row(
      `          ${inputSwitch("", "off")}
          ${inputSwitch("checked", "on")}
          ${inputSwitch("data-mixed", "indeterminate")}
          ${inputSwitch("disabled", "disabled")}
          ${inputSwitch("checked disabled", "disabled, on")}`,
    ),
  },
  {
    name: "Switch · with description",
    html: row(
      `          <label><input type="checkbox" role="switch" checked> <span>Notifications <span>— email me</span></span></label>
          <label><input type="checkbox" role="switch"> <span>Digest <span>— weekly</span></span></label>`,
    ),
  },
];

export const CONTROL_EXAMPLES: readonly ControlExample[] = [
  ...CHECKBOX_EXAMPLES,
  ...SWITCH_EXAMPLES,
];
