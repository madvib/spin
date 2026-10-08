import { createSignal } from "solid-js";
import { SpinDialog } from "../components/SpinDialog.tsx";

export default function DialogSpecimen() {
  const [open, setOpen] = createSignal(false);

  return (
    <section>
      <h2 class="text-xl mb-1">Dialog</h2>
      <p class="text-muted mb-4">
        The element owns open/closed state; the controller observes via DOM.
      </p>
      <p class="mb-4">
        Status: <span id="dialog-status">{open() ? "open" : "closed"}</span>
      </p>
      <SpinDialog
        onOpenChange={(change) => setOpen(change.open)}
      />
    </section>
  );
}
