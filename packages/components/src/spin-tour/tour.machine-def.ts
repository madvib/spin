import type { MachineDef } from "@spin/runtime";
import { createTourBridge } from "./tour.bridge.ts";
import type { TourDismissChange, TourStepChange, TourStepRecord } from "./tour.machine.ts";

/**
 * The tour's seam: the bridge, the element's imperative commands, and the
 * CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `start` carries `onStart`,
 * `step-change` carries `onStepChange`, `dismiss` carries `onDismiss`
 * with the reason (a complete at the last step, a dismiss, a skip, or a
 * not-found), and `complete` carries `onComplete`.
 */

export type { TourDismissChange, TourStepChange, TourStepRecord };

export const tour: MachineDef = {
  createBridge: createTourBridge,
  commands: [
    "start",
    "next",
    "prev",
    "dismiss",
    "skip",
    "setStep",
    "notifyTargetResolved",
    "notifyTargetNotFound",
    "notifyScrollEnd",
  ],
  events: {
    start: {
      on: "onStart",
      detail: (change: { step: number }) => ({ step: change.step }),
    },
    "step-change": {
      on: "onStepChange",
      detail: (change: TourStepChange) => ({ step: change.step, stepId: change.stepId }),
    },
    dismiss: {
      on: "onDismiss",
      detail: (change: TourDismissChange) => ({ reason: change.reason, step: change.step }),
    },
    complete: {
      on: "onComplete",
      detail: () => ({}),
    },
  },
};
