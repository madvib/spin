import { createEffect, createSignal, onCleanup } from "solid-js";
import type { PopoverOpenChange } from "../../src/spin-popover/popover.machine-def.ts";

type PopoverElement = HTMLElement & { title?: string; description?: string };

export default function PopoverSpecimen() {
  const [open, setOpen] = createSignal(false);
  const [last, setLast] = createSignal("nothing toggled yet");
  let el: PopoverElement | undefined;

  // Down: property writes. Up: the open-change CustomEvent. No wrapper.
  createEffect(() => {
    if (!el) return;
    const onOpenChange = (event: Event) => {
      const isOpen = (event as CustomEvent<PopoverOpenChange>).detail.open;
      setOpen(isOpen);
      setLast(`popover → ${isOpen ? "open" : "closed"}`);
    };
    el.addEventListener("open-change", onOpenChange);
    onCleanup(() => el?.removeEventListener("open-change", onOpenChange));
  });

  return (
    <section>
      <h2 class="text-xl mb-1">Popover</h2>
      <p class="text-muted mb-4">
        Solid owns the title and description and passes them down; the element's open-change event comes back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <spin-popover
          ref={(node) => {
            el = node as PopoverElement;
            el.title = "Popover title";
            el.description = "This is the popover description.";
          }}
        />
        <span class="text-sm text-muted">
          state: <span id="popover-state">{open() ? "open" : "closed"}</span>
        </span>
        <span class="text-sm text-muted">
          last: <span id="last-toggle">{last()}</span>
        </span>
      </div>

      {/* E2E fixtures: raw elements with stable ids. `controlled` takes an
          externally-written `open` property; `uncontrolled` runs on its
          own trigger. See tests/popover.e2e.ts. */}
      <div class="flex items-center gap-3">
        <spin-popover
          id="controlled"
          title="Controlled title"
          description="Controlled description."
        />
        <spin-popover
          id="uncontrolled"
          title="Uncontrolled title"
          description="Uncontrolled description."
        />
      </div>
    </section>
  );
}
