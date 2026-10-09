import { createEffect, createSignal, onCleanup } from "solid-js";
import type { ToastItem } from "../../../src/spin-toast/toast.machine-def.ts";

type ToastElement = HTMLElement & { items?: ToastItem[] };

let counter = 0;

export default function ToastSpecimen() {
  const [items, setItems] = createSignal<ToastItem[]>([]);
  const [last, setLast] = createSignal("nothing shown yet");
  let el: ToastElement | undefined;

  // Down: property writes (every items change syncs into the store).
  // Up: a click on a toast's close button bubbles to the host; the dismissed
  // id leaves the items list and the store sync follows. The group machine
  // declares no on* callbacks, so there is no CustomEvent — native click.
  createEffect(() => {
    if (el) el.items = items();
  });
  createEffect(() => {
    if (!el) return;
    const onClick = (event: Event) => {
      const id = (event.target as HTMLElement | null)?.closest("[data-close]")?.getAttribute("data-close");
      if (!id) return;
      setItems((prev) => prev.filter((item) => item.id !== id));
      setLast(`dismissed → ${id}`);
    };
    el.addEventListener("click", onClick);
    onCleanup(() => el?.removeEventListener("click", onClick));
  });

  const showToast = () => {
    counter += 1;
    const item: ToastItem = {
      id: `toast-${counter}`,
      title: `Toast ${counter}`,
      description: `This is toast number ${counter}.`,
    };
    const next = [...items(), item];
    setItems(next);
    setLast(`shown → ${item.id}`);
    if (el) el.items = next;
  };

  return (
    <section>
      <h2 class="text-xl mb-1">Toast</h2>
      <p class="text-muted mb-4">
        The route owns the toast list and writes it down as `items`; the element renders the
        group region from the store and dismisses a toast through its close button.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface"
          onClick={showToast}
        >
          Show toast
        </button>
        <span class="text-sm text-muted">
          toasts: <span id="toast-count">{items().length}</span>
        </span>
        <span class="text-sm text-muted">
          last: <span id="last-action">{last()}</span>
        </span>
      </div>

      <spin-toast
        ref={(node) => {
          el = node as ToastElement;
          el.items = items();
        }}
      />
    </section>
  );
}
