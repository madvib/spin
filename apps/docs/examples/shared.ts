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
<article class="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
  <div class="flex items-center justify-between gap-2">
    <h2 class="m-0 text-text">Interactive Card</h2>
    <span class="rounded-full bg-primary px-2 py-0.5 text-xs text-on-primary">live</span>
  </div>
  <p class="text-text-muted">Same tokens, same markup, different runtime.</p>
  <label class="text-sm text-text-muted" for="guest">Guest name</label>
  <input id="guest" class="rounded-md border border-border bg-surface px-3 py-2 text-text" placeholder="Ada" />
  <button class="button primary" type="button">Add guest</button>
</article>`;

const TOKENS = `
<article class="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
  <h2 class="m-0 text-text">Theme Token Inspector</h2>
  <p class="text-sm text-text-muted">
    Every swatch spends a Spin token utility resolved against the active theme.
  </p>
  <div class="grid grid-cols-2 gap-2">
    <div class="rounded-md bg-primary p-4 text-on-primary">primary</div>
    <div class="rounded-md bg-surface-raised p-4 text-text">surface</div>
    <div class="rounded-md bg-success p-4 text-on-primary">success</div>
    <div class="rounded-md bg-warning p-4 text-on-primary">warning</div>
    <div class="rounded-md bg-error p-4 text-on-primary">error</div>
  </div>
</article>`;

const DIALOG = `
<article class="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
  <h2 class="m-0 text-text">Dialog &amp; Form Actions</h2>
  <p class="text-sm text-text-muted">
    A native dialog over Spin tokens; Escape and the form close it.
  </p>
  <button
    class="button primary"
    type="button"
    onclick="this.closest('article').querySelector('dialog').showModal()"
  >
    Open dialog
  </button>
  <dialog class="rounded-md border border-border bg-surface p-4 text-text">
    <form method="dialog">
      <h2 class="m-0 text-text">Confirm action</h2>
      <p class="text-sm text-text-muted">This dialog is the platform's.</p>
      <div class="flex justify-end gap-2">
        <button class="button" value="cancel">Cancel</button>
        <button class="button primary" value="confirm">Confirm</button>
      </div>
    </form>
  </dialog>
</article>`;

export const SUBJECT_HTML: Readonly<Record<Subject, string>> = {
  card: CARD,
  tokens: TOKENS,
  dialog: DIALOG,
};
