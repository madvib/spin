/**
 * The subjects every framework renders.
 *
 * One markup string per subject, not per framework: the point of the matrix is
 * that the same Spin vocabulary works under vanilla DOM, Solid, React, Vue,
 * and Svelte. Framework entries differ only in how they put this string on the
 * page.
 *
 * Primitives only. A machine tag would need the component compiler in every
 * framework build; machines are the docs page's subject, mounted there by the
 * gallery.
 */
export type Subject = "card" | "tokens" | "dialog";

export const SUBJECTS: readonly Subject[] = ["card", "tokens", "dialog"];

const CARD = `
<card class="stack">
  <div class="split">
    <h2>Interactive Card</h2>
    <badge class="primary">live</badge>
  </div>
  <p class="text-text-muted">Same tokens, same markup, different runtime.</p>
  <label for="guest">Guest name</label>
  <input id="guest" placeholder="Ada" />
  <button class="primary" type="button">Add guest</button>
</card>`;

const TOKENS = `
<card class="stack">
  <h2>Theme Token Inspector</h2>
  <p class="text-sm text-text-muted">
    Every swatch spends a Spin token utility resolved against the active theme.
  </p>
  <div class="grid grid-cols-2 gap-2">
    <div class="rounded-md bg-primary p-4 text-on-primary">primary</div>
    <div class="rounded-md bg-surface-raised p-4 text-text">surface</div>
    <div class="rounded-md bg-success p-4 text-on-semantic-success">success</div>
    <div class="rounded-md bg-warning p-4 text-on-semantic-warning">warning</div>
    <div class="rounded-md bg-error p-4 text-on-semantic-error">error</div>
  </div>
</card>`;

const DIALOG = `
<card class="stack">
  <h2>Dialog &amp; Form Actions</h2>
  <p class="text-sm text-text-muted">
    A native dialog over Spin tokens; Escape and the form close it.
  </p>
  <button
    class="primary"
    type="button"
    onclick="this.closest('card').querySelector('dialog').showModal()"
  >
    Open dialog
  </button>
  <dialog>
    <form method="dialog" class="stack">
      <h2>Confirm action</h2>
      <p class="text-sm text-text-muted">This dialog is the platform's.</p>
      <div class="row justify-end">
        <button value="cancel">Cancel</button>
        <button class="primary" value="confirm">Confirm</button>
      </div>
    </form>
  </dialog>
</card>`;

export const SUBJECT_HTML: Readonly<Record<Subject, string>> = {
  card: CARD,
  tokens: TOKENS,
  dialog: DIALOG,
};
