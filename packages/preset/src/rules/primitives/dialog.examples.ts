/**
 * Dialog examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<dialog>` carries the base; there are no variant classes and never
 * were any — the tag is the opt-in. The native element brings focus trapping,
 * Escape to close, and the page inert; what is ours is a card that looks like
 * every other card, centred and capped so it cannot outgrow the viewport.
 * Every class used here resolves against the preset's own catalog; the
 * self-resolution test fails the suite if an example demonstrates what the
 * package cannot do.
 */

export interface DialogExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const dialogFixtureNote =
  "A native modal: focus trapping, Escape and inertness are the platform's. Ours is a card that looks like every other card.";

export const DIALOG_EXAMPLES: readonly DialogExample[] = [
  {
    name: "Modal",
    html: row(
      `          <button data-open="confirm">Open a dialog</button>
          <dialog id="confirm">
            <header>
              <h2>Delete this file?</h2>
              <button class="ghost" onclick="this.closest('dialog').close()">Close</button>
            </header>
            <p>The file and its history will be removed. This cannot be undone.</p>
            <footer>
              <button class="ghost" onclick="this.closest('dialog').close()">Cancel</button>
              <button class="danger">Delete</button>
            </footer>
          </dialog>`,
    ),
  },
  {
    name: "Without a footer",
    html: row(
      `          <button data-open="info">Open a dialog</button>
          <dialog id="info">
            <header>
              <h2>About this file</h2>
              <button class="ghost" onclick="this.closest('dialog').close()">Close</button>
            </header>
            <p>This file was created on 2024-01-15 and last modified on 2024-03-22.</p>
          </dialog>`,
    ),
  },
  {
    name: "With a form",
    html: row(
      `          <button data-open="rename">Rename</button>
          <dialog id="rename">
            <header>
              <h2>Rename file</h2>
              <button class="ghost" onclick="this.closest('dialog').close()">Close</button>
            </header>
            <form>
              <label>
                Name
                <input type="text" value="document.txt" />
              </label>
            </form>
            <footer>
              <button class="ghost" onclick="this.closest('dialog').close()">Cancel</button>
              <button class="secondary">Rename</button>
            </footer>
          </dialog>`,
    ),
  },
];
