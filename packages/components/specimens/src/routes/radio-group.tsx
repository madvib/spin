import { createEffect, createSignal, onCleanup } from "solid-js";
import type { RadioValueChange } from "../../src/spin-radio-group/radioGroup.machine-def.ts";

export interface RadioItem {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

type RadioElement = HTMLElement & { items?: readonly RadioItem[] };

const ITEMS: readonly RadioItem[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large", disabled: true },
];

export default function RadioGroupSpecimen() {
  const [last, setLast] = createSignal("nothing selected yet");
  let el: RadioElement | undefined;

  // Down: property writes. Up: the value-change CustomEvent. No wrapper.
  createEffect(() => {
    if (el) el.items = ITEMS;
  });
  createEffect(() => {
    if (!el) return;
    const onValueChange = (event: Event) => {
      setLast((event as CustomEvent<RadioValueChange>).detail.value);
    };
    el.addEventListener("value-change", onValueChange);
    onCleanup(() => el?.removeEventListener("value-change", onValueChange));
  });

  return (
    <section>
      <h2 class="text-xl mb-1">RadioGroup</h2>
      <p class="text-muted mb-4">
        Solid owns the items and passes them down; the element's value-change event comes back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <span class="text-sm text-muted">
          selected: <span id="last-selection">{last()}</span>
        </span>
      </div>

      <spin-radio-group
        ref={(node) => {
          el = node as RadioElement;
          el.items = ITEMS;
        }}
      />
    </section>
  );
}
