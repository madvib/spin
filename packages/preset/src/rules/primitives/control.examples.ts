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
  "A checkbox and a switch are working controls with no class at all: the " +
  "input carries the base and the platform owns its state. Both draw " +
  "themselves rather than using the platform's rendering, so a tick cannot " +
  "be the platform's blue and a switch cannot be a tinted box. `checked` " +
  "and `disabled` are attributes, and indeterminate has none — the fixture " +
  "marks it `data-mixed` and the page sets `.indeterminate`.";

export const CONTROL_EXAMPLES: readonly ControlExample[] = [
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
    name: "Switch · states",
    html: row(
      `          ${inputSwitch("", "off")}
          ${inputSwitch("checked", "on")}
          ${inputSwitch("data-mixed", "indeterminate")}
          ${inputSwitch("disabled", "disabled")}
          ${inputSwitch("checked disabled", "disabled, on")}`,
    ),
  },
];
