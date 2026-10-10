import type { MachineDef } from "@spin/runtime";
import { createStepsFsmBridge } from "./steps.bridge.ts";
import type { StepsStepChange, StepsStepInvalid } from "./steps.bridge.ts";

/**
 * The steps seam: the bridge, the element's imperative commands and the
 * CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge` routes
 * straight to the fork, which is what makes this interpreter a drop-in behind
 * the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `step-change` carries
 * `onStepChange`, `step-complete` carries `onStepComplete` (fired when the
 * machine lands on `count`), and `step-invalid` carries `onStepInvalid` with
 * the refused action and, for a set, the target it asked for.
 */

export type { StepsStepChange, StepsStepInvalid };

export const steps: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("steps fsm runs through createStepsFsmBridge");
  }) as never,
  createBridge: createStepsFsmBridge,
  commands: ["setStep", "goToNextStep", "goToPrevStep", "resetStep"],
  events: {
    "step-change": {
      on: "onStepChange",
      detail: (change: StepsStepChange) => ({ step: change.step }),
    },
    "step-complete": {
      on: "onStepComplete",
      detail: () => ({}),
    },
    "step-invalid": {
      on: "onStepInvalid",
      detail: (change: StepsStepInvalid) => ({
        step: change.step,
        action: change.action,
        targetStep: change.targetStep,
      }),
    },
  },
};
