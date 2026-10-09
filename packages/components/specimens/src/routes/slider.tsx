import { createEffect, createSignal, onCleanup } from "solid-js";
import type { SliderValueChange } from "../../../src/spin-slider/slider.machine-def.ts";

type SliderElement = HTMLElement & {
  label?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  name?: string;
};

export default function SliderSpecimen() {
  const [value, setValue] = createSignal(50);
  let el: SliderElement | undefined;

  // Down: property writes. Up: the value-change CustomEvent. No wrapper.
  createEffect(() => {
    if (!el) return;
    const onValueChange = (event: Event) => {
      const detail = (event as CustomEvent<SliderValueChange>).detail;
      const next = detail.value[0];
      if (next !== undefined) setValue(next);
    };
    el.addEventListener("value-change", onValueChange);
    onCleanup(() => el?.removeEventListener("value-change", onValueChange));
  });

  return (
    <section>
      <h2 class="text-xl mb-1">Slider</h2>
      <p class="text-muted mb-4">
        Solid owns the label and passes it down; the element's value-change event comes back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <span class="text-sm text-muted">
          value: <span id="slider-value">{value()}</span>
        </span>
      </div>

      <spin-slider
        ref={(node: HTMLElement) => {
          el = node as SliderElement;
          el.label = "Volume";
          el.defaultValue = 50;
        }}
      />
    </section>
  );
}
