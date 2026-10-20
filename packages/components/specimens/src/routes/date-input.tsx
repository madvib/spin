import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

import "./spin-date-input.html";
interface DateValue {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

interface DateInputCommands {
  focus(): void;
  setValue(value: DateValue | null): void;
  clearValue(): void;
}

/**
 * Date-input: per-segment editing of a calendar date — typed digits
 * accumulate, arrows cycle within limits, the day follows its month.
 * Plain ISO field records, formatted by `Intl`; no calendar library.
 */
export default function DateInput() {
  const [value, setValue] = createSignal("");

  const [dateEl, setDate] = createSignal<HTMLElement>();
  const date = createSpinComponent<DateInputCommands>(dateEl);
  createEffect(() => {
    const ctl = date();
    if (ctl === undefined) return undefined;
    return ctl.bind({ label: "Departure", defaultValue: "2024-02-15", name: "departure" }, {
      "value-change": (e: CustomEvent<{ valueAsString: string }>) =>
        setValue(e.detail.valueAsString),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Three segments"
        width="sm"
        note="Type digits or arrow through month, day, year. February holds 29 days in 2024."
      >
        <spin-date-input
          id="date"
          ref={setDate}
          prop:label="Departure"
          prop:defaultValue="2024-02-15"
          prop:name="departure"
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => date()?.commands.setValue({ year: 2025, month: 7, day: 4, hour: 0, minute: 0, second: 0 })}
          >
            el.setValue(2025-07-04)
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => date()?.commands.clearValue()}
          >
            el.clearValue()
          </button>
        </DemoControls>
        <DemoReadout>
          value: <span id="date-value">{value()}</span>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
