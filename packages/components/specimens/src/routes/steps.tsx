import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type { StepsStepChange } from "../../../src/spin-steps/steps.machine.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";
import "./spin-steps.html";

interface StepsCommands {
  goToNextStep: () => void;
  goToPrevStep: () => void;
  resetStep: () => void;
  setStep: (value: number) => void;
}

const TITLES = ["Account", "Profile", "Confirm"];

/**
 * Steps on the owned machine: one idle state with guarded transitions —
 * forward motion validates, backward is always legal, reset returns to
 * zero.
 */
export default function Steps() {
  const [step, setStep] = createSignal("0");

  const [flowEl, setFlow] = createSignal<HTMLElement>();
  const flow = createSpinComponent<StepsCommands>(flowEl);
  createEffect(() => {
    const ctl = flow();
    if (ctl === undefined) return undefined;
    return ctl.bind({ label: "Signup", count: 3, titles: TITLES }, {
      "step-change": (e: CustomEvent<StepsStepChange>) => setStep(String(e.detail.step)),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Next, back, jump"
        width="md"
        note="Next advances, Back retreats, triggers jump when not linear."
      >
        <spin-steps
          id="flow"
          ref={setFlow}
          prop:label="Signup"
          prop:count={3}
          prop:titles={TITLES}
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => flow()?.commands.goToNextStep()}
          >
            el.goToNextStep()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => flow()?.commands.resetStep()}
          >
            el.resetStep()
          </button>
        </DemoControls>
        <DemoReadout>
          step: {step()}
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
