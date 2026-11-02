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

import type { ClassDoc } from "./example.ts";

export interface ButtonExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center justify-center gap-2">
${inner}
</div>`;

export const buttonFixtureNote =
  "Buttons allow the user to take actions or make choices. The <button> tag carries the base style with no class required.";

export const BUTTON_CLASSES: readonly ClassDoc[] = [
  {
    name: "<button>",
    kind: "Component",
    description:
      "Primary action button (also matches [type=\"button\"], [type=\"submit\"], [type=\"reset\"], [role=\"button\"])",
  },
  {
    name: ".secondary",
    kind: "Color",
    description: "Raised surface fill with border for secondary actions",
  },
  {
    name: ".contrast",
    kind: "Color",
    description: "High-contrast inverted fill (foreground surface with background ink)",
  },
  {
    name: ".danger",
    kind: "Color",
    description: "Destructive action fill using semantic error color",
  },
  {
    name: ".outline",
    kind: "Style",
    description: "Transparent fill with primary border and ink; fills on hover",
  },
  {
    name: ".ghost",
    kind: "Style",
    description: "Transparent chrome with no border or shadow until hovered",
  },
  {
    name: ".s-sm",
    kind: "Size",
    description: "Small button height and compact text size",
  },
  {
    name: ".s-lg",
    kind: "Size",
    description: "Large button height and roomy padding",
  },
  {
    name: ".icon",
    kind: "Modifier",
    description: "Square 1:1 aspect ratio with zero horizontal padding for icon-only buttons",
  },
  {
    name: ".bare",
    kind: "Modifier",
    description: "Unstyled reset that strips button paint, border, shadow, and min-height for custom chrome",
  },
  {
    name: ".button-icon",
    kind: "Part",
    description: "Child icon slot sized to the button's text step (1em)",
  },
];

export const buttonOnLoad =
  "document.querySelectorAll('[data-toggle-group]').forEach((group) => group.addEventListener('click', (e) => { const btn = e.target.closest('button'); if (!btn) return; group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn))); }));";

export const BUTTON_EXAMPLES: readonly ButtonExample[] = [
  {
    name: "Button",
    html: `<button>Deploy</button>`,
  },
  {
    name: "Button colors",
    html: row(
      `  <button>Primary</button>
  <button class="secondary">Secondary</button>
  <button class="contrast">Contrast</button>
  <button class="danger">Danger</button>`,
    ),
  },
  {
    name: "Outline and ghost buttons",
    html: row(
      `  <button class="outline">Outline</button>
  <button class="ghost">Ghost</button>
  <button class="bare text-text">Bare reset</button>`,
    ),
  },
  {
    name: "Button sizes",
    html: row(
      `  <button class="s-sm">Small</button>
  <button>Default</button>
  <button class="s-lg">Large</button>`,
    ),
  },
  {
    name: "Button with icon",
    html: row(
      `  <button><i class="i-lucide-plus button-icon" aria-hidden="true"></i>New service</button>
  <button class="secondary">Continue<i class="i-lucide-arrow-right button-icon" aria-hidden="true"></i></button>
  <button class="outline s-sm"><i class="i-lucide-download button-icon" aria-hidden="true"></i>Export</button>`,
    ),
  },
  {
    name: "Icon-only button",
    html: row(
      `  <button class="icon s-sm" aria-label="Edit"><i class="i-lucide-pencil button-icon" aria-hidden="true"></i></button>
  <button class="icon" aria-label="Add"><i class="i-lucide-plus button-icon" aria-hidden="true"></i></button>
  <button class="icon secondary" aria-label="Settings"><i class="i-lucide-settings button-icon" aria-hidden="true"></i></button>
  <button class="icon ghost" aria-label="Close"><i class="i-lucide-x button-icon" aria-hidden="true"></i></button>`,
    ),
  },
  {
    name: "Disabled and busy states",
    html: row(
      `  <button aria-busy="true"><i class="i-lucide-loader button-icon" aria-hidden="true"></i>Deploying…</button>
  <button disabled>Disabled</button>
  <button class="secondary" disabled>Secondary disabled</button>
  <button class="outline" aria-disabled="true">Outline disabled</button>`,
    ),
  },
  {
    name: "Joined button group",
    html: `<span role="group" data-toggle-group>
  <button class="secondary" aria-pressed="true">All</button>
  <button class="secondary">Running</button>
  <button class="secondary">Failed</button>
</span>`,
  },
];
