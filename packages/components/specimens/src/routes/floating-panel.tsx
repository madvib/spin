import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import {
  DEMO_BUTTON,
  DemoCard,
  DemoControls,
  DemoGrid,
  DemoReadout,
} from "../demo.tsx";

interface FloatingPanelCommands {
  setOpen(): void;
  close(): void;
  minimize(): void;
  maximize(): void;
  restore(): void;
}

/**
 * Floating-panel: open/closed with the gesture modes (dragging, resizing)
 * and the stage (minimized/maximized/restored). The drag is a stdlib
 * action on the handles; position and size ride the geometry channel.
 */
export default function FloatingPanel() {
  const [state, setState] = createSignal("closed");

  const [panelEl, setPanel] = createSignal<HTMLElement>();
  const panel = createSpinComponent<FloatingPanelCommands>(panelEl);
  createEffect(() => {
    const ctl = panel();
    if (ctl === undefined) return undefined;
    const unbind = ctl.bind({ label: "Inspector" }, {
      "open-change": (e: CustomEvent<{ open: boolean }>) =>
        setState(e.detail.open ? "open" : "closed"),
      "stage-change": (e: CustomEvent<{ stage: string }>) => setState(e.detail.stage),
    });
    // The seeded open never reports through the channel (a seed is a
    // service send, not a host write), so the readout starts from state.
    if (ctl.state.isOpen?.() === true) setState("open");
    return unbind;
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Drag, resize, stage"
        width="lg"
        note="Drag the header to move; pull any edge to resize; Escape cancels a gesture. The stage buttons minimize and restore."
      >
        <spin-floating-panel
          id="panel"
          ref={setPanel}
          prop:label="Inspector"
          default-open="true"
        />
        <DemoControls>
          <button type="button" class={DEMO_BUTTON} onClick={() => panel()?.commands.maximize()}>
            el.maximize()
          </button>
          <button type="button" class={DEMO_BUTTON} onClick={() => panel()?.commands.setOpen()}>
            el.setOpen()
          </button>
          <button type="button" class={DEMO_BUTTON} onClick={() => panel()?.commands.close()}>
            el.close()
          </button>
        </DemoControls>
        <DemoReadout>
          state: <span id="panel-state">{state()}</span>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
