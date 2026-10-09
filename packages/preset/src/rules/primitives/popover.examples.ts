/**
 * Popover examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<popover>` carries the base; the tag is the opt-in. There is no
 * `popover` class and never was one — the platform owns the mechanism and
 * this component owns the surface. Every class used here resolves against
 * the preset's own catalog; the self-resolution test fails the suite if an
 * example demonstrates what the package cannot do.
 */

export interface PopoverExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const popoverFixtureNote =
  "A popover is a card that floats in the top layer: popovertarget puts it " +
  "above everything without script, and light-dismiss is the platform's. " +
  "A tooltip is the same surface in a smaller box, revealed on hover or " +
  "focus of the element it describes.";

export const POPOVER_EXAMPLES: readonly PopoverExample[] = [
  {
    name: "Popover",
    html: row(
      `          <button popovertarget="menu">Open</button>
          <popover id="menu" popover="">Menu content</popover>`,
    ),
  },
  {
    name: "Tooltip",
    html: row(
      `          <button>Hover me</button>
          <tooltip>Tip text</tooltip>`,
    ),
  },
  {
    name: "Popover with content",
    html: row(
      `          <button popovertarget="profile">Profile</button>
          <popover id="profile" popover="">
            <div class="flex flex-col gap-2">
              <strong>Jane Doe</strong>
              <span>jane@example.com</span>
            </div>
          </popover>`,
    ),
  },
];
