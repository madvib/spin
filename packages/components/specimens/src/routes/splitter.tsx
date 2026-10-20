import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type { SplitterResizeDetails } from "../../../src/spin-splitter/splitter.machine.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

import "./spin-splitter.html";
interface SplitterCommands {
  setSizes: (size: number[]) => void;
  resetSizes: () => void;
  collapsePanel: (id: string) => void;
  expandPanel: (id: string, minSize?: number) => void;
  resizePanel: (id: string, size: number) => void;
}

const PANELS = [
  { id: "nav", collapsible: true, minSize: 10 },
  { id: "main" },
  { id: "side", minSize: 10 },
];

/**
 * Splitter on the owned machine: idle, hovering, focused, dragging — with
 * the percent redistribution, the clamp windows and the collapse memory in
 * the machine, and pointer measurement plus handle focus in the view.
 */
export default function Splitter() {
  const [sizes, setSizes] = createSignal("33, 33, 33");

  const [groupEl, setGroup] = createSignal<HTMLElement>();
  const group = createSpinComponent<SplitterCommands>(groupEl);
  createEffect(() => {
    const ctl = group();
    if (ctl === undefined) return undefined;
    return ctl.bind({ panels: PANELS }, {
      resize: (e: CustomEvent<SplitterResizeDetails>) =>
        setSizes(e.detail.size.map((size) => Math.round(size)).join(", ")),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Drag, keys, collapse"
        width="lg"
        note="Drag a handle to redistribute, arrows to nudge, Enter to collapse and re-expand the nav panel."
      >
        <spin-splitter
          id="group"
          ref={setGroup}
          prop:panels={PANELS}
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => group()?.commands.setSizes([30, 40, 30])}
          >
            el.setSizes([30, 40, 30])
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => group()?.commands.collapsePanel("side")}
          >
            el.collapsePanel("side")
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => group()?.commands.expandPanel("side")}
          >
            el.expandPanel("side")
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => group()?.commands.resetSizes()}
          >
            el.resetSizes()
          </button>
        </DemoControls>
        <DemoReadout>
          sizes: {sizes()}
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
