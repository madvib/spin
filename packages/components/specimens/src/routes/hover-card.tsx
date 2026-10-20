import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

import "./spin-hover-card.html";
interface HoverCardCommands {
  show(): void;
  hide(): void;
}

/**
 * Hover-card on the platform: a native popover panel opened by hover dwell,
 * kept open while the pointer is over either side. One `hover-delay` action
 * on the root owns both clocks; the `anchor` action positions the panel.
 * No machine, no bridge.
 */
export default function HoverCard() {
  const [open, setOpen] = createSignal(false);

  const [cardEl, setCardEl] = createSignal<HTMLElement>();
  const card = createSpinComponent<HoverCardCommands>(cardEl);
  createEffect(() => {
    const ctl = card();
    if (ctl === undefined) return undefined;
    return ctl.bind({ label: "Hover for details" }, {
      "open-change": (event: CustomEvent<{ open: boolean }>) => setOpen(event.detail.open),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Platform-owned: native hover-card"
        width="sm"
        note="Dwell opens, moving to the card keeps it, leaving both closes. The browser owns the panel."
      >
        <spin-hover-card
          id="demo-hover-card"
          ref={(node: HTMLElement) => {
            setCardEl(node);
            node.setAttribute("label", "Hover for details");
          }}
        />
        <DemoControls>
          <button type="button" class={DEMO_BUTTON} onClick={() => card()?.commands.show()}>
            el.show()
          </button>
          <button type="button" class={DEMO_BUTTON} onClick={() => card()?.commands.hide()}>
            el.hide()
          </button>
        </DemoControls>
        <DemoReadout>
          open: <span id="hover-card-open">{open() ? "true" : "false"}</span>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
