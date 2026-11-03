var SUBJECT_HTML = {
	card: `
<card class="stack">
  <div class="split">
    <h2>Interactive Card</h2>
    <badge class="primary">live</badge>
  </div>
  <p class="text-text-muted">Same tokens, same markup, different runtime.</p>
  <label for="guest">Guest name</label>
  <input id="guest" placeholder="Ada" />
  <button class="primary" type="button">Add guest</button>
</card>`,
	tokens: `
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
</card>`,
	dialog: `
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
</card>`
};
// examples/vanilla/main.ts
function mount(root, subject = "card") {
	root.innerHTML = SUBJECT_HTML[subject];
	return () => {
		root.innerHTML = "";
	};
}
export { mount };
