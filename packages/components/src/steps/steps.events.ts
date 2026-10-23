import type { EventUnion } from "@spin/runtime/fsm";

export interface StepsEvents {
  "STEP.SET": { value: number; skippable?: unknown; valid?: unknown; };
  "STEP.NEXT": { skippable?: unknown; valid?: unknown; };
  "STEP.PREV": {};
  "STEP.RESET": {};
  "SET_COUNT": { count: number };
}

export type StepsEvent = EventUnion<StepsEvents>;

export type StepsStepChange = {
  readonly step: number;
};

export type StepsInvalid = {
  readonly step: number;
  action: "next" | "set";
  targetStep: number;
};
