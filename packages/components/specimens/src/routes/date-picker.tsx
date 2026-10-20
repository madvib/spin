import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

import "./spin-date-picker.html";
interface DatePickerCommands {
  open(): void;
  close(): void;
  clear(): void;
  setValue(value: readonly { year: number; month: number; day: number }[] | null): void;
}

/**
 * Date-picker: open/closed modes, day/month/year views, and the three
 * selection modes, on a native popover panel anchored to the trigger.
 * The grid the view derives from the focused day; the machine owns the
 * modes and the value moves.
 */
export default function DatePicker() {
  const [value, setValue] = createSignal("");

  const [pickerEl, setPicker] = createSignal<HTMLElement>();
  const picker = createSpinComponent<DatePickerCommands>(pickerEl);
  createEffect(() => {
    const ctl = picker();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      label: "Arrival",
      defaultValue: "2024-02-15",
      placeholder: "Pick a date",
    }, {
      "value-change": (e: CustomEvent<{ valueAsString: readonly string[] }>) =>
        setValue(e.detail.valueAsString.join(", ")),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Single selection"
        width="sm"
        note="Open the panel, pick a day or arrow through the grid. The view control climbs month → year."
      >
        <spin-date-picker
          id="picker"
          ref={setPicker}
          prop:label="Arrival"
          prop:defaultValue="2024-02-15"
        />
        <DemoControls>
          <button type="button" class={DEMO_BUTTON} onClick={() => picker()?.commands.open()}>
            el.open()
          </button>
          <button type="button" class={DEMO_BUTTON} onClick={() => picker()?.commands.clear()}>
            el.clear()
          </button>
        </DemoControls>
        <DemoReadout>
          value: <span id="picker-value">{value()}</span>
        </DemoReadout>
      </DemoCard>

      <DemoCard
        title="Range selection"
        width="sm"
        note="Two clicks set the span; the hover preview follows the pointer between them."
      >
        <spin-date-picker
          id="picker-range"
          prop:label="Stay"
          prop:selectionMode="range"
          prop:placeholder="Pick dates"
        />
        <DemoReadout>
          range: <span id="picker-range-value" />
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
