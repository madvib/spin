import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type { SliderValueChange } from "../../../src/spin-slider/slider.machine.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";
import "./spin-slider.html";

interface SliderCommands {
  setValue: (value: number[]) => void;
  setThumbValue: (index: number, value: number) => void;
  increment: (index?: number) => void;
  decrement: (index?: number) => void;
  focus: () => void;
}

/**
 * Slider on the owned machine: idle, focused, dragging — with the step
 * grid, the clamp windows and the collision answer in the machine, and
 * pointer measurement plus thumb focus in the view.
 */
export default function Slider() {
  const [volume, setVolume] = createSignal("0");
  const [range, setRange] = createSignal("20, 80");

  const [volumeEl, setVolumeEl] = createSignal<HTMLElement>();
  const volumeCtl = createSpinComponent<SliderCommands>(volumeEl);
  createEffect(() => {
    const ctl = volumeCtl();
    if (ctl === undefined) return undefined;
    return ctl.bind({ label: "Volume", name: "volume" }, {
      "value-change": (e: CustomEvent<SliderValueChange>) =>
        setVolume(e.detail.value.join(", ")),
    });
  });

  const [rangeEl, setRangeEl] = createSignal<HTMLElement>();
  const rangeCtl = createSpinComponent<SliderCommands>(rangeEl);
  createEffect(() => {
    const ctl = rangeCtl();
    if (ctl === undefined) return undefined;
    return ctl.bind({ label: "Range", defaultValue: "[20, 80]" }, {
      "value-change": (e: CustomEvent<SliderValueChange>) =>
        setRange(e.detail.value.join(", ")),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Drag, keys, commands"
        width="sm"
        note="Press the track to jump, drag the thumb, arrows to step, Home and End to jump."
      >
        <spin-slider
          id="volume"
          ref={setVolumeEl}
          prop:label="Volume"
          prop:name="volume"
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => volumeCtl()?.commands.setValue([75])}
          >
            el.setValue([75])
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => volumeCtl()?.commands.focus()}
          >
            el.focus()
          </button>
        </DemoControls>
        <DemoReadout>
          volume: {volume()}
        </DemoReadout>
      </DemoCard>
      <DemoCard
        title="Two thumbs"
        width="sm"
        note="Thumbs clamp at each other under the none collision."
      >
        <spin-slider
          id="range"
          ref={setRangeEl}
          prop:label="Range"
          prop:defaultValue="[20, 80]"
        />
        <DemoReadout>
          range: {range()}
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
