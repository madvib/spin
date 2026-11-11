import type { EventUnion } from "@spinjs/components/fsm";

export interface TourEvents {
  "START": {};
  "STEP.SET": { step: number };
  "STEP.NEXT": {};
  "STEP.PREV": {};
  "TARGET.RESOLVED": {};
  "TARGET.NOT_FOUND": {};
  "SCROLL.END": {};
  /** The resolved target's box: the spotlight's geometry, measured by the
   * view and handed to the machine, which owns it. */
  "SPOTLIGHT.SET": { x: number; y: number; w: number; h: number };
  "DISMISS": {};
  "SKIP": {};
}

export type TourEvent = EventUnion<TourEvents>;

export type TourStepChange = {
  readonly step: number;
  readonly stepId: string;
};

export type TourDismissChange = {
  readonly reason: "complete" | "dismiss" | "skip" | "not-found";
  readonly step: number;
};
