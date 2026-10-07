/**
 * Checkbox and switch examples — the markup a consumer writes, beside the
 * rules that style them.
 *
 * A bare `<checkbox>` or `<switch>` carries the base; there are no variant
 * classes. Both draw themselves rather than using the platform's rendering,
 * so the tag is the opt-in and the state is the attribute.
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

const labelled = (tag: "checkbox" | "switch", attrs: string, label: string): string =>
  `<label><${tag}${attrs ? ` ${attrs}` : ""}></${tag}> ${label}</label>`;

export const controlFixtureNote =
  "A checkbox and a switch are working controls with no class at all: the " +
  "tag carries the base, and the state is the attribute. Both draw " +
  "themselves rather than using the platform's rendering, so a tick cannot " +
  "be the platform's blue and a switch cannot be a tinted box.";

export const CONTROL_EXAMPLES: readonly ControlExample[] = [
  {
    name: "Checkbox · a group",
    html: row(
      `          ${labelled("checkbox", "", "First")}
          ${labelled("checkbox", "checked", "Second")}
          ${labelled("checkbox", "disabled", "Disabled")}`,
    ),
  },
  {
    name: "Checkbox · states",
    html: row(
      `          ${labelled("checkbox", "", "unchecked")}
          ${labelled("checkbox", "checked", "checked")}
          ${labelled("checkbox", "data-mixed", "indeterminate")}
          ${labelled("checkbox", "disabled", "disabled")}`,
    ),
  },
  {
    name: "Switch · states",
    html: row(
      `          ${labelled("switch", "", "off")}
          ${labelled("switch", "checked", "on")}
          ${labelled("switch", "disabled", "disabled")}`,
    ),
  },
  {
    name: "Switch · a group",
    html: row(
      `          ${labelled("switch", "", "First")}
          ${labelled("switch", "checked", "Second")}
          ${labelled("switch", "disabled", "Disabled")}`,
    ),
  },
];
