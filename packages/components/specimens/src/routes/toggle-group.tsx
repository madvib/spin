import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type { ToggleGroupValueChange } from "../../../src/toggle-group/toggle-group.machine.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

import "./spin-toggle-group.html";
interface ToggleGroupCommands {
  setValue: (value: string[]) => void;
}

const ITEMS = [
  { value: "bold", label: "Bold" },
  { value: "italic", label: "Italic" },
  { value: "underline", label: "Underline" },
];

/**
 * Toggle-group on the owned machine: idle, focused — with the selection
 * semantics and the roving focus model in the machine, and neighbor
 * resolution plus DOM focus moves in the view.
 */
export default function ToggleGroup() {
  const [selection, setSelection] = createSignal("none");

  const [formatEl, setFormat] = createSignal<HTMLElement>();
  const format = createSpinComponent<ToggleGroupCommands>(formatEl);
  createEffect(() => {
    const ctl = format();
    if (ctl === undefined) return undefined;
    return ctl.bind({ items: ITEMS, label: "Format", multiple: true }, {
      "value-change": (e: CustomEvent<ToggleGroupValueChange>) =>
        setSelection(e.detail.value.length === 0 ? "none" : e.detail.value.join(", ")),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Toggle, arrows, commands"
        width="sm"
        note="Click toggles, arrows rove with loop wrap, Home and End jump."
      >
        <spin-toggle-group
          id="format"
          ref={setFormat}
          prop:items={ITEMS}
          prop:label="Format"
          prop:multiple={true}
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => format()?.commands.setValue(["bold", "italic"])}
          >
            el.setValue(["bold", "italic"])
          </button>
        </DemoControls>
        <DemoReadout>
          selection: {selection()}
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
