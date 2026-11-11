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

import type { ClassDoc } from "./example.ts";

export interface DialogExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center justify-center gap-2">
${inner}
        </div>`;

/**
 * The close control: an x, not the word "Close".
 *
 * A dialog's own close is an icon you read before you read it — the corner
 * control is a shape, and a label in that corner is a second title competing
 * with the first. It is an icon-only button, so it carries the label the
 * shape cannot: `aria-label` names it for assistive tech, and the button's
 * own square is the hit area.
 */
const close =
  `<button class="icon" aria-label="Close" onclick="this.closest('dialog').close()"><i class="i-lucide-x button-icon"></i></button>`;

export const dialogFixtureNote =
  "A native modal: focus trapping, Escape and inertness are the platform's. Ours is a card that looks like every other card.";

export const DIALOG_CLASSES: readonly ClassDoc[] = [
  {
    name: "<dialog>",
    kind: "Component",
    description: "Modal panel; centred card capped to the viewport, scrolling inside itself",
  },
  {
    name: "<header>",
    kind: "Part",
    description: "Title row; heading grows while the close control pins to the panel corner",
  },
  {
    name: "<footer>",
    kind: "Part",
    description: "Actions row; wraps right-aligned so narrow panels keep their way out",
  },
  {
    name: "::backdrop",
    kind: "Behavior",
    description: "Themed scrim behind the top-layer panel; a neutral veil when the theme states none",
  },
];

/**
 * `data-open="id"` names the dialog a row opens; a native dialog only opens
 * from `showModal()`, so the fixture ships the line that calls it.
 */
export const dialogOnLoad =
  "document.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', () => document.querySelector('#' + el.dataset.open)?.showModal()));";

export const DIALOG_EXAMPLES: readonly DialogExample[] = [
  {
    name: "Destructive confirm",
    html: row(
      `          <button data-open="confirm">Roll back</button>
          <dialog id="confirm">
            <header>
              <h2>Roll back to v4.11.2?</h2>
              ${close}
            </header>
            <p>Traffic returns to the previous release within 90 seconds. Deploy #4821 stays in the history.</p>
            <footer>
              <button class="ghost" onclick="this.closest('dialog').close()">Cancel</button>
              <button class="danger">Roll back</button>
            </footer>
          </dialog>`,
    ),
  },
  {
    name: "Service readme",
    html: row(
      `          <button class="secondary" data-open="info">About checkout-api</button>
          <dialog id="info">
            <header>
              <h2>About checkout-api</h2>
              ${close}
            </header>
            <p>Created 15 March 2024 · last deployed 19 October 2026 at 09:14 UTC by Tomas Berg. Owns auth, carts, and the tax calculator.</p>
          </dialog>`,
    ),
  },
  {
    name: "Rename service",
    html: row(
      `          <button class="outline" data-open="rename">Rename service</button>
          <dialog id="rename">
            <header>
              <h2>Rename service</h2>
              ${close}
            </header>
            <form>
              <label>
                Service name
                <input type="text" value="checkout-api" />
              </label>
            </form>
            <footer>
              <button class="ghost" onclick="this.closest('dialog').close()">Cancel</button>
              <button class="secondary">Save</button>
            </footer>
          </dialog>`,
    ),
  },
];
