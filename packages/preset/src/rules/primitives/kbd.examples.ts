/**
 * Kbd examples — the markup a consumer writes, beside the rule that styles it.
 *
 * A bare `<kbd>` is a keycap: it represents a key on the keyboard, not machine
 * text. The face is the platform's, so the keycap matches the surrounding
 * prose rather than imposing a monospace chip. Combinations are written as
 * separate keycaps joined by `+`, and a keycap sits inline beside text or a
 * control without leaving the line box.
 */
import type { ClassDoc } from "./example.ts";

export interface KbdExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const KBD_CLASSES: readonly ClassDoc[] = [
  {
    name: "<kbd>",
    kind: "Component",
    description: "Keyboard input: a keycap for a key on the keyboard.",
  },
];

export const kbdFixtureNote =
  "A keycap for keyboard input — what to press, not what the computer printed. Combinations are keycaps joined by `+`.";

export const KBD_EXAMPLES: readonly KbdExample[] = [
  {
    name: "Kbd · single & modifier keys",
    html: `<div class="flex flex-wrap items-center justify-center gap-2">
  <kbd>⌘</kbd>
  <kbd>⇧</kbd>
  <kbd>⌥</kbd>
  <kbd>⌃</kbd>
  <kbd>Enter</kbd>
  <kbd>Esc</kbd>
</div>`,
  },
  {
    name: "Kbd · combination",
    html: `<span><kbd>Ctrl</kbd> + <kbd>Enter</kbd></span>`,
  },
  {
    name: "Kbd · inline in prose",
    html: `<p>Press <kbd>⌘</kbd> + <kbd>K</kbd> to jump to a service, or <kbd>Enter</kbd> to deploy to production.</p>`,
  },
  {
    name: "Kbd · beside a control",
    html: `<label class="flex items-center gap-2">
  <input class="w-48" type="search" placeholder="Search services" aria-label="Search services">
  <kbd>⌘</kbd>
  <kbd>K</kbd>
</label>`,
  },
];
