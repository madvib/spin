var SUBJECT_HTML = {
	card: `
<article class="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
  <div class="flex items-center justify-between gap-2">
    <h2 class="m-0 text-text">Interactive Card</h2>
    <span class="rounded-full bg-primary px-2 py-0.5 text-xs text-on-primary">live</span>
  </div>
  <p class="text-text-muted">Same tokens, same markup, different runtime.</p>
  <label class="text-sm text-text-muted" for="guest">Guest name</label>
  <input id="guest" class="rounded-md border border-border bg-surface px-3 py-2 text-text" placeholder="Ada" />
  <button class="button primary" type="button">Add guest</button>
</article>`,
	tokens: `
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
</article>`,
	dialog: `
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
</article>`
};
// examples/vanilla/main.ts
function mount(root, subject = "card") {
	root.innerHTML = SUBJECT_HTML[subject];
	return () => {
		root.innerHTML = "";
	};
}
export { mount };
