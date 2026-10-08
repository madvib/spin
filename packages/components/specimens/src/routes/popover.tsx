import { createSignal } from "solid-js";
import { SpinPopover } from "../components/SpinPopover.tsx";

export default function PopoverSpecimen() {
  const [open, setOpen] = createSignal(false);
  const [last, setLast] = createSignal("nothing toggled yet");

  return (
    <section>
      <h2 class="text-xl mb-1">Popover</h2>
      <p class="text-muted mb-4">
        Solid owns the title and description and passes them down; the element's open/close state bubbles back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <SpinPopover
          title="Popover title"
          description="This is the popover description."
          onOpenChange={(change) => {
            setOpen(change.open);
            setLast(`popover → ${change.open ? "open" : "closed"}`);
          }}
        />
        <span class="text-sm text-muted">
          state: <span id="popover-state">{open() ? "open" : "closed"}</span>
        </span>
        <span class="text-sm text-muted">
          last: <span id="last-toggle">{last()}</span>
        </span>
      </div>
    </section>
  );
}
