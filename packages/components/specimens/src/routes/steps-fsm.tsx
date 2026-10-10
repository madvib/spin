import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import type { StepsCommands, StepsItemState } from "../../../src/spin-steps/steps.connect.ts";
import type { StepsStepChange, StepsStepInvalid } from "../../../src/spin-steps/steps.bridge.ts";

interface StepsProps {
  count: number;
  defaultStep?: number;
  step?: number;
  linear?: boolean;
  orientation?: string;
  labels: string[];
}

interface StepsElement extends HTMLElement {
  isStepValid: (index: number) => boolean;
  isStepSkippable: (index: number) => boolean;
}

const FLOW = ["Account", "Profile", "Payment", "Review"];
const COLUMN = ["Write", "Preview", "Publish"];
const GATED = ["Details", "Consent", "Billing", "Confirm"];

const invalidText = (detail: StepsStepInvalid | undefined): string =>
  detail === undefined
    ? "none"
    : `step ${detail.step} refused ${detail.action}` +
      (detail.targetStep === undefined ? "" : ` -> ${detail.targetStep}`);

const button =
  "rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface";

/**
 * Steps on the forked FSM: the stepper behind a checkout flow.
 *
 * The claim under test: Zag's single `idle` chart becomes this fork's root
 * tier with the four moves as pure context writes, the two host predicates
 * travel as element properties and gate the forward moves, and a controlled
 * `step` is never guarded — an authored write lands exactly as Zag's bindable
 * read does.
 */
export default function StepsFsm() {
  const [step, setStep] = createSignal(0);
  const [completed, setCompleted] = createSignal(0);
  const [columnStep, setColumnStep] = createSignal(1);
  const [gatedStep, setGatedStep] = createSignal(0);
  const [validUpTo, setValidUpTo] = createSignal(1);
  const [skipSecond, setSkipSecond] = createSignal(false);
  const [invalid, setInvalid] = createSignal<StepsStepInvalid | undefined>(undefined);

  const horizontal = createSpin<StepsProps, StepsCommands>(
    "spin-steps-fsm",
    () => ({ count: FLOW.length, defaultStep: 0, linear: false, orientation: "horizontal", labels: FLOW }),
    {
      "step-change": (event: CustomEvent<StepsStepChange>) => setStep(event.detail.step),
      "step-complete": () => setCompleted((n) => n + 1),
    },
  );

  const vertical = createSpin<StepsProps, StepsCommands>(
    "spin-steps-fsm",
    () => ({ count: COLUMN.length, defaultStep: 1, linear: false, orientation: "vertical", labels: COLUMN }),
    {
      "step-change": (event: CustomEvent<StepsStepChange>) => setColumnStep(event.detail.step),
    },
  );

  const linear = createSpin<StepsProps, StepsCommands>(
    "spin-steps-fsm",
    () => ({ count: GATED.length, step: gatedStep(), linear: true, orientation: "horizontal", labels: GATED }),
    {
      "step-change": (event: CustomEvent<StepsStepChange>) => setGatedStep(event.detail.step),
      "step-invalid": (event: CustomEvent<StepsStepInvalid>) => setInvalid(event.detail),
    },
  );

  return (
    <section>
      <h2 class="text-xl mb-1">Steps — forked FSM</h2>
      <p class="text-muted mb-4">
        Click a trigger to jump (any direction is always allowed), or walk with Previous and Next — forward is
        refused while the step being left is invalid, and the progress bar tracks the percent. The vertical
        stepper stacks the same parts; the linear one is controlled from the host and gates forward navigation
        behind <code>isStepValid</code>.
      </p>

      <div class="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Horizontal, non-linear</h3>
          <spin-steps-fsm
            id="flow"
            ref={horizontal.ref}
            prop:count={FLOW.length}
            prop:labels={FLOW}
          />
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class={button} onClick={() => horizontal.commands().goToPrevStep()}>
              el.goToPrevStep()
            </button>
            <button type="button" class={button} onClick={() => horizontal.commands().goToNextStep()}>
              el.goToNextStep()
            </button>
            <button type="button" class={button} onClick={() => horizontal.commands().resetStep()}>
              el.resetStep()
            </button>
            <button type="button" class={button} onClick={() => horizontal.commands().setStep(3)}>
              el.setStep(3)
            </button>
          </div>
          <p class="mt-2 text-sm text-muted font-mono tabular-nums">
            step: <span id="steps-step">{step()}</span> · completions:{" "}
            <span id="steps-completed">{completed()}</span>
          </p>
        </div>

        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Vertical</h3>
          <spin-steps-fsm
            id="column"
            ref={vertical.ref}
            prop:count={COLUMN.length}
            prop:defaultStep={1}
            prop:orientation="vertical"
            prop:labels={COLUMN}
          />
          <p class="mt-3 text-sm text-muted font-mono tabular-nums">
            step: <span id="steps-column-step">{columnStep()}</span>
          </p>
        </div>

        <div class="lg:col-span-2">
          <h3 class="mb-2 text-sm font-medium text-text">Linear and controlled</h3>
          <spin-steps-fsm
            id="gated"
            ref={(node: HTMLElement) => {
              linear.ref(node);
              const host = node as StepsElement;
              // The scope grammar types props as bool/string/int/string[], so
              // the behavior predicates cross as element properties — the
              // bridge reads them off the root, live, like Zag reads props.
              host.isStepValid = (index: number) => index < validUpTo();
              host.isStepSkippable = (index: number) => skipSecond() && index === 1;
            }}
            prop:count={GATED.length}
            prop:linear={true}
            prop:step={gatedStep()}
            prop:labels={GATED}
          />
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              class={button}
              onClick={() => setValidUpTo(Math.max(validUpTo(), gatedStep() + 1))}
            >
              validate current step
            </button>
            <button
              type="button"
              class={button}
              onClick={() => setValidUpTo((n) => Math.max(n - 1, 1))}
            >
              unvalidate last
            </button>
            <button type="button" class={button} onClick={() => setSkipSecond((on) => !on)}>
              {skipSecond() ? "step 1 not skippable" : "step 1 skippable"}
            </button>
          </div>
          <p class="mt-2 text-sm text-muted font-mono tabular-nums">
            step: <span id="steps-gated-step">{gatedStep()}</span> · valid up to: <span>{validUpTo() - 1}</span> ·
            last invalid: <span id="steps-gated-invalid">{invalidText(invalid())}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
