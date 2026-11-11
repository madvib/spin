/**
 * Radio examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * An `<input type="radio">` carries the base; there are no variant classes
 * and no custom tags — the control draws itself. Every class used here
 * resolves against the preset's own catalog; the self-resolution test fails
 * the suite if an example demonstrates what the package cannot do.
 */

import type { ClassDoc } from "./example.ts";

export interface RadioExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const RADIO_CLASSES: readonly ClassDoc[] = [
  {
    name: ".radio",
    kind: "Component",
    description:
      "Drawn radio control: appearance:none with a border, surface, and ::after dot",
  },
  {
    name: ":checked",
    kind: "Behavior",
    description:
      "Checked takes the tone in the border, keeping the surface so the ring-and-dot reads",
  },
  {
    name: ":focus-visible",
    kind: "Behavior",
    description:
      "Focus ring drawn on the control's own border so a mouse press leaves none",
  },
  {
    name: ":disabled",
    kind: "Behavior",
    description:
      "Disables the control and its dot together, so a dead radio is dead all the way through",
  },
];

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center justify-center gap-2">
${inner}
        </div>`;

export const radioFixtureNote =
  "A working radio with no class: the input carries the base. A group is labelled inputs sharing a name.";

export const RADIO_EXAMPLES: readonly RadioExample[] = [
  {
    name: "A group",
    html: `        <div role="radiogroup" aria-label="Target environment">
          <label><input type="radio" name="choice" checked> production</label>
          <label><input type="radio" name="choice"> staging</label>
          <label><input type="radio" name="choice" disabled> preview</label>
        </div>`,
  },
  {
    name: "States",
    html: row(
      `          <label><input type="radio" name="s" checked> production</label>
          <label><input type="radio" name="s"> staging</label>
          <label><input type="radio" name="s" disabled> preview</label>`,
    ),
  },
  {
    name: "Stacked",
    html:
      `        <div role="radiogroup" aria-label="Stacked" class="flex flex-col items-start gap-2">
          <label><input type="radio" name="stack" checked> production</label>
          <label><input type="radio" name="stack"> staging</label>
          <label><input type="radio" name="stack"> preview</label>
        </div>`,
  },
  {
    name: "Disabled",
    html: row(
      `          <label><input type="radio" name="d" checked disabled> production</label>
          <label><input type="radio" name="d" disabled> staging</label>`,
    ),
  },
];
