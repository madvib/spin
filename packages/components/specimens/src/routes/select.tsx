import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

import "./spin-select.html";
interface SelectCommands {
  open(): void;
  close(): void;
  toggle(): void;
  selectValue(value: string): void;
  setValue(value: string[]): void;
  clearValue(): void;
  focus(): void;
}

/** The item tree crosses the property channel as JSON text: the scope
 * grammar has no recursive type, and a label-less item is its own label. */
const ITEMS = [
  { value: "deno", label: "Deno" },
  { value: "bun", label: "Bun" },
  { value: "node", label: "Node.js" },
  { value: "porter", label: "Porter", disabled: true },
];

/**
 * Select on the owned machine: three modes (closed, closed-and-focused,
 * open), the selection and the highlight on the root tier, and every reflex
 * an action — dismissable outside, scroll-into-view on the list, form-control
 * on the hidden select.
 */
export default function Select() {
  const [selected, setSelected] = createSignal<string[]>([]);
  const [openCount, setOpenCount] = createSignal(0);

  const [singleEl, setSingle] = createSignal<HTMLElement>();
  const single = createSpinComponent<SelectCommands>(singleEl);
  createEffect(() => {
    const ctl = single();
    if (ctl === undefined) return undefined;
    return ctl.bind({ items: ITEMS, label: "Runtime" }, {
      "value-change": (e: CustomEvent<{ value: string[] }>) =>
        setSelected(e.detail.value),
      "open-change": (e: CustomEvent<{ open: boolean }>) => {
        if (e.detail.open) setOpenCount((n) => n + 1);
      },
    });
  });
;

  return (
    <DemoGrid>
      <DemoCard
        title="Single select"
        width="sm"
        note="The host readouts belong to this instance; the multiple one below is seeded and untouched by the commands."
      >
        <spin-select
          id="single"
          ref={setSingle}
          prop:items={ITEMS}
          prop:label="Runtime"
          prop:name="runtime"
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => single()?.commands.selectValue("bun")}
          >
            el.selectValue("bun")
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => single()?.commands.open()}
          >
            el.open()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => single()?.commands.clearValue()}
          >
            el.clearValue()
          </button>
        </DemoControls>
        <DemoReadout>
          value:{" "}
          <span id="select-value">{selected().join(", ") || "none"}</span>{" "}
          · opens: <span id="select-opens">{openCount()}</span>
        </DemoReadout>
      </DemoCard>

      <DemoCard
        title="Multiple select"
        width="sm"
        note="closeOnSelect is false, so the panel stays up over each pick."
      >
        <spin-select
          id="multi"
          prop:items={ITEMS}
          prop:label="Runtimes"
          prop:multiple={true}
          prop:defaultValue={["deno", "bun"]}
        />
      </DemoCard>
    </DemoGrid>
  );
}
