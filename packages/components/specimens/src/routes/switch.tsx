import { createEffect, createSignal, onCleanup } from "solid-js";
import type { SwitchCheckedChange } from "../../src/spin-switch/switch.machine-def.ts";

type SwitchElement = HTMLElement & { label?: string; defaultChecked?: boolean };

export default function SwitchSpecimen() {
  const [last, setLast] = createSignal("off");
  let el: SwitchElement | undefined;

  // Down: property writes. Up: the checked-change CustomEvent. No wrapper.
  createEffect(() => {
    if (el) el.label = "Notifications";
  });
  createEffect(() => {
    if (!el) return;
    const onCheckedChange = (event: Event) => {
      const checked = (event as CustomEvent<SwitchCheckedChange>).detail.checked;
      setLast(checked ? "on" : "off");
    };
    el.addEventListener("checked-change", onCheckedChange);
    onCleanup(() => el?.removeEventListener("checked-change", onCheckedChange));
  });

  return (
    <section>
      <h2 class="text-xl mb-1">Switch</h2>
      <p class="text-muted mb-4">
        Solid owns the label and passes it down; the element's checked-change event comes back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <spin-switch
          ref={(node) => {
            el = node as SwitchElement;
            el.label = "Notifications";
          }}
        />
        <span class="text-sm text-muted">
          state: <span id="switch-state">{last()}</span>
        </span>
      </div>
    </section>
  );
}
