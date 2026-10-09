/**
 * Group examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `role="group"` carries the base; there is no class and never was
 * one — the role is the opt-in. Children flatten each other's corners and
 * their borders collapse into one seam. `data-wrap` opts out of the seam
 * for wrapping layouts. Every class used here resolves against the preset's
 * own catalog; the self-resolution test fails the suite if an example
 * demonstrates what the package cannot do.
 */

export interface GroupExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const groupFixtureNote =
  "A working radiogroup: children flatten each other's corners and their borders collapse into one seam. `data-wrap` opts out for wrapping layouts.";

export const GROUP_EXAMPLES: readonly GroupExample[] = [
  {
    name: "Joined",
    html: row(
      `          <span role="group">
            <button>First</button>
            <button class="secondary">Second</button>
            <button class="secondary">Third</button>
          </span>`,
    ),
  },
  {
    name: "A wrapping group opts out of the seam",
    html: row(
      `          <span role="group" data-wrap>
            <button>One</button>
            <button class="secondary">Two</button>
            <button class="secondary">Three</button>
            <button class="secondary">Four</button>
            <button class="secondary">Five</button>
          </span>`,
    ),
  },
];
