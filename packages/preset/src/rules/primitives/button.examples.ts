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
      `          <button>default</button>
          <button class="secondary">secondary</button>
          <button class="outline">outline</button>
          <button class="contrast">contrast</button>
          <button class="danger">danger</button>
          <button class="ghost">ghost</button>`,
    ),
  },
  {
    name: "Bare variant",
    html: row(
      `          <button class="bare">bare</button>
          <button>default</button>`,
    ),
  },
  {
    name: "Sizes",
    html: row(
      `          <button class="s-sm">small</button>
          <button>medium</button>
          <button class="s-lg">large</button>`,
    ),
  },
  {
    name: "Types",
    html: row(
      `          <button type="submit">submit</button>
          <button type="reset">reset</button>
          <button type="button">button</button>`,
    ),
  },
  {
    name: "States",
    html: row(
      `          <button>hover me</button>
          <button disabled>disabled</button>
          <button aria-disabled="true">aria-disabled</button>
          <button aria-busy="true">busy</button>`,
    ),
  },
  {
    name: "Busy with an icon",
    html: row(
      `          <button aria-busy="true"><i class="i-lucide-plus button-icon"></i>Saving…</button>
          <button aria-busy="true">Saving…</button>`,
    ),
  },
  {
    name: "With an icon",
    html: row(
      `          <button><i class="i-lucide-plus button-icon"></i>Save</button>
          <button class="s-sm"><i class="i-lucide-plus button-icon"></i>Save</button>
          <button class="s-lg"><i class="i-lucide-plus button-icon"></i>Save</button>
          <button class="icon"><i class="i-lucide-plus button-icon"></i></button>`,
    ),
  },
  {
    name: "In a group · joined corners",
    html: `        <span class="flex flex-wrap items-center gap-2" role="group">
          <button class="secondary">left</button>
          <button class="secondary" aria-pressed="true">middle</button>
          <button class="secondary">right</button>
        </span>`,
  },
];
