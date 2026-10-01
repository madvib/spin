import { createSignal, Show } from "solid-js";

export default function ModalPage() {
  const [open, setOpen] = createSignal(false);
  return (
    <div class="flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <h1 class="text-2xl">Modal</h1>
      <p>Dialogs layer above the page behind a veil.</p>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <Show when={open()}>
        <div class="fixed inset-0 z-modal flex items-center justify-center">
          <div
            class="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          >
          </div>
          <div class="relative bg-surface-raised border border-border rounded-lg p-4 shadow-lg">
            <div class="flex items-center justify-between">
              <h2 class="text-lg">Example dialog</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p>Modals layer above the page behind a veil.</p>
            <button
              type="button"
              class="bg-primary text-white rounded-md p-2"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      </Show>
      <h2 class="text-xl">Tokens used</h2>
      <ul>
        <li>
          <code class="text-sm">color.surface-raised</code>
        </li>
        <li>
          <code class="text-sm">color.border</code>
        </li>
        <li>
          <code class="text-sm">color.text</code>
        </li>
        <li>
          <code class="text-sm">shadow.lg</code>
        </li>
        <li>
          <code class="text-sm">radius.lg</code>
        </li>
        <li>
          <code class="text-sm">z-index.modal</code>
        </li>
      </ul>
      <h2 class="text-xl">Example</h2>
      <pre>
        <code class="text-sm">
          {`<div class="fixed inset-0 z-modal flex items-center justify-center">\n  <div class="absolute inset-0 bg-black/50"></div>\n  <div class="relative bg-surface-raised border border-border rounded-lg p-4 shadow-lg">\n    <h2>Example dialog</h2>\n    <p>Modals layer above the page behind a veil.</p>\n    <button type="button">Done</button>\n  </div>\n</div>`}
        </code>
      </pre>
    </div>
  );
}
