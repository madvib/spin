/**
 * Checkbox and switch examples — the markup a consumer writes, beside the
 * rules that style them.
 *
 * A bare `<checkbox>` or `<switch>` carries the base; there are no variant
 * classes. The library's tag and the platform's own spelling of the same
 * control — `<input type="checkbox">`, and `role="switch"` on one for a
 * toggle — reach the same rule. Both draw themselves rather than using the
 * platform's rendering, so the tag is the opt-in and the state is the
 * attribute.
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

const labelled = (
  tag: "checkbox" | "switch",
  attrs: string,
  label: string,
): string =>
  `<label><${tag}${attrs ? ` ${attrs}` : ""}></${tag}> ${label}</label>`;

const inputCheckbox = (attrs: string, label: string): string =>
  `<label><input type="checkbox"${attrs ? ` ${attrs}` : ""}> ${label}</label>`;

const inputSwitch = (attrs: string, label: string): string =>
  `<label><input type="checkbox" role="switch"${
    attrs ? ` ${attrs}` : ""
  }> ${label}</label>`;

export const controlFixtureNote =
  "A checkbox and a switch are working controls with no class at all: the " +
  "tag carries the base, and the library's tag and the platform's spelling " +
  "reach the same rule. Both draw themselves rather than using the " +
  "platform's rendering, so a tick cannot be the platform's blue and a " +
  "switch cannot be a tinted box. The platform's states are real on the " +
  "platform's spelling: `checked` and `disabled` are attributes, and " +
  "indeterminate has none — the fixture marks it `data-mixed` and the page " +
  "sets `.indeterminate`.";

export const CONTROL_EXAMPLES: readonly ControlExample[] = [
  {
    name: "Checkbox · both spellings",
    html: row(
      `          ${labelled("checkbox", "", "tag")}
          ${inputCheckbox("", "input")}`,
    ),
  },
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
    name: "Switch · both spellings",
    html: row(
      `          ${labelled("switch", "", "tag")}
          ${inputSwitch("", "input")}`,
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
