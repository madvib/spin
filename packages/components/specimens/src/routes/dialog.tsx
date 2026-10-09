import { createEffect, createSignal, onCleanup } from "solid-js";
import type { DialogOpenChange } from "../../../src/spin-dialog/dialog.machine-def.ts";

export default function DialogSpecimen() {
  const [open, setOpen] = createSignal(false);
  let el: HTMLElement | undefined;

  // Up: the open-change CustomEvent. No wrapper — addEventListener, like anywhere else.
  createEffect(() => {
    if (!el) return;
    const onOpenChange = (event: Event) => {
      setOpen((event as CustomEvent<DialogOpenChange>).detail.open);
    };
    el.addEventListener("open-change", onOpenChange);
    onCleanup(() => el?.removeEventListener("open-change", onOpenChange));
  });

  return (
    <section>
      <h2 class="text-xl mb-1">Dialog</h2>
      <p class="text-muted mb-4">
        The element owns open/closed state; the open-change event reports it.
      </p>
      <p class="mb-4">
        Status: <span id="dialog-status">{open() ? "open" : "closed"}</span>
      </p>
      <spin-dialog
        ref={(node) => {
          el = node as HTMLElement;
        }}
      />
    </section>
  );
}
