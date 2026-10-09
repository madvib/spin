/**
 * Kbd examples — the markup a consumer writes, beside the rule that styles it.
 *
 * A bare `<kbd>` is a keycap: it represents a key on the keyboard, not machine
 * text. The face is the platform's, so the keycap matches the surrounding
 * prose rather than imposing a monospace chip. Combinations are written as
 * separate keycaps joined by `+`, and a keycap sits inline beside text or a
 * control without leaving the line box.
 */

export interface KbdExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const kbdFixtureNote =
  "A bare `<kbd>` is a keycap — the visual representation of a key on the " +
  "keyboard. It is keyboard input, not machine text: it tells the reader " +
  "what to press, not what the computer printed. The face is the platform's, " +
  "so the keycap matches the surrounding text rather than imposing a " +
  "monospace chip. Combinations are written as separate keycaps joined by " +
  "`+`, and a keycap sits inline beside prose or a control without leaving " +
  "the line box.";

export const KBD_EXAMPLES: readonly KbdExample[] = [
  {
    name: "Kbd · single key",
    html: `<kbd>K</kbd>`,
  },
  {
    name: "Kbd · combination",
    html: `<kbd>Ctrl</kbd> + <kbd>C</kbd>`,
  },
  {
    name: "Kbd · inline in prose",
    html: `<p>Press <kbd>Enter</kbd> to submit the form.</p>`,
  },
  {
    name: "Kbd · beside a control",
    html: `<label><kbd>⌘</kbd> <input type="text" placeholder="Search"></label>`,
  },
];
