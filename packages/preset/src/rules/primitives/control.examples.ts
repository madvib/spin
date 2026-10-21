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

/**
 * `data-mixed` is the markup; `indeterminate` is the property. No markup
 * produces the state, so the fixture that names it ships the line that sets
 * it — and a consumer copying the row knows the same line is theirs to run.
 */
export const indeterminateOnLoad =
  "document.querySelectorAll('[data-mixed]').forEach((el) => { el.indeterminate = true; });";

export const CHECKBOX_EXAMPLES: readonly ControlExample[] = [
  {
    name: "Checkbox · states",
    html: row(
      `          ${inputCheckbox("", "Run health checks")}
          ${inputCheckbox("checked", "Require approval")}
          ${inputCheckbox("data-mixed", "Notify the on-call engineer")}
          ${inputCheckbox("disabled", "Block on failing tests")}
          ${
        inputCheckbox("checked disabled", "Keep the previous release warm")
      }`,
    ),
  },
  {
    name: "Checkbox · stacked",
    html: `        <div class="flex flex-col items-start gap-2">
          ${inputCheckbox("checked", "Run health checks")}
          ${inputCheckbox("", "Require approval")}
          ${inputCheckbox("disabled", "Notify the on-call engineer")}
        </div>`,
  },
];

export const switchFixtureNote =
  'A checkbox wearing `role="switch"`: same input, same states, a track instead of a box. The label says what the switch turns on.';

export const SWITCH_EXAMPLES: readonly ControlExample[] = [
  {
    name: "Switch · states",
    html: row(
      `          ${inputSwitch("", "Auto-deploy")}
          ${inputSwitch("checked", "Canary first")}
          ${inputSwitch("data-mixed", "Notify the on-call engineer")}
          ${inputSwitch("disabled", "Deploy on merge")}
          ${inputSwitch("checked disabled", "Auto-deploy")}`,
    ),
  },
  {
    name: "Switch · with description",
    html: row(
      `          <label><input type="checkbox" role="switch" checked> <span>Auto-deploy <span>every merge to main</span></span></label>
          <label><input type="checkbox" role="switch"> <span>Nightly window <span>02:00 to 06:00 UTC</span></span></label>`,
    ),
  },
];

export const CONTROL_EXAMPLES: readonly ControlExample[] = [
  ...CHECKBOX_EXAMPLES,
  ...SWITCH_EXAMPLES,
];
