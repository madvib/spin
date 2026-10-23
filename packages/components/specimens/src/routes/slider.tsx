import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type { SliderValueChange } from "../../../src/slider/slider.events.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

// The specimen shows the product: the examples are the markup, mounted
// verbatim with the demo's commands and readouts wired around them.
// There is no specimen-local copy of the slider markup — a demo that
// needs different content changes the example, and every user benefits.
import "../../../src/slider/examples/basic.html";
import "../../../src/slider/examples/range.html";

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
    return ctl.bind({}, {
      "value-change": (e: CustomEvent<SliderValueChange>) =>
        setVolume(e.detail.value.join(", ")),
    });
  });

  const [rangeEl, setRangeEl] = createSignal<HTMLElement>();
  const rangeCtl = createSpinComponent<SliderCommands>(rangeEl);
  createEffect(() => {
    const ctl = rangeCtl();
    if (ctl === undefined) return undefined;
    return ctl.bind({}, {
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
        <slider-basic
          id="volume"
          ref={setVolumeEl}
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
        <slider-range
          id="range"
          ref={setRangeEl}
        />
        <DemoReadout>
          range: {range()}
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
