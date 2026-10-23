/**
 * Tour machine: the inactive and running modes, and the three phases a
 * running step passes through — a step resolves its target, scrolls it
 * into view, then shows its spotlight.
 */

import { createMachine, type Machine } from "@spin/runtime/fsm";
import type { TourArgs, TourContext, TourState } from "./tour.state.ts";
import { initial } from "./tour.state.ts";
import type { TourEvents } from "./tour.events.ts";
import {
  bail,
  hasPrev,
  hasSteps,
  hasNext,
  nextStep,
  prevStep,
  setSpotlight,
  setStep,
  startTour,
  validStep,
} from "./tour.transitions.ts";

export function tour(
  args: TourArgs = {},
  authored: (name: string) => boolean = () => true,
): Machine<TourContext, TourEvents, TourState> {
  return createMachine<TourContext, TourEvents, TourState>({
    id: "tour",
    initial: "inactive",
    context: initial(args, authored),
    fields: {
      step: { event: "STEP.SET" },
      disabled: {},
      spotlightPadding: {},
      label: {},
    },
    on: {
      "SPOTLIGHT.SET": { assign: setSpotlight },
      "STEP.SET": [
        { cond: validStep, target: "resolving", assign: setStep },
      ],
    },
    states: {
      inactive: {
        on: {
          "START": [
            { cond: hasSteps, target: "resolving", assign: startTour },
          ],
        },
      },
      resolving: {
        on: {
          "TARGET.NOT_FOUND": [{ target: "inactive", assign: bail }],
          "TARGET.RESOLVED": [{ target: "scrolling" }],
          "DISMISS": [{ target: "inactive", assign: bail }],
          "SKIP": [{ target: "inactive" }],
        },
      },
      scrolling: {
        on: {
          "SCROLL.END": [{ target: "active" }],
          "DISMISS": [{ target: "inactive", assign: bail }],
          "SKIP": [{ target: "inactive" }],
        },
      },
      active: {
        on: {
          "STEP.NEXT": [
            { cond: hasNext, target: "resolving", assign: nextStep },
          ],
          "STEP.PREV": [
            { cond: hasPrev, target: "resolving", assign: prevStep },
          ],
          "DISMISS": [{ target: "inactive", assign: bail }],
          "SKIP": [{ target: "inactive" }],
        },
      },
    },
  });
}