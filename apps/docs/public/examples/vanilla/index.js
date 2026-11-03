var SUBJECT_HTML = {
	card: `
<card class="card-default">
  <card-header>
    <card-title>Invite a teammate</card-title>
    <card-description>Workspace members can edit themes and deploy previews.</card-description>
    <card-action>
      <badge variant="primary">Admin</badge>
    </card-action>
  </card-header>
  <card-content class="stack-sm">
    <div class="stack-xs">
      <label for="guest">Work email</label>
      <input id="guest" type="email" placeholder="ada@acme.dev" />
    </div>
  </card-content>
  <card-footer>
    <button class="primary" type="button">Send invite</button>
    <button class="ghost" type="button">Copy link</button>
  </card-footer>
</card>`,
	tokens: `
<card class="card-default">
  <card-header>
    <card-title>Theme Token Inspector</card-title>
    <card-description>Every surface and semantic role resolves from the active theme.</card-description>
    <card-action>
      <badge variant="neutral">tokens</badge>
    </card-action>
  </card-header>
  <card-content>
    <div class="grid grid-cols-2 gap-2">
      <div class="rounded-md bg-primary p-3 text-sm font-medium text-on-primary">primary</div>
      <div class="rounded-md border border-solid border-border bg-surface p-3 text-sm font-medium text-text">surface</div>
      <div class="rounded-md bg-success p-3 text-sm font-medium text-on-semantic-success">success</div>
      <div class="rounded-md bg-warning p-3 text-sm font-medium text-on-semantic-warning">warning</div>
      <div class="rounded-md bg-error p-3 text-sm font-medium text-on-semantic-error">error</div>
      <div class="rounded-md bg-accent p-3 text-sm font-medium text-on-accent">accent</div>
    </div>
  </card-content>
</card>`,
	dialog: `
<card class="card-default">
  <card-header>
    <card-title>Release to production</card-title>
    <card-description>Native dialog styled by Spin tokens; Escape or Cancel closes it.</card-description>
    <card-action>
      <badge variant="success">v2.4.0</badge>
    </card-action>
  </card-header>
  <card-footer>
    <button
      class="primary"
      type="button"
      onclick="this.closest('card').querySelector('dialog').showModal()"
    >
      Open dialog
    </button>
  </card-footer>
  <dialog>
    <form method="dialog" class="stack">
      <header>
        <h2>Confirm deployment</h2>
      </header>
      <p class="text-sm text-text-muted">Promote build 2.4.0 to all production regions?</p>
      <footer>
        <button value="cancel">Cancel</button>
        <button class="primary" value="confirm">Deploy now</button>
      </footer>
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
