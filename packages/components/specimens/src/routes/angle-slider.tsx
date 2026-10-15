import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type { AngleSliderValueChange } from "../../../src/spin-angle-slider/angle-slider.machine.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

interface AngleSliderCommands {
  setValue: (value: number) => void;
  focus: () => void;
}

/**
 * Angle-slider on the owned machine: idle, focused, dragging — with the
 * polar math, the step grid and the grab offset in the machine, and
 * pointer measurement plus thumb focus in the view.
 */
export default function AngleSlider() {
  const [angle, setAngle] = createSignal("0deg");

  const [dialEl, setDial] = createSignal<HTMLElement>();
  const dial = createSpinComponent<AngleSliderCommands>(dialEl);
  createEffect(() => {
    const ctl = dial();
    if (ctl === undefined) return undefined;
    return ctl.bind({ label: "Hue", name: "hue" }, {
      "value-change": (e: CustomEvent<AngleSliderValueChange>) => setAngle(e.detail.valueAsDegree),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Turn, keys, commands"
        width="md"
        note="Press the dial to jump, drag to turn, arrows to step, Home and End to jump."
      >
        <spin-angle-slider
          id="dial"
          ref={setDial}
          prop:label="Hue"
          prop:name="hue"
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => dial()?.commands.setValue(180)}
          >
            el.setValue(180)
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => dial()?.commands.focus()}
          >
            el.focus()
          </button>
        </DemoControls>
        <DemoReadout>
          angle: {angle()}
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
