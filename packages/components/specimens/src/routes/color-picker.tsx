import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type {
  ColorPickerFormatChange,
  ColorPickerOpenChange,
  ColorPickerValueChange,
} from "../../../src/spin-color-picker/color-picker.bridge.ts";
import type { ColorFormat } from "../../../src/spin-color-picker/color-picker.machine.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

interface ColorPickerCommands {
  setValue: (value: string) => void;
  setFormat: (format: ColorFormat) => void;
  setOpen: (open: boolean) => void;
}

const SWATCHES = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"];

/**
 * Color-picker on the forked FSM: closed/unfocused, closed/focused, open
 * driving, open dragging.
 *
 * The claim under test: Zag's nested `open.{idle,dragging}` flattens to two
 * open phases with the open parent's handlers at the root tier, the color
 * travels serialized with parse-mutate-write assigns, and the area/channel
 * drags compute percents in the view while the machine turns them into
 * channel values.
 */
export default function ColorPickerFsm() {
  const [value, setValue] = createSignal("#ff0000");
  const [format, setFormat] = createSignal("hex");
  const [open, setOpen] = createSignal("closed");
  const [ends, setEnds] = createSignal(0);

  const [singleEl, setSingle] = createSignal<HTMLElement>();
  const single = createSpinComponent<ColorPickerCommands>(singleEl);
  createEffect(() => {
    const ctl = single();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      label: "Brand",
      defaultValue: "#ff0000",
    }, {
      "value-change": (event: CustomEvent<ColorPickerValueChange>) =>
        setValue(event.detail.value),
      "value-change-end": (_event: CustomEvent<ColorPickerValueChange>) =>
        setEnds((n) => n + 1),
      "open-change": (event: CustomEvent<ColorPickerOpenChange>) =>
        setOpen(event.detail.open ? "open" : "closed"),
      "format-change": (event: CustomEvent<ColorPickerFormatChange>) =>
        setFormat(event.detail.format),
    });
  });

  const [inlineEl, setInline] = createSignal<HTMLElement>();
  const inline = createSpinComponent<ColorPickerCommands>(inlineEl);
  createEffect(() => {
    const ctl = inline();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      label: "Inline",
      defaultValue: "#0000ff",
      inline: true,
    }, {});
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Trigger and panel"
        width="md"
        note="The trigger opens the panel; the area, the hue and alpha sliders, the hex input and the swatches drive this instance."
      >
        <spin-color-picker
          id="brand"
          ref={setSingle}
          prop:label="Brand"
          prop:defaultValue="#ff0000"
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => single()?.commands.setValue("#00ff00")}
          >
            el.setValue("#00ff00")
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => single()?.commands.setFormat("rgb")}
          >
            el.setFormat("rgb")
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => single()?.commands.setOpen(true)}
          >
            el.setOpen(true)
          </button>
        </DemoControls>
        <DemoReadout>
          value: {value()} · format: {format()} · {open()} · ends: {ends()}
        </DemoReadout>
      </DemoCard>

      <DemoCard
        title="Inline with swatches"
        width="md"
        note="Always open; swatches commit on click."
      >
        <spin-color-picker
          id="inline"
          ref={setInline}
          prop:label="Inline"
          prop:defaultValue="#0000ff"
          prop:inline={true}
        />
        <DemoReadout>
          inline is always open
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
