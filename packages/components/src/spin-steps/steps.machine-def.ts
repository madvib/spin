import type { MachineDef } from "@spin/runtime";
import { createStepsBridge } from "./steps.bridge.ts";
import type { StepsComplete } from "./steps.bridge.ts";
import type { StepsInvalid, StepsStepChange } from "./steps.machine.ts";

/**
 * The steps' seam: the bridge, the element's imperative commands and the
 * CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `step-change` carries the index
 * on every accepted move, `step-complete` on landing at count,
 * `step-invalid` on a refused forward move.
 */

export type { StepsComplete, StepsInvalid, StepsStepChange };

export const steps: MachineDef = {
  createBridge: createStepsBridge,
  commands: ["goToNextStep", "goToPrevStep", "resetStep", "setStep"],
  events: {
    "step-change": {
      on: "onStepChange",
      detail: (change: StepsStepChange) => ({ step: change.step }),
    },
    "step-complete": {
      on: "onStepComplete",
      detail: (change: StepsComplete) => ({ step: change.step }),
    },
    "step-invalid": {
      on: "onStepInvalid",
      detail: (change: StepsInvalid) => ({
        step: change.step,
        action: change.action,
        targetStep: change.targetStep,
      }),
    },
  },
};
