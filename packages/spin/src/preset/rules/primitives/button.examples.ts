/**
 * Button examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<button>` carries the base; variants and sizes are classes on the
 * tag. There is no `btn` class and never was one — the tag is the opt-in.
 * Every class used here resolves against the preset's own catalog; the
 * self-resolution test fails the suite if an example demonstrates what the
 * package cannot do.
 */

export interface ButtonExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const buttonFixtureNote =
  "A working button with no class at all: the tag carries the base. Variants change the tone, sm and lg change the size, `bare` opts out of paint for chrome.";

export const BUTTON_EXAMPLES: readonly ButtonExample[] = [
  {
    name: "Variants",
    html: row(
      `          <button>Deploy</button>
          <button class="secondary">Schedule</button>
          <button class="outline">Review changes</button>
          <button class="contrast">Promote to production</button>
          <button class="danger">Delete environment</button>
          <button class="ghost">Dismiss</button>`,
    ),
  },
  {
    name: "Bare variant",
    html: row(
      `          <button class="bare text-text">View logs</button>
          <button>Deploy</button>`,
    ),
  },
  {
    name: "Sizes",
    html: row(
      `          <button class="s-sm">Deploy to production</button>
          <button>Deploy to production</button>
          <button class="s-lg">Deploy to production</button>`,
    ),
  },
  {
    name: "Types",
    html: row(
      `          <button type="submit">Save changes</button>
          <button type="reset">Discard</button>
          <button type="button">Cancel</button>`,
    ),
  },
  {
    name: "States",
    html: row(
      `          <button>Deploy</button>
          <button disabled>Deploy</button>
          <button aria-disabled="true">Deploy</button>
          <button aria-busy="true">Deploy</button>`,
    ),
  },
  {
    name: "Busy with an icon",
    html: row(
      `          <button aria-busy="true"><i class="i-lucide-plus button-icon"></i>Adding instance…</button>
          <button aria-busy="true">Adding instance…</button>`,
    ),
  },
  {
    name: "With an icon",
    html: row(
      `          <button><i class="i-lucide-plus button-icon"></i>Add instance</button>
          <button class="s-sm"><i class="i-lucide-plus button-icon"></i>Add instance</button>
          <button class="s-lg"><i class="i-lucide-plus button-icon"></i>Add instance</button>
          <button class="icon"><i class="i-lucide-plus button-icon"></i></button>`,
    ),
  },
  {
    name: "In a group · joined corners",
    html: `        <span class="flex flex-wrap items-center gap-2" role="group">
          <button class="secondary">All</button>
          <button class="secondary" aria-pressed="true">Running</button>
          <button class="secondary">Failed</button>
        </span>`,
  },
];
