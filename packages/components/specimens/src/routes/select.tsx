import { createEffect, createSignal, onCleanup } from "solid-js";
import type { SelectValueChange } from "../../src/spin-select/select.machine-def.ts";

type SelectElement = HTMLElement & {
  items?: readonly { value: string; label: string; disabled: boolean }[];
  defaultValue?: string;
  placeholder?: string;
};

const OPTIONS: readonly { value: string; label: string; disabled: boolean }[] = [
  { value: "react", label: "React", disabled: false },
  { value: "solid", label: "Solid", disabled: false },
  { value: "svelte", label: "Svelte", disabled: true },
];

export default function SelectSpecimen() {
  const [value, setValue] = createSignal("");
  const [last, setLast] = createSignal("nothing selected yet");
  let el: SelectElement | undefined;

  // Down: property writes. Up: the value-change CustomEvent. No wrapper.
  createEffect(() => {
    if (!el) return;
    el.items = OPTIONS;
    el.defaultValue = "react";
    el.placeholder = "Select a framework";
    const onValueChange = (event: Event) => {
      const change = (event as CustomEvent<SelectValueChange>).detail;
      setValue(change.value[0] ?? "");
      setLast(change.items[0]?.label ?? "none");
    };
    el.addEventListener("value-change", onValueChange);
    onCleanup(() => el?.removeEventListener("value-change", onValueChange));
  });

  return (
    <section>
      <h2 class="text-xl mb-1">Select</h2>
      <p class="text-muted mb-4">
        Solid owns the options and passes them down; the element's value-change event comes back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <span class="text-sm text-muted">
          value: <span id="select-value">{value() || "none"}</span>
        </span>
        <span class="text-sm text-muted">
          last: <span id="last-value">{last()}</span>
        </span>
      </div>

      <spin-select
        ref={(node) => {
          el = node as SelectElement;
        }}
      />
    </section>
  );
}
