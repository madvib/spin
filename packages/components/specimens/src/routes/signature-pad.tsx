import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type { SignaturePadDrawDetails } from "../../../src/spin-signature-pad/signature-pad.machine.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

import "./spin-signature-pad.html";
interface SignaturePadCommands {
  clear: () => void;
  getDataUrl: (type: string, quality?: number) => Promise<string>;
}

/**
 * Signature-pad on the forked FSM: idle, drawing.
 *
 * The claim under test: a press starts a stroke and the release commits one
 * path, moves with no active stroke are refused, and clear empties the pad —
 * with the ink drawn by perfect-freehand's pure getStroke plus the upstream
 * SVG outline, both running in the machine, never the DOM.
 */
export default function SignaturePadFsm() {
  const [strokes, setStrokes] = createSignal("empty");
  const [drawing, setDrawing] = createSignal("idle");

  const [padEl, setPad] = createSignal<HTMLElement>();
  const pad = createSpinComponent<SignaturePadCommands>(padEl);
  createEffect(() => {
    const ctl = pad();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      label: "Signature",
      name: "signature",
    }, {
      draw: (event: CustomEvent<SignaturePadDrawDetails>) => {
        setStrokes(`${event.detail.paths.length} committed`);
        setDrawing(event.detail.currentPath === null ? "idle" : "drawing");
      },
      "draw-end": (event: CustomEvent<SignaturePadDrawDetails>) => {
        setStrokes(
          event.detail.paths.length === 0 ? "empty" : `${event.detail.paths.length} committed`,
        );
        setDrawing("idle");
      },
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Draw, clear"
        width="lg"
        note="Press and drag to sign. The release commits one path; Clear empties the pad."
      >
        <spin-signature-pad
          id="pad"
          ref={setPad}
          prop:label="Signature"
          prop:name="signature"
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => pad()?.commands.clear()}
          >
            el.clear()
          </button>
        </DemoControls>
        <DemoReadout>
          strokes: {strokes()} · {drawing()}
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
