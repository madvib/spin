import { createEffect, createSignal, onCleanup } from "solid-js";
import type { CheckboxCheckedChange } from "../../src/spin-checkbox/checkbox.machine-def.ts";

type CheckboxElement = HTMLElement & { label?: string; defaultChecked?: boolean };

export default function CheckboxSpecimen() {
  const [last, setLast] = createSignal("unchecked");
  let el: CheckboxElement | undefined;

  // Down: property writes. Up: the checked-change CustomEvent. No wrapper.
  createEffect(() => {
    if (el) {
      el.label = "Accept terms";
      el.defaultChecked = false;
    }
  });
  createEffect(() => {
    if (!el) return;
    const onCheckedChange = (event: Event) => {
      const checked = (event as CustomEvent<CheckboxCheckedChange>).detail.checked;
      setLast(String(checked));
    };
    el.addEventListener("checked-change", onCheckedChange);
    onCleanup(() => el?.removeEventListener("checked-change", onCheckedChange));
  });

  return (
    <section>
      <h2 class="text-xl mb-1">Checkbox</h2>
      <p class="text-muted mb-4">
        Solid owns the label and passes it down; the element's checked-change event comes back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <spin-checkbox
          ref={(node) => {
            el = node as CheckboxElement;
            el.label = "Accept terms";
          }}
        />
        <span class="text-sm text-muted">
          state: <span id="checkbox-state">{last()}</span>
        </span>
      </div>
    </section>
  );
}
