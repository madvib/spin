/** Steps machine: one idle state with guarded transitions. */

import { createMachine, type Machine } from "@spin/runtime/fsm";
import type { StepsArgs, StepsContext, StepsState } from "./steps.state.ts";
import { initial } from "./steps.state.ts";
import type { StepsEvents } from "./steps.events.ts";
import {
  applyNextStep,
  applySetStep,
  canNextStep,
  canSetStep,
  prevStep,
  recordInvalidNext,
  recordInvalidSet,
  resetStep,
  setCount,
} from "./steps.transitions.ts";

export {
  hasNextStep,
  hasPrevStep,
  isCompleted,
  itemState,
  percent,
} from "./steps.state.ts";

export type { StepsStepChange, StepsInvalid } from "./steps.events.ts";
export type { StepsItemState } from "./steps.state.ts";

export function steps(
  args: StepsArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<StepsContext, StepsEvents, StepsState> {
  return createMachine<StepsContext, StepsEvents, StepsState>({
    id: "steps",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      count: {},
      titles: {},
      orientation: {},
      linear: {},
    },
    on: {
      SET_COUNT: { assign: setCount },
    },
    states: {
      idle: {
        on: {
          "STEP.SET": [
            { cond: canSetStep, assign: applySetStep },
            { assign: recordInvalidSet },
          ],
          "STEP.NEXT": [
            { cond: canNextStep, assign: applyNextStep },
            { assign: recordInvalidNext },
          ],
          "STEP.PREV": { assign: prevStep },
          "STEP.RESET": { assign: resetStep },
        },
      },
    },
  });
}
