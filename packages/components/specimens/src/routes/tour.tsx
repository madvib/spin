import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

import "./spin-tour.html";
interface TourCommands {
  start(): void;
  next(): void;
  prev(): void;
  dismiss(): void;
  skip(): void;
}

const STEPS = [
  { id: "greet", target: "#tour-one", title: "First stop", description: "The spotlight frames this box." },
  { id: "second", target: "#tour-two", title: "Second stop", description: "Next advances and re-resolves." },
];

/**
 * Tour: the inactive and running modes with the three phases a step
 * passes through (resolving, scrolling, active). The spotlight frames
 * the step's target through the geometry channel.
 */
export default function Tour() {
  const [state, setState] = createSignal("inactive");

  const [tourEl, setTour] = createSignal<HTMLElement>();
  const tour = createSpinComponent<TourCommands>(tourEl);
  createEffect(() => {
    const ctl = tour();
    if (ctl === undefined) return undefined;
    return ctl.bind({ steps: JSON.stringify(STEPS) }, {
      start: () => setState("running"),
      "step-change": (e: CustomEvent<{ stepId: string }>) => setState(e.detail.stepId),
      dismiss: (e: CustomEvent<{ reason: string }>) => setState(e.detail.reason),
      complete: () => setState("complete"),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Spotlight tour"
        width="lg"
        note="Start the tour: each step resolves its target, scrolls it in, then frames it. Back/Next walk the steps; the last dismiss completes."
      >
        <div class="flex gap-3">
          <div id="tour-one" class="flex h-16 w-32 items-center justify-center rounded-md border border-border bg-surface-raised text-xs text-muted">
            Target one
          </div>
          <div id="tour-two" class="flex h-16 w-32 items-center justify-center rounded-md border border-border bg-surface-raised text-xs text-muted">
            Target two
          </div>
        </div>

        <spin-tour id="tour" ref={setTour} prop:steps={JSON.stringify(STEPS)} />

        <DemoControls>
          <button type="button" class={DEMO_BUTTON} onClick={() => tour()?.commands.start()}>
            el.start()
          </button>
          <button type="button" class={DEMO_BUTTON} onClick={() => tour()?.commands.next()}>
            el.next()
          </button>
        </DemoControls>
        <DemoReadout>
          state: <span id="tour-state">{state()}</span>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
